/* Pure, dependency-free extraction and edit logic. PDF.js supplies text items. */
(function (global) {
  'use strict';
  const SPACE = /\s+/g;
  const WORDS = /\S+/g;
  const CONTROL = /^(?:save\s+reset|reset|save|reveal discussion|hide discussion|show description|view interactive version|maximi[sz]e|allow about\b|part\s+[a-d]$)/i;
  const ADMIN = /^(?:unless otherwise stated,?\s*copyright|copyright\s*[©(]|©\s*20\d{2}\b|all rights reserved\.?$|printable page generated\b|printed on\s+\w+\s+\d|page generated\b)/i;
  const INTERFACE = /^(?:save(?:\s+reset)?|reset|reveal discussion|hide discussion|show description|view interactive version|maximi[sz]e|allow about\s+\d+\s*(?:minutes?|hours?|hrs?)|click here(?:\s+for.*)?)$/i;
  const HEADING = /^(?:\d+(?:\.\d+)*\s+[A-Z][^.!?]{1,110}|activity\s+\d|video\s+\d|figure\s+\d|discussion$|introduction$|to sum up|key questions$|case study\s*:)/i;
  const ABREVS = new Set(['dr.','mr.','mrs.','ms.','prof.','e.g.','i.e.','etc.','vs.']);
  const patterns = [
    {tokens:['in','order','to'], remove:2},
    {tokens:['it','is','important','to','note','that'],remove:6},
    {tokens:['it','should','be','noted','that'],remove:5},
    {tokens:['the','fact','that'],remove:2}
  ];
  const compact = value => String(value || '').replace(SPACE,' ').trim();
  const words = text => String(text||'').match(WORDS) || [];
  const cleanWord = word => String(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').toLowerCase();

  function reconstructLines(textItems) {
    const source = (textItems || []).filter(item => item && item.str && item.str.trim() && item.transform);
    const lines=[];
    for(const item of source) {
      const x=+item.transform[4], y=+item.transform[5];
      const height=Math.abs(item.height || item.transform[3] || 9);
      let line=lines.find(l => Math.abs(l.y-y)<=Math.max(2.4,Math.min(4.2,height*.35)));
      if(!line) {line={y,x,items:[],height};lines.push(line);}
      line.items.push({x,y,width:Math.max(0,+item.width||0),text:item.str,hasEOL:!!item.hasEOL});
      line.x=Math.min(line.x,x);line.height=Math.max(line.height,height);
    }
    lines.sort((a,b)=>b.y-a.y || a.x-b.x);
    for (const line of lines) {
      line.items.sort((a,b)=>a.x-b.x);
      let buf='',largeGaps=0,prev=null;
      for(const it of line.items) {
        const gap=prev ? it.x-(prev.x+prev.width) : 0;
        if(prev && gap>23) largeGaps++;
        const insertSpace=prev && gap>Math.max(1.6,line.height*.14) && !/\s$/.test(buf) && !/^\s/.test(it.text);
        buf+=(insertSpace?' ':'')+it.text;
        prev=it;
      }
      line.text=compact(buf);
      line.columns=largeGaps+1;
    }
    return lines.filter(l=>l.text);
  }

  function sentences(text) {
    const input=compact(text);
    if(!input)return [];
    if(typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('en',{granularity:'sentence'});
      const result=[];
      for(const item of seg.segment(input)) {
        const t=item.segment.trim(); if(!t) continue;
        // 'Dr. ' and similar tokens should not create standalone batches.
        if(result.length && ABREVS.has(result[result.length-1].toLowerCase()))result[result.length-1]+=' '+t;
        else result.push(t);
      }
      return result;
    }
    return input.match(/[^.!?]+(?:[.!?]+[”’"')\]]*)?(?=\s|$)/g)?.map(s=>s.trim()).filter(Boolean)||[input];
  }
  function chunkText(text,limit=5) {
    const parts=sentences(text), chunks=[];
    for(let i=0;i<parts.length;i+=limit)chunks.push(parts.slice(i,i+limit).join(' '));
    return chunks;
  }
  function isControl(text) {return CONTROL.test(text.trim());}
  function isAdmin(text) {return ADMIN.test(text.trim());}
  function isInterface(text) {return INTERFACE.test(text.trim());}
  function isHeading(text){return HEADING.test(text.trim()) && text.length<=140;}
  function makeUnit(type,page,text,reason='') {
    return {id:'u-'+page+'-'+Math.random().toString(36).slice(2,10),type,page,text,reason,
      deleted:[],insertions:{},proposal:null,status:(type==='text'||type==='metadata'||type==='interface')?'unreviewed':'protected',history:[]};
  }
  function detectTable(lines) {
    const hits=[];
    for (let i=0;i<lines.length;i++) {
      const l=lines[i];
      if(/\bStudy session\b.*\bActivity\b.*\b(allow|need)\b/i.test(l.text))hits.push(i);
      else if(l.columns>=3)hits.push(i);
    }
    if(!hits.length)return [];
    const ranges=[];let start=hits[0],end=hits[0];
    for(const n of hits.slice(1)) {
      if(n-end<=5){end=n;continue;}
      ranges.push([start,end]);start=n;end=n;
    }
    ranges.push([start,end]);
    return ranges.filter(([a,b])=> b-a>=2 || /\bStudy session\b.*\bActivity\b/i.test(lines[a].text))
      .map(([a,b])=>[a, Math.min(lines.length-1,b+1)]);
  }
  function buildUnits(pageReports) {
    const units=[];
    for(const report of pageReports) {
      const page=report.page;
      const lines=report.lines || reconstructLines(report.items||[]);
      const tableRanges=detectTable(lines);
      let prose=[], last=null;
      function flush(){
        if(!prose.length)return;
        for(const chunk of chunkText(prose.join(' ')))units.push(makeUnit('text',page,chunk));
        prose=[];last=null;
      }
      for(let i=0;i<lines.length;i++) {
        const line=lines[i];
        const tab=tableRanges.find(([a,b])=>i>=a&&i<=b);
        if(tab){
          flush();
          if(i===tab[0])units.push(makeUnit('table',page,lines.slice(tab[0],tab[1]+1).map(l=>l.text).join('\n'),'Possible table or multi-column layout. Verify rows and cells against original PDF.'));
          i=tab[1];continue;
        }
        const t=line.text;
        if(isAdmin(t)){
          flush();
          const combined=[t];
          while(i+1<lines.length && isAdmin(lines[i+1].text))combined.push(lines[++i].text);
          const unit=makeUnit('metadata',page,combined.join(' '),'Administrative PDF metadata is usually not useful in study notes. Proposed for removal; nothing is removed until you approve.');
          unit.proposal=words(unit.text).map((_,j)=>j);
          units.push(unit);last=null;continue;
        }
        if(isInterface(t)){
          flush();const unit=makeUnit('interface',page,t,'Printed web-interface control, not source study content. Proposed for removal; review before accepting.');
          unit.proposal=words(t).map((_,j)=>j);units.push(unit);last=null;continue;
        }
        if(isControl(t)||isHeading(t)) {flush();units.push(makeUnit('special',page,t,isControl(t)?'Interactive or interface content; original action may not be available in a printed PDF.':'Heading, caption or labelled section: not included in sentence shortening.'));continue;}
        if(last && Math.abs(last.y-line.y)>Math.max(16,(last.height||10)*1.85))flush();
        prose.push(t);last=line;
      }
      flush();
      if((report.imageCount||0)>0 || (report.graphicsCount||0)>20) {
        units.push(makeUnit('visual',page,`Unextractable visual content detected on PDF page ${page}.`,
          `Potential image/diagram content detected (${report.imageCount||0} image operations, ${report.graphicsCount||0} graphics operations). Visually check the original PDF; do not assume the diagram's internal text was extracted.`));
      }
      if((report.links||0)>0) {
        units.push(makeUnit('links',page,`PDF page ${page} includes ${report.links} link annotation(s).`,
          'The destination and any interactive activity behind these links are not automatically included in the editable text. Check the original page.'));
      }
      if(!lines.length && !report.imageCount && !report.graphicsCount)units.push(makeUnit('unknown',page,'No selectable text detected.','The page may be scanned, empty or unsupported. Verify manually.'));
    }
    return units;
  }
  function computeSuggestion(text) {
    const w=words(text), normalized=w.map(cleanWord), deletions=new Set();
    for(const p of patterns){
      for(let i=0;i<=normalized.length-p.tokens.length;i++){
        if(p.tokens.every((t,k)=>t===normalized[i+k]))for(let j=0;j<p.remove;j++)deletions.add(i+j);
      }
    }
    return Array.from(deletions).sort((a,b)=>a-b);
  }
  function editedText(unit,quoteSafe=true,override=null){
    const w=words(unit.text),del=new Set(override===null?unit.deleted:override),out=[];let omission=false;
    w.forEach((word,i)=>{
      if(del.has(i)){
        if(quoteSafe && !omission)out.push('[…]');
        omission=true;
      }else{out.push(word);omission=false;}
      const ins=unit.insertions[String(i)];
      if(Array.isArray(ins))ins.forEach(t=>out.push('['+t+']'));
    });
    return out.join(' ').replace(/\s+([,.!?;:])/g,'$1');
  }
  function normalizedSource(items) {return items.map(x=>x.text).join('\n');}
  const api={compact,words,reconstructLines,sentences,chunkText,buildUnits,computeSuggestion,editedText,makeUnit,normalizedSource,detectTable,isAdmin,isInterface};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  global.ReviewCore=api;
})(typeof window!=='undefined'?window:globalThis);
