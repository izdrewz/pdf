/* Source Review v3 — isolated comparison version, no main-branch dependencies. */
(()=>{'use strict';
const C=window.ReviewCore,$=id=>document.getElementById(id),KEY='source-review-v3';
let state={version:3,name:'',pdfSize:0,pageCount:0,index:0,units:[],legacyArchive:null,unmatchedPrior:[]};
let pdfBlob=null,showPage=0,pdfDoc=null,lastReports=null,selectionAnchor=null,insertAfter=null,insertMode=false,undo=[];
const resolved=new Set(['accepted','skipped','flagged','protected-reviewed']);
const content=()=>state.units.filter(u=>u.type!=='context');
const current=()=>content()[state.index];
const el=(tag,cls='',text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const btn=(txt,fn,cls='')=>{const n=el('button',cls,txt);n.type='button';n.addEventListener('click',fn);return n;};
const trimWords=(u,arr)=>Array.from(new Set((arr||[]).filter(x=>Number.isInteger(x)&&x>=0&&x<C.words(u.text).length))).sort((a,b)=>a-b);
const allRemoved=u=>C.words(u.text).length>0 && u.deleted.length===C.words(u.text).length;
const proposalRemoved=u=>C.words(u.text).length>0 && u.proposal?.length===C.words(u.text).length;
const isCuttable=u=>['text','metadata','interface','guidance','planner','planner-table','table'].includes(u.type);
const hasEdits=u=>u.deleted.length>0 || Object.values(u.insertions).some(a=>a?.length);
function status(s){$('statusText').textContent=s;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));const date=new Date();$('savedState').textContent='Saved in this browser '+date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});return true;}catch(e){$('savedState').textContent='Autosave failed — export backup';status('Local storage is unavailable/full. Export a backup now.');return false;}}
function checkpoint(u){undo.push({id:u.id,deleted:[...u.deleted],insertions:JSON.parse(JSON.stringify(u.insertions)),proposal:u.proposal?[...u.proposal]:null,status:u.status});if(undo.length>100)undo.shift();}
function act(fn){fn();save();render();}
function download(name,text,mime){const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function openPdfPage(page){if(!pdfBlob||showPage===page)return;showPage=page;$('page').textContent='PDF page '+page;const f=el('iframe');f.title='Original '+state.name+', page '+page;f.src=pdfBlob+'#page='+page;$('viewer').replaceChildren(f);}
function sourceInfo(u){const row=el('div','metaRow');row.append(el('span','state '+(resolved.has(u.status)?'done':''),u.status.replaceAll('-',' ')),el('span','sub','PDF page '+u.page+' · '+u.type));if(u.pageLinks)row.append(el('span','sub',u.pageLinks+' source links on this page'));return row;}
function label(text){return el('p','eyebrow',text);}
function elementSection(type,msg){const box=el('section',type);box.append(el('strong','',msg));return box;}
function showProposal(u){const a=u.proposal===null?u.deleted:u.proposal,all=C.words(u.text).length;
 const count=el('span','sub',a.length+' of '+all+' words currently marked for removal');return count;}
function reviewDecision(u,newStatus){act(()=>{checkpoint(u);if(newStatus==='skipped'){u.deleted=[];u.insertions={};u.proposal=null;}if(newStatus==='accepted'&&u.proposal!==null){u.deleted=trimWords(u,u.proposal);u.proposal=null;}if(newStatus==='flagged')u.proposal=null;u.status=newStatus;selectionAnchor=null;insertAfter=null;insertMode=false;});}
function editor(u,root){
 const draft=u.proposal===null?u.deleted:u.proposal;
 const cut=new Set(draft),w=C.words(u.text);
 const tools=el('div','row editorTools');
 tools.append(btn('Remove whole passage',()=>act(()=>{checkpoint(u);u.proposal=w.map((_,i)=>i);u.status='editing';}),'action-red'));
 tools.append(btn('Restore all words',()=>act(()=>{checkpoint(u);u.proposal=[];u.deleted=[];u.status='editing';})));
 tools.append(btn(insertMode?'Cancel bracket insertion':'Add my writing in [brackets]',()=>{insertMode=!insertMode;insertAfter=null;render();}));
 root.append(tools);
 root.append(el('p','sub instructions',insertMode?'Click a word after which your writing should appear.':'Click words to change proposed cuts. Shift-click another word to remove or restore a whole range.'));
 const holder=el('div','edited');holder.setAttribute('aria-label','Word-by-word editing with shift-click ranges');
 w.forEach((s,i)=>{
   const word=btn(s,ev=>{
     if(insertMode){insertAfter=i;insertMode=false;render();$('insertText')?.focus();return;}
     act(()=>{checkpoint(u);const arr=u.proposal===null?[...u.deleted]:[...u.proposal];const set=new Set(arr);
       if(ev?.shiftKey && selectionAnchor!==null){const low=Math.min(i,selectionAnchor),hi=Math.max(i,selectionAnchor);const deleteRange=!set.has(i);for(let n=low;n<=hi;n++)deleteRange?set.add(n):set.delete(n);}
       else{set.has(i)?set.delete(i):set.add(i);}
       const next=trimWords(u,[...set]);if(u.proposal===null)u.deleted=next;else u.proposal=next;
       u.status='editing';selectionAnchor=i;});
   },'word'+(cut.has(i)?' cut':''));
   word.title='Click to toggle this word; Shift-click to toggle a range';word.setAttribute('aria-pressed',cut.has(i)?'true':'false');holder.append(word,document.createTextNode(' '));
   (u.insertions[String(i)]||[]).forEach((entry,j)=>holder.append(btn('['+entry+'] ×',()=>act(()=>{checkpoint(u);u.insertions[String(i)].splice(j,1);u.status='editing';}),'added')));
 });root.append(holder);
 if(insertAfter!==null){const box=el('div','insert-panel');box.append(el('strong','','Insert your wording after “'+w[insertAfter]+'”'));const inp=el('textarea');inp.id='insertText';inp.placeholder='Your own wording';box.append(inp);
 box.append(btn('Insert [bracketed writing]',()=>{let s=inp.value.trim();if(s.startsWith('[')&&s.endsWith(']'))s=s.slice(1,-1).trim();if(!s||s.length>2000){status('Enter between 1 and 2,000 characters.');return;}act(()=>{checkpoint(u);(u.insertions[String(insertAfter)]??=[]).push(s);u.status='editing';insertAfter=null;});},'primary'),btn('Cancel',()=>{insertAfter=null;render();}));root.append(box);}
 const preview=el('div','previewbox');preview.append(label('Live preview — nothing is removed until approval'),el('div','preview',draft.length===w.length&&draft.length>0?'[Whole passage proposed for removal]':C.editedText(u,true,u.proposal)));
 root.append(preview);
}
function render(){
 const entries=content(),u=current(),done=entries.filter(x=>resolved.has(x.status)).length;
 $('fileLabel').textContent=state.name?`${state.name} · ${state.pageCount} PDF pages`:'No PDF loaded';
 $('progress').textContent=entries.length?`${done}/${entries.length} resolved`:'—';
 $('counter').textContent=u?`${state.index+1} / ${entries.length}`:'—';
 $('previous').disabled=!u||state.index===0;$('next').disabled=!u||state.index===entries.length-1;
 $('nextPending').disabled=!entries.some((x,i)=>i>state.index&&!resolved.has(x.status));
 if(u)openPdfPage(u.page);
 const root=$('workspace');root.replaceChildren();
 if(!u){root.append(el('p','empty',state.legacyArchive?'Your old decisions were imported. Open the original PDF to rebuild the text groups without losing your edits.':'Open a PDF to begin.'));return;}
 root.append(sourceInfo(u));
 if(state.unmatchedPrior?.length){const w=elementSection('warning',`${state.unmatchedPrior.length} earlier reviewed items could not be matched exactly after regrouping.`);w.append(el('p','sub','Your previous project is retained inside the backup. Please recheck regrouped tables; nothing was silently approved.'));root.append(w);}
 if(u.heading)root.append(el('div','chapter','Section: '+u.heading));
 const cleanup=['metadata','interface','guidance','planner','planner-table'].includes(u.type);
 if(cleanup){const b=elementSection('proposed-cleanup','Suggested removal: '+(u.type==='planner-table'?'study timetable':u.type==='planner'?'study-planning instructions':u.type==='guidance'?'non-notes instructions':u.type==='metadata'?'print metadata':'interface controls'));b.append(el('p','sub',u.reason));root.append(b);}
 if(u.type==='visual'||u.type==='unknown'){
   const b=elementSection('warning',u.type==='visual'?'Image content needs visual review':'No readable text found');b.append(el('p','sub',u.reason));root.append(b);
   const a=el('div','row compact-actions');a.append(btn('Checked against PDF',()=>reviewDecision(u,'protected-reviewed'),'primary'),btn('Flag to return to',()=>reviewDecision(u,'flagged')),btn('Leave unresolved',()=>reviewDecision(u,'protected')));root.append(a);return;
 }
 if(u.type==='table'){
   const b=elementSection('warning','Possible table: original layout needs checking');b.append(el('p','sub','Do not trust the flattened cell order. You can choose to remove the entire section, but the app will not automatically delete an academic table.'));root.append(b);
 }
 const detail=el('details','original-detail');detail.open=!cleanup&&u.type!=='table';const summary=el('summary','',cleanup?'View original text (unchanged)':'Original extracted source');detail.append(summary,el('div','source',u.text));root.append(detail);
 const draft=u.proposal===null?u.deleted:u.proposal,complete=draft.length===C.words(u.text).length&&draft.length>0;
 const row=el('div','row compact-actions');
 if(complete){row.append(btn('Approve removing this section',()=>reviewDecision(u,'accepted'),'primary'));}
 else if(draft.length||hasEdits(u)){row.append(btn('Approve edited version',()=>reviewDecision(u,'accepted'),'primary'));}
 row.append(btn('Keep original',()=>reviewDecision(u,'skipped')));
 row.append(btn('Flag for review',()=>reviewDecision(u,'flagged')));
 root.append(row);
 if(u.type==='planner-table'){root.append(el('p','sub','This planner table was grouped as a complete section; no word-by-word table repair is required.'));}
 const expand=el('details','advanced');expand.open=(u.type==='text' && !resolved.has(u.status))||u.status==='editing';
 expand.append(el('summary','',cleanup?'Change proposed removal / restore words':u.type==='table'?'Optional manual edits to flattened table':'Edit suggested cuts / selected words'));
 const pane=el('div','advancedPane');
 const commands=el('div','row');commands.append(btn('Suggest shortening',()=>{const proposed=cleanup?C.words(u.text).map((_,i)=>i):C.computeSuggestion(u.text);if(!proposed.length){status('No safe deletion-only suggestion for this passage. You can select ranges or remove the whole passage.');return;}act(()=>{checkpoint(u);u.proposal=trimWords(u,[...u.deleted,...proposed]);u.status='editing';});}));
 if(u.proposal!==null)commands.append(btn('Reject suggestion',()=>act(()=>{checkpoint(u);u.proposal=null;u.status=hasEdits(u)?'editing':'unreviewed';})));
 commands.append(showProposal(u));pane.append(commands);editor(u,pane);
 pane.append(btn('Undo last edit',undoLast),btn('Reset this item',()=>{if(!confirm('Clear this item’s edits? This cannot change the original source PDF.'))return;act(()=>{checkpoint(u);u.deleted=[];u.proposal=null;u.insertions={};u.status='unreviewed';});}));
 expand.append(pane);root.append(expand);
 if(!complete&&!draft.length&&!hasEdits(u))root.append(el('p','sub','No changes selected. Keep original, flag, or propose removing the passage.'));
}
function undoLast(){const s=undo.pop();if(!s){status('Nothing to undo in this session.');return;}const u=state.units.find(x=>x.id===s.id);if(!u)return;Object.assign(u,{deleted:s.deleted,insertions:s.insertions,status:s.status,proposal:s.proposal});const target=content().indexOf(u);if(target>=0)state.index=target;save();render();}
function migrate(fresh,previous){
 const from=(previous?.units||[]).filter(u=>resolved.has(u.status)||hasEdits(u)||u.status==='editing');
 const map=new Map();for(const u of fresh){const k=u.page+'|'+C.compact(u.text).toLowerCase();if(!map.has(k))map.set(k,[]);map.get(k).push(u);}
 const unmatched=[];let restored=0;
 for(const old of from){const k=old.page+'|'+C.compact(old.text).toLowerCase();const matches=map.get(k)||[];
   if(matches.length!==1 || C.words(old.text).length!==C.words(matches[0].text).length){unmatched.push({page:old.page,type:old.type,text:old.text,status:old.status});continue;}
   const u=matches[0];u.deleted=trimWords(u,old.deleted);u.insertions=JSON.parse(JSON.stringify(old.insertions||{}));u.proposal=old.proposal===null?null:trimWords(u,old.proposal);u.status=old.status;restored++;
 }
 return{restored,unmatched};
}
async function loadPdf(file){
 if(!file)return;if(!window.pdfjsLib){status('PDF.js failed to load; check internet connection.');return;}
 $('pick').disabled=true;showPage=0;insertAfter=null;insertMode=false;undo=[];
 if(pdfBlob)URL.revokeObjectURL(pdfBlob);pdfBlob=URL.createObjectURL(file);
 status('Reading the actual PDF and checking layout…');
 try{
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   pdfDoc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableAutoFetch:true}).promise;
   const reports=[];for(let p=1;p<=pdfDoc.numPages;p++){
     const page=await pdfDoc.getPage(p),t=await page.getTextContent(),annotations=await page.getAnnotations(),ops=await page.getOperatorList(),o=pdfjsLib.OPS||{};
     const img=[o.paintImageXObject,o.paintInlineImageXObject,o.paintJpegXObject,o.paintImageXObjectRepeat,o.paintInlineImageXObjectGroup].filter(Number.isInteger);
     reports.push({page:p,items:t.items,imageCount:ops.fnArray.filter(x=>img.includes(x)).length,links:annotations.filter(x=>x.subtype==='Link').length});
     if(p%3===0){status(`Reading ${p}/${pdfDoc.numPages} pages…`);await new Promise(requestAnimationFrame);}
   }
   lastReports=reports;
   const fresh=C.buildUnits(reports),prior=state.name===file.name&&state.pdfSize===file.size?state:null;
   const archive=state.legacyArchive||((prior&&prior.version!==3)?prior:null);
   const previous=prior?.units?.length?prior:(prior?.legacyArchive?.units?prior.legacyArchive:null);
   const {restored,unmatched}=previous?migrate(fresh,previous):{restored:0,unmatched:[]};
   const earlierWarnings=(previous?.version===3?previous.unmatchedPrior||[]:[]);
   state={version:3,name:file.name,pdfSize:file.size,pageCount:pdfDoc.numPages,index:0,units:fresh,legacyArchive:archive,unmatchedPrior:[...earlierWarnings,...unmatched]};
   save();render();status(`Opened ${pdfDoc.numPages} pages · ${content().length} review items · restored ${restored} decisions. ${unmatched.length} previous decisions need rechecking.`);
 }catch(e){console.error(e);status('Could not open this PDF: '+e.message);}finally{$('pick').disabled=false;}
}
function importProject(obj){if(!obj||!Array.isArray(obj.units))throw Error('Not a Source Review project');
 if(!obj.name||!Number.isInteger(obj.pageCount))throw Error('Missing source details');
 return obj;
}
function notesSections(){const all=state.units;const selected=all.filter(u=>resolved.has(u.status));
 const removed=selected.filter(u=>u.status==='accepted'&&allRemoved(u));
 const sections=selected.filter(u=>!removed.includes(u)).map(u=>({page:u.page,heading:u.heading||'',type:u.type,status:u.status,
   text:u.status==='skipped'?u.text:isCuttable(u)?C.editedText(u,true):'[Visual/table check needed — consult original PDF] '+u.text}));
 return{sections,removed,all:selected.length};}
function exportNotes(){if(!content().length)return status('Open PDF first.');const data=notesSections();if(!data.all)return status('Review something first.');
 download('reviewed-university-notes.txt',data.sections.map(u=>`PDF PAGE ${u.page} | ${u.type} | ${u.status}\n${u.heading?u.heading+'\n':''}${u.text}`).join('\n\n------------------------\n\n'),'text/plain;charset=utf-8');status(`Exported ${data.sections.length} kept sections; ${data.removed.length} approved removals excluded from notes. All originals remain in project backup.`);}
function previewAll(){const modal=$('notesDialog'),host=$('allNotes'),data=notesSections();host.replaceChildren();
 $('notesCount').textContent=`${data.all} resolved items · ${data.sections.length} included · ${data.removed.length} approved removals · ${content().length-data.all} awaiting review. Only resolved items appear below.`;
 if(!data.sections.length)host.append(el('p','sub','No reviewed notes yet. Approve a change or choose Keep original to include it here.'));
 for(const entry of data.sections){const card=el('section','noteCard');card.append(el('span','sub',`PDF p.${entry.page} · ${entry.type} · ${entry.status}`));if(entry.heading)card.append(el('h3','',entry.heading));card.append(el('p','',entry.text));host.append(card);}
 if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');}
function nav(offset){const units=content();if(!units.length)return;state.index=Math.min(Math.max(0,state.index+offset),units.length-1);insertAfter=null;insertMode=false;selectionAnchor=null;save();render();$('workspace').scrollTop=0;}
$('pick').addEventListener('change',async e=>{await loadPdf(e.target.files?.[0]);e.target.value='';});
$('previous').addEventListener('click',()=>nav(-1));$('next').addEventListener('click',()=>nav(1));
$('nextPending').addEventListener('click',()=>{const all=content(),idx=all.findIndex((u,i)=>i>state.index&&!resolved.has(u.status));if(idx>=0)nav(idx-state.index);});
$('save').addEventListener('click',()=>{if(!state.units.length && !state.legacyArchive)return status('Open PDF or import a project first.');download('source-review-v3-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');status('Full project backup exported, including original text and previous decisions.');});
$('notes').addEventListener('click',exportNotes);$('previewAll').addEventListener('click',previewAll);$('closePreview').addEventListener('click',()=>$('notesDialog').close());$('closePreviewBottom').addEventListener('click',()=>$('notesDialog').close());$('exportFromPreview').addEventListener('click',exportNotes);
$('restore').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;
 try{const src=importProject(JSON.parse(await file.text()));if(state.units.length&&!confirm('Import previous review decisions? Export a backup first if necessary.'))return;
   if(src.version===3){state=src;status('v3 project restored. Reopen PDF to reconnect original viewer.');}
   else{state={version:3,name:src.name,pdfSize:src.pdfSize,pageCount:src.pageCount,index:0,units:[],legacyArchive:src,unmatchedPrior:[]};status('Earlier project imported with all original decisions. Open the same PDF to rebuild and safely transfer exact matches.');}
   if(pdfBlob){URL.revokeObjectURL(pdfBlob);pdfBlob=null;}showPage=0;lastReports=null;save();render();
 }catch(err){status('Import failed: '+err.message);}finally{e.target.value='';}});
try{const saved=localStorage.getItem(KEY);if(saved){const src=JSON.parse(saved);if(src?.version===3&&Array.isArray(src.units))state=src;}}catch(_){/* fresh browser */}
render();
})();
