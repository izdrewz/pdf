/* Source Review v3: preservation-first PDF extraction + editable deletion proposals.
 * No text is silently discarded: headings are stored as unit headings, tables
 * are stored as complete raw lines and visuals are flagged when images exist.
 */
(function(global){
'use strict';
const compact=x=>String(x||'').replace(/\s+/g,' ').trim();
const words=t=>String(t||'').match(/\S+/g)||[];
const clean=x=>String(x).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').toLowerCase();
const ADMIN=/^(?:unless otherwise stated,?\s*copyright|copyright\s*[©(]|©\s*20\d{2}|all rights reserved|printable page generated|printed on|page generated)/i;
const CONTROLS=/^(?:save\s+reset|save|reset|reveal discussion|hide discussion|show description|view interactive version|maximi[sz]e|allow about\s+\d+\s*(?:minutes?|hours?|hrs?))$/i;
const HEADING=/^(?:\d+(?:\.\d+)*\s+[A-Z]|activity\s+\d+(?:\.\d+)?\b|video\s+\d|figure\s+\d|introduction$|discussion$|key questions$|health as (?:not-ill|physical|social|function|psychosocial)|categories of health|to sum up|case study:)/i;
const NOTE_GUIDANCE=/^(?:watch (?:video|videos)|insert your (?:three|\d+)|remember to return to|there are \d+ activities in this study session|in this study session you (?:will|should)|you (?:should|will) allow approximately \d+|allow (?:about|approximately) \d+)/i;
const PHRASES=[{tokens:['in','order','to'],count:2},{tokens:['it','is','important','to','note','that'],count:6},{tokens:['it','should','be','noted','that'],count:5},{tokens:['the','fact','that'],count:2},{tokens:['you','may','find','that'],count:4},{tokens:['as','already','noted'],count:3}];
function reconstructLines(items){
  const lines=[];
  for(const item of (items||[])){
    if(!item||!item.str||!item.str.trim()||!item.transform)continue;
    const x=+item.transform[4],y=+item.transform[5],height=Math.abs(item.height||item.transform[3]||9);
    let line=lines.find(l=>Math.abs(l.y-y)<=Math.max(2.4,Math.min(4.2,height*.35)));
    if(!line){line={x,y,height,items:[]};lines.push(line);}
    line.items.push({x,width:Math.max(0,+item.width||0),text:item.str});line.x=Math.min(x,line.x);line.height=Math.max(line.height,height);
  }
  lines.sort((a,b)=>b.y-a.y||a.x-b.x);
  for(const line of lines){
    line.items.sort((a,b)=>a.x-b.x);
    let out='',prev=null,gaps=0;
    for(const item of line.items){
      const gap=prev?item.x-(prev.x+prev.width):0;
      if(prev && gap>23)gaps++;
      if(prev && gap>Math.max(1.6,line.height*.14) && !/\s$/.test(out) && !/^\s/.test(item.text))out+=' ';
      out+=item.text;prev=item;
    }
    line.text=compact(out);line.columns=gaps+1;
  }
  return lines.filter(x=>x.text);
}
function sentences(text){
  const s=compact(text);if(!s)return [];
  if(typeof Intl!=='undefined'&&Intl.Segmenter){
    return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(s)].map(x=>x.segment.trim()).filter(Boolean);
  }
  return s.match(/[^.!?]+(?:[.!?]+[”’"')\]]*)?(?=\s|$)/g)?.map(x=>x.trim()).filter(Boolean)||[s];
}
function chunkText(s,n=5){const seg=sentences(s),out=[];for(let i=0;i<seg.length;i+=n)out.push(seg.slice(i,i+n).join(' '));return out;}
function makeUnit(type,page,text,reason='',heading=''){
 const id='u-'+page+'-'+Math.random().toString(36).slice(2,10);
 const u={id,type,page,text,reason,heading,deleted:[],insertions:{},proposal:null,status:['text','metadata','interface','guidance','planner','planner-table'].includes(type)?'unreviewed':'protected',history:[]};
 if(['metadata','interface','guidance','planner','planner-table'].includes(type))u.proposal=words(text).map((_,i)=>i);
 return u;
}
function classify(t){
 if(ADMIN.test(t))return 'metadata';
 if(CONTROLS.test(t))return 'interface';
 if(NOTE_GUIDANCE.test(t))return 'guidance';
 return 'text';
}
function headingText(t){return (HEADING.test(t)&&t.length<=140) || /^Learning Guide \d\b/i.test(t) || /^Dr [A-Z][^.!?]{3,110}$/.test(t) || /^Health as (?:not|\w)/i.test(t);}
function buildUnits(reports){
 const units=[];let continuingPlanner=false;
 for(const report of reports){
   const page=report.page,lines=report.lines||reconstructLines(report.items||[]);
   let prose=[],pendingHeading='',wasPlannerIntro=false,table=[],tableMode=continuingPlanner;
   const put=u=>{units.push(u);return u;};
   const flush=()=>{if(!prose.length)return;const str=compact(prose.join(' '));const type=classify(str);
     const chunks=type==='text'?chunkText(str):[str];
     for(const [j,ch] of chunks.entries())put(makeUnit(type,page,ch,
       type==='guidance'?'Study instructions rather than academic notes; proposed for removal, subject to your approval.':'',j===0?pendingHeading:''));
     prose=[];pendingHeading='';};
   const flushPlannerIntro=()=>{if(!wasPlannerIntro)return;flush();wasPlannerIntro=false;};
   const flushTable=()=>{if(!table.length)return;const combined=table.map(x=>x.text).join('\n');
     put(makeUnit('planner-table',page,combined,'Study timetable/activity planner. Proposed for removal from notes; preserve the original PDF and review before approval.'));
     table=[];};
   for(let i=0;i<lines.length;i++){
     const line=lines[i],t=line.text;
     if(tableMode){
       if(/^Introduction\b/i.test(t) || /^Welcome to Learning Guide\b/i.test(t)){
         flushTable();tableMode=false;continuingPlanner=false;
       }else{table.push(line);continue;}
     }
     // A planner is an administrative section: collect the introduction and all
     // table rows, including text fragments beyond multi-column line bounds.
     if(/^Activity planner$/i.test(t)){
       flush();if(pendingHeading){put(makeUnit('context',page,pendingHeading,'Source heading or authorship retained.'));pendingHeading='';}wasPlannerIntro=true;prose.push(t);continue;
     }
     if(wasPlannerIntro && (/^Study session\s+Activity\b/i.test(t)||/^Study session\s+1\b/i.test(t))){
       const introduction=compact(prose.join(' '));
       put(makeUnit('planner',page,introduction,'Study-planning instructions; proposed for complete removal from notes.'));
       prose=[];wasPlannerIntro=false;tableMode=true;continuingPlanner=true;table.push(line);continue;
     }
     if(wasPlannerIntro){prose.push(t);continue;}
     if(classify(t)==='metadata'){
       flush();const parts=[t];while(i+1<lines.length && classify(lines[i+1].text)==='metadata')parts.push(lines[++i].text);
       put(makeUnit('metadata',page,parts.join(' '),'Copyright and printable timestamps are not study-note material. Suggested removal only.'));continue;
     }
     if(classify(t)==='interface'){
       flush();put(makeUnit('interface',page,t,'Printed interface control rather than notes content; proposed for removal.'));continue;
     }
     if(headingText(t)){
       flush(); if(pendingHeading){put(makeUnit('context',page,pendingHeading,'Heading/source label kept with the source, not a separate shortening task.'));}
       pendingHeading=t;continue;
     }
     // Other genuine tables: require two or more consecutive multi-column
     // text lines. Keep their text intact and flag for review (no auto cuts).
     if((line.columns||0)>=3 && i+1<lines.length && (lines[i+1].columns||0)>=2){
       flush();const group=[line];while(i+1<lines.length && ((lines[i+1].columns||0)>=2 || Math.abs(lines[i+1].y-lines[i].y)<25))group.push(lines[++i]);
       put(makeUnit('table',page,group.map(x=>x.text).join('\n'),'Potential multi-column text/table; check cells against original before deciding.'));continue;
     }
     // Wrap isolated fragments with context instead of asking user to shorten
     // a single word. Preserve complete text, not a silent omission.
     prose.push(t);
   }
   if(tableMode){flushTable();continuingPlanner=true;}
   else continuingPlanner=false;
   flushPlannerIntro();flush();
   if(pendingHeading)put(makeUnit('context',page,pendingHeading,'Heading retained for source context.'));
   if((report.imageCount||0)>0)put(makeUnit('visual',page,`Image or diagram on PDF page ${page}.`,
      'The PDF contains image-based content. The app cannot verify its internal wording; inspect the original page.'));
   // Links are page metadata, not an extra review task for every hyperlink.
   const first=units.find(u=>u.page===page);
   if(first)first.pageLinks=report.links||0;
   if(!lines.length && !(report.imageCount||0))put(makeUnit('unknown',page,'No selectable text found.','Page could be scanned or blank; inspect manually.'));
 }
 return units;
}
function computeSuggestion(text){
 const list=words(text),w=list.map(clean),deletes=new Set();
 for(const p of PHRASES){for(let i=0;i<=w.length-p.tokens.length;i++)if(p.tokens.every((x,j)=>x===w[i+j]))for(let j=0;j<p.count;j++)deletes.add(i+j);}
 return [...deletes].sort((a,b)=>a-b);
}
function editedText(u,omissions=true,override=null){
 const list=words(u.text),deleted=new Set(override===null?u.deleted:override);const out=[];let inCut=false;
 for(let i=0;i<list.length;i++){
   if(deleted.has(i)){if(omissions&&!inCut)out.push('[…]');inCut=true;}
   else{out.push(list[i]);inCut=false;}
   const own=u.insertions[String(i)];if(Array.isArray(own))for(const s of own)out.push('['+s+']');
 }
 return out.join(' ').replace(/\s+([,.!?;:])/g,'$1');
}
const api={compact,words,reconstructLines,sentences,chunkText,buildUnits,computeSuggestion,editedText,makeUnit,classify};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
global.ReviewCore=api;
})(typeof window!=='undefined'?window:globalThis);
