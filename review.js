/* Standalone browser viewer built on PDF.js; main-branch cleaner remains untouched. */
(() => {
  'use strict';
  const C=window.ReviewCore,$=id=>document.getElementById(id),KEY='pdf-five-sentence-experiment-v1';
  let state={units:[],index:0,name:'',pdfSize:0,pageCount:0},pdf=null,pdfBlob=null,showPage=0;
  let busy=false,insertingAt=null,selectingInsertion=false,undo=[];
  function status(message){$('statusText').textContent=message;}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(label,css,fn){const n=el('button',css,label);n.type='button';n.addEventListener('click',fn);return n;}
  function heading(label){return el('p','eyebrow',label);}
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(_){status('Autosave unavailable: use Export project for a backup.');}}
  function current(){return state.units[state.index];}
  function hasChanges(u){return u.deleted.length>0 || Object.values(u.insertions).some(a=>a.length>0);}
  function checkpoint(u){undo.push({id:u.id,deleted:[...u.deleted],insertions:JSON.parse(JSON.stringify(u.insertions)),status:u.status,proposal:u.proposal?[...u.proposal]:null});if(undo.length>100)undo.shift();}
  function transact(fn){fn();save();render();}
  function viewer(page){
    if(!pdfBlob || !page || showPage===page)return;
    showPage=page;$('page').textContent='PDF page '+page;
    const f=el('iframe');f.title=`Original ${state.name}, PDF page ${page}`;f.src=pdfBlob+'#page='+page;
    $('viewer').replaceChildren(f);
  }
  function render(){
    const u=current(), reviewed=state.units.filter(x=>['accepted','skipped','flagged','reviewed','protected-reviewed'].includes(x.status)).length;
    $('fileLabel').textContent=state.name?`${state.name} · ${state.pageCount} PDF pages`:'No PDF loaded';
    $('progress').textContent=state.units.length?`${reviewed}/${state.units.length} resolved`: '—';
    $('counter').textContent=u?`${state.index+1} / ${state.units.length}`:'—';
    $('previous').disabled=!u||state.index===0;
    $('next').disabled=!u||state.index===state.units.length-1;
    if(u)viewer(u.page);
    const root=$('workspace');root.replaceChildren();if(!u){root.appendChild(el('div','empty','Open a PDF to start.'));return;}
    const topline=el('div','row');topline.appendChild(el('span','state '+(['accepted','skipped','flagged','reviewed','protected-reviewed'].includes(u.status)?'done':''),u.status.replace('-',' ')));topline.appendChild(el('span','sub',`PDF page ${u.page} · ${u.type}`));root.appendChild(topline);
    if(!['text','metadata','interface'].includes(u.type)){
      const warn=el('section','warning');warn.appendChild(el('h3','',u.type==='table'?'Table/layout needs checking':u.type==='visual'?'Image or diagram needs visual review':u.type==='links'?'Linked content must be checked':'Special content — preserved'));
      warn.appendChild(el('p','small',u.reason));warn.appendChild(heading('Detected source text or placeholder'));
      warn.appendChild(el('div','source',u.text));
      root.appendChild(warn);
      const choices=el('div','row buttons');choices.appendChild(button('Mark as checked','primary',()=>transact(()=>{checkpoint(u);u.status='protected-reviewed';})));choices.appendChild(button('Flag for attention','',()=>transact(()=>{checkpoint(u);u.status='flagged';})));choices.appendChild(button('Leave unresolved','',()=>transact(()=>{checkpoint(u);u.status='protected';})));root.appendChild(choices);
      root.appendChild(el('p','sub','This item cannot be shortened automatically. Your project export retains its source-page reference and warning.'));
      root.appendChild(button('Undo last edit','',restoreUndo));return;
    }
    const proposedCleanup=u.type==='metadata'||u.type==='interface';
    if(proposedCleanup){
      const alert=el('section','proposed-cleanup');
      alert.appendChild(el('strong','',u.type==='metadata'?'Suggested removal: document metadata':'Suggested removal: interface control'));
      alert.appendChild(el('p','sub',u.reason));root.appendChild(alert);
    }
    root.appendChild(heading('Original extracted source — read only'));root.appendChild(el('div','source',u.text));
    root.appendChild(el('p','sub',proposedCleanup?
      'The entire item is proposed for removal from your notes. Restore any word you want to retain. No removal happens until you approve.':
      'Suggestions are editable drafts. Click a crossed-out word to restore it, or another word to remove it. You decide the final wording.'));
    const controls=el('div','row buttons');
    const suggestButton=button(u.proposal!==null?'Recalculate suggestion':'Suggest shortening','',()=>{
      const proposed=proposedCleanup?C.words(u.text).map((_,i)=>i):C.computeSuggestion(u.text);
      if(!proposed.length){status('No safe cuts identified by conservative patterns. Select words yourself; nothing has been changed.');return;}
      transact(()=>{checkpoint(u);u.proposal=Array.from(new Set([...u.deleted,...proposed]));u.status='editing';});
    });
    controls.appendChild(suggestButton);
    if(u.proposal!==null){
      controls.appendChild(button('Reject suggestion · keep original','',()=>transact(()=>{
        checkpoint(u);u.proposal=null;u.status=hasChanges(u)?'editing':'skipped';
        status('Proposal rejected. Your previous manual edits, if any, were preserved.');
      })));
    }
    root.appendChild(controls);
    root.appendChild(heading(u.proposal!==null?'Edit proposed cuts — then approve':'Manual word editing'));
    const insertionTools=el('div','row buttons');
    const startInsert=button(selectingInsertion?'Cancel insertion':'Add my writing in [brackets]',selectingInsertion?'':'',()=>{
      selectingInsertion=!selectingInsertion;insertingAt=null;render();
    });
    insertionTools.appendChild(startInsert);
    if(selectingInsertion)insertionTools.appendChild(el('span','insert-instructions','Now click the word your addition should follow.'));
    root.appendChild(insertionTools);
    const wordBox=el('div','edited');const cut=new Set(u.proposal===null?u.deleted:u.proposal);
    C.words(u.text).forEach((w,i)=>{
      const wrapper=el('span','word-wrap');
      const word=button(w,'word'+(cut.has(i)?' cut':''),()=>{
        if(selectingInsertion){insertingAt=i;selectingInsertion=false;render();$('insertText')?.focus();return;}
        transact(()=>{
          checkpoint(u);const arr=u.proposal===null?[...u.deleted]:[...u.proposal];const set=new Set(arr);set.has(i)?set.delete(i):set.add(i);
          const next=[...set].sort((a,b)=>a-b);if(u.proposal===null)u.deleted=next;else u.proposal=next;u.status='editing';
        });
      });
      word.title=selectingInsertion?'Click to insert your own writing after this word':cut.has(i)?'Restore word':'Propose removing this word';
      word.setAttribute('aria-pressed',cut.has(i)?'true':'false');wrapper.appendChild(word);
      const inserts=u.insertions[String(i)]||[];
      inserts.forEach((entry,j)=>{const b=button('['+entry+'] ×','added',()=>transact(()=>{checkpoint(u);u.insertions[String(i)].splice(j,1);u.status='editing';}));b.title='Remove your own insertion';wrapper.appendChild(b);});
      wordBox.appendChild(wrapper);wordBox.appendChild(document.createTextNode(' '));
    });root.appendChild(wordBox);
    if(insertingAt!==null){
      const panel=el('div','insert-panel');panel.appendChild(el('strong','',`Insert after “${C.words(u.text)[insertingAt]}”`));
      const input=el('textarea');input.id='insertText';input.placeholder='Your own wording (brackets will be added automatically)';panel.appendChild(input);
      const row=el('div','row');row.appendChild(button('Insert [my wording]','primary',()=>{
        let v=input.value.trim();if(v.startsWith('[')&&v.endsWith(']'))v=v.slice(1,-1).trim();
        if(!v||v.length>2000){status('Type 1–2,000 characters of your own writing.');return;}
        transact(()=>{checkpoint(u);const key=String(insertingAt);(u.insertions[key]||(u.insertions[key]=[])).push(v);insertingAt=null;u.status='editing';});
      }));row.appendChild(button('Cancel','',()=>{insertingAt=null;render();}));panel.appendChild(row);root.appendChild(panel);
    }
    const actualCuts=u.proposal===null?u.deleted:u.proposal;
    const completeCut=actualCuts.length===C.words(u.text).length && actualCuts.length>0;
    root.appendChild(heading(completeCut?'Preview — section proposed for complete removal':'Preview — deletions shown as […]'));
    root.appendChild(el('div','preview',completeCut?'[Entire section will be omitted from reviewed notes if approved]':C.editedText(u,true,u.proposal===null?null:u.proposal)));
    const meta=el('p','sub','The original source is retained in the saved project. Existing source brackets are not treated as your additions.');root.appendChild(meta);
    const actions=el('div','row buttons');
    const approve=button(completeCut?'Approve proposed removal':u.proposal!==null?'Approve edited suggestion':'Approve my edited version','primary',()=>transact(()=>{
      checkpoint(u);if(u.proposal!==null){u.deleted=[...u.proposal];u.proposal=null;}u.status='accepted';insertingAt=null;selectingInsertion=false;
    }));
    approve.disabled=!hasChanges(u) && (u.proposal===null || u.proposal.length===0);
    actions.appendChild(approve);
    actions.appendChild(button('Skip · keep original','',()=>transact(()=>{checkpoint(u);u.proposal=null;u.deleted=[];u.insertions={};u.status='skipped';insertingAt=null;selectingInsertion=false;})));
    actions.appendChild(button('Flag for review','',()=>transact(()=>{checkpoint(u);u.status='flagged';u.proposal=null;})));
    actions.appendChild(button('Reset edits','danger',()=>{
      if(!confirm('Clear all edits and added writing for this review unit?'))return;
      transact(()=>{checkpoint(u);u.deleted=[];u.insertions={};u.proposal=null;u.status='unreviewed';insertingAt=null;selectingInsertion=false;});
    }));root.appendChild(actions);root.appendChild(button('Undo last edit','',restoreUndo));
  }
  function restoreUndo(){const snap=undo.pop();if(!snap)return status('No further edits to undo.');const u=state.units.find(x=>x.id===snap.id);if(!u)return;u.deleted=snap.deleted;u.insertions=snap.insertions;u.proposal=snap.proposal;u.status=snap.status;const index=state.units.findIndex(x=>x.id===snap.id);if(index>=0)state.index=index;save();render();}
  async function loadPdf(file){
    if(!file)return;if(!window.pdfjsLib)return status('PDF.js did not load. Check your internet connection and reload.');
    busy=true;$('pick').disabled=true;showPage=0;insertingAt=null;selectingInsertion=false;undo=[];
    if(pdfBlob)URL.revokeObjectURL(pdfBlob);
    pdfBlob=URL.createObjectURL(file);status('Reading PDF…');
    try{
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const data=await file.arrayBuffer();pdf=await pdfjsLib.getDocument({data:new Uint8Array(data),disableAutoFetch:true}).promise;
      const reports=[];
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i);const text=await page.getTextContent();
        const annotations=await page.getAnnotations();
        const list=await page.getOperatorList();
        const ops=pdfjsLib.OPS||{};const imageNames=[ops.paintImageXObject,ops.paintInlineImageXObject,ops.paintJpegXObject,ops.paintImageXObjectRepeat,ops.paintInlineImageXObjectGroup].filter(Number.isInteger);
        const imageCount=list.fnArray.filter(op=>imageNames.includes(op)).length;
        const graphicsCount=list.fnArray.filter(op=>op===ops.constructPath).length;
        reports.push({page:i,items:text.items,imageCount,graphicsCount,links:annotations.filter(a=>a.subtype==='Link').length});
        status(`Reading page ${i} of ${pdf.numPages}…`);
        if(i%2===0)await new Promise(requestAnimationFrame);
      }
      const fresh=C.buildUnits(reports);
      let recovered=0;
      // Preserve existing decisions if exact source text and page agree; never merge on index alone.
      if(state.name===file.name && state.pdfSize===file.size){
        const previous=new Map(state.units.map(u=>[`${u.page}|${u.type}|${u.text}`,u]));
        for(const unit of fresh){const old=previous.get(`${unit.page}|${unit.type}|${unit.text}`);if(old){unit.deleted=old.deleted;unit.insertions=old.insertions;unit.status=old.status;unit.proposal=old.proposal;recovered++;}}
      }
      state={name:file.name,pdfSize:file.size,pageCount:pdf.numPages,index:0,units:fresh};
      save();render();status(`Read all ${pdf.numPages} pages. ${fresh.length} review units; ${recovered} previous decisions restored.`);
    }catch(error){console.error(error);status('Could not read this PDF: '+error.message);}finally{busy=false;$('pick').disabled=false;}
  }
  function restoreProject(obj){
    if(!obj||!Array.isArray(obj.units)||!Number.isInteger(obj.pageCount))throw Error('Not a Source Review project');
    for(const u of obj.units){
      if(!u||typeof u.text!=='string'||!Number.isInteger(u.page)||!Array.isArray(u.deleted)||!u.insertions||typeof u.insertions!=='object')throw Error('Malformed review unit');
      u.deleted=u.deleted.filter(x=>Number.isInteger(x)&&x>=0&&x<C.words(u.text).length);
      u.proposal=Array.isArray(u.proposal)?u.proposal.filter(x=>Number.isInteger(x)&&x>=0&&x<C.words(u.text).length):null;
    }
    return {units:obj.units,index:Math.max(0,Math.min(obj.units.length-1,Number(obj.index)||0)),name:String(obj.name||''),pdfSize:Number(obj.pdfSize)||0,pageCount:obj.pageCount};
  }
  function exportNotes(){
    if(!state.units.length)return status('Open a PDF first.');
    const completed=state.units.filter(u=>['accepted','skipped','flagged','reviewed','protected-reviewed'].includes(u.status));
    if(!completed.length)return status('Review at least one item before exporting notes.');
    const excluded=completed.filter(u=>u.status==='accepted' && u.deleted.length===C.words(u.text).length && u.deleted.length>0);
    const sections=completed.filter(u=>!excluded.includes(u)).map(u=>{
      const view=['text','metadata','interface'].includes(u.type)?(u.status==='skipped'?u.text:C.editedText(u,true)): '[PROTECTED CONTENT — consult original PDF] '+u.text;
      return `PDF PAGE ${u.page} | ${u.type.toUpperCase()} | ${u.status.toUpperCase()}\nSOURCE: ${state.name}\nORIGINAL:\n${u.text}\n\nYOUR REVIEWED VERSION:\n${view}\n${u.reason?`NOTE: ${u.reason}\n`:''}`;
    });
    download('source-review-notes.txt',sections.join('\n\n-------------------------------------\n\n'),'text/plain;charset=utf-8');
    status(`Exported ${sections.length} reviewed items; omitted ${excluded.length} sections you explicitly approved removing. Original wording remains in the project backup.`);
  }
  $('pick').addEventListener('change',async e=>{await loadPdf(e.target.files[0]);e.target.value='';});
  $('previous').addEventListener('click',()=>{if(state.index>0)transact(()=>{state.index--;insertingAt=null;selectingInsertion=false;});});
  $('next').addEventListener('click',()=>{if(state.index<state.units.length-1)transact(()=>{state.index++;insertingAt=null;selectingInsertion=false;});});
  $('save').addEventListener('click',()=>{
    if(!state.units.length)return status('Open a PDF first.');
    download('five-sentence-review-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');status('Project saved; PDF itself is not embedded.');
  });
  $('notes').addEventListener('click',exportNotes);
  $('restore').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const fresh=restoreProject(JSON.parse(await file.text()));if(state.units.length&&!confirm('Replace current review project? Export your project first if needed.'))return;state=fresh;showPage=0;undo=[];if(pdfBlob){URL.revokeObjectURL(pdfBlob);pdfBlob=null;}pdf=null;$('viewer').replaceChildren(el('p','empty','Reopen the original PDF to reconnect the preview.'));save();render();status('Project restored. Open the same PDF to reconnect its viewer.');}
    catch(err){status('Cannot import project: '+err.message);}finally{e.target.value='';}
  });
  try{const saved=localStorage.getItem(KEY);if(saved)state=restoreProject(JSON.parse(saved));}catch(_){/* no storage or malformed backup */}
  render();
})();
