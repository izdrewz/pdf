const pdfInput = document.getElementById("pdfInput");
const originalViewer = document.getElementById("originalViewer");
const editableViewer = document.getElementById("editableViewer");
const fileTitle = document.getElementById("fileTitle");
const fileStatus = document.getElementById("fileStatus");
const patternChips = document.getElementById("patternChips");
const matchesList = document.getElementById("matchesList");
const selectedInfo = document.getElementById("selectedInfo");
const exportHtml = document.getElementById("exportHtml");
const exportState = document.getElementById("exportState");
const importState = document.getElementById("importState");
const printClean = document.getElementById("printClean");
const rescanPatterns = document.getElementById("rescanPatterns");
const deleteGroup = document.getElementById("deleteGroup");
const hideGroup = document.getElementById("hideGroup");
const undoLast = document.getElementById("undoLast");
const deleteSelected = document.getElementById("deleteSelected");
const toggleCollapseSelected = document.getElementById("toggleCollapseSelected");
const deleteNearbyMcq = document.getElementById("deleteNearbyMcq");
const insertBlock = document.getElementById("insertBlock");
const insertTitle = document.getElementById("insertTitle");
const insertText = document.getElementById("insertText");
const plainMode = document.getElementById("plainMode");
const syncScroll = document.getElementById("syncScroll");
const showDeleted = document.getElementById("showDeleted");
const loadNextPage = document.getElementById("loadNextPage");
const loadAllPagesSlowly = document.getElementById("loadAllPagesSlowly");
const stopLoadingPages = document.getElementById("stopLoadingPages");

const STORAGE_KEY = "pdf-split-cleaner-state-v2";
let pdfDoc = null;
let currentFileName = "cleaned-pdf";
let selectedEl = null;
let activeGroup = "hours";
let matches = [];
let undoStack = [];
let renderScale = 1.0;
let loadedPages = 0;
let isLoadingAll = false;
let stopRequested = false;

const groups = [
  { id: "hours", label: "hours / time", className: "group-hours", test: text => /\b(\d+\s*(hours?|hrs?|minutes?|mins?)|spend\s+\d+|\d+\s*(h|m)\b)/i.test(text) },
  { id: "you", label: "you / conversational", className: "group-you", test: text => /\b(you|your|you'll|you’re|you are|let's|we will|now you|try to)\b/i.test(text) },
  { id: "activities", label: "activities", className: "group-activity", test: text => /\b(activity|task|exercise|reflection|discussion|workbook|study session|learning outcome|complete|read|watch|listen)\b/i.test(text) },
  { id: "numbers", label: "numbers", className: "group-number", test: text => /\b\d+(\.\d+)?\b/.test(text) },
  { id: "questions", label: "questions", className: "group-question", test: text => /\?|\b(question|quiz|multiple choice|choose|select|answer)\b/i.test(text) },
  { id: "mcq", label: "MCQ options", className: "group-mcq", test: text => /^\s*([A-Da-d]|[ivx]+|\d+)[\).:-]\s+/.test(text) || /\b(true|false)\b/i.test(text) },
  { id: "images", label: "images / art", className: "", test: (_text, el) => el.classList.contains("image-item") },
  { id: "clutter", label: "text boxes / clutter", className: "", test: text => /\b(tip|note|remember|hint|box|figure|caption|screen|click|menu|icon)\b/i.test(text) }
];

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

pdfInput.addEventListener("change", loadPdf);
loadNextPage?.addEventListener("click", loadNext);
loadAllPagesSlowly?.addEventListener("click", loadAllSlowly);
stopLoadingPages?.addEventListener("click", () => { stopRequested = true; isLoadingAll = false; setStatus("Stopping after current page…"); });
rescanPatterns.addEventListener("click", scanPatterns);
deleteGroup.addEventListener("click", () => applyToActiveGroup("delete"));
hideGroup.addEventListener("click", () => applyToActiveGroup("hide"));
undoLast.addEventListener("click", undo);
deleteSelected.addEventListener("click", () => selectedEl && deleteElements([selectedEl]));
toggleCollapseSelected.addEventListener("click", toggleSelectedCollapse);
deleteNearbyMcq.addEventListener("click", deleteNearbyOptions);
insertBlock.addEventListener("click", insertCollapsibleBlock);
exportHtml.addEventListener("click", downloadHtml);
exportState.addEventListener("click", downloadState);
importState.addEventListener("change", importEditState);
printClean.addEventListener("click", () => window.print());
plainMode.addEventListener("change", () => document.querySelectorAll(".edit-page").forEach(p => p.classList.toggle("plain", plainMode.checked)));
showDeleted.addEventListener("change", () => editableViewer.classList.toggle("show-deleted", showDeleted.checked));

function setStatus(message) { fileStatus.textContent = message; }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function loadPdf() {
  const file = pdfInput.files?.[0];
  if (!file) return;
  currentFileName = file.name.replace(/\.pdf$/i, "") || "cleaned-pdf";
  fileTitle.textContent = file.name;
  setStatus("Reading PDF…");
  originalViewer.classList.remove("empty-box");
  editableViewer.classList.remove("empty-box");
  originalViewer.innerHTML = "";
  editableViewer.innerHTML = "";
  selectedEl = null;
  undoStack = [];
  matches = [];
  loadedPages = 0;
  isLoadingAll = false;
  stopRequested = false;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, disableAutoFetch: true, disableStream: true }).promise;
    setStatus(`PDF opened. Loading page 1/${pdfDoc.numPages}…`);
    await loadNext();
    setStatus(`Page 1 loaded. Use Load next page or Load all slowly for the rest. Total pages: ${pdfDoc.numPages}.`);
  } catch (error) {
    console.error(error);
    setStatus("Could not open that PDF.");
    alert("Could not open that PDF. It may be encrypted, damaged, too large for the browser, or blocked by the browser.");
  }
}

async function loadNext() {
  if (!pdfDoc) return alert("Open a PDF first.");
  if (loadedPages >= pdfDoc.numPages) {
    setStatus("All pages are already loaded.");
    return;
  }
  const pageNum = loadedPages + 1;
  setStatus(`Loading page ${pageNum}/${pdfDoc.numPages}…`);
  await renderPage(pageNum);
  loadedPages = pageNum;
  buildPatternChips();
  scanPatterns();
  setStatus(`Loaded ${loadedPages}/${pdfDoc.numPages} page(s).`);
  saveAutosnapshot();
}

async function loadAllSlowly() {
  if (!pdfDoc) return alert("Open a PDF first.");
  isLoadingAll = true;
  stopRequested = false;
  while (isLoadingAll && !stopRequested && loadedPages < pdfDoc.numPages) {
    await loadNext();
    await wait(180);
  }
  isLoadingAll = false;
  setStatus(stopRequested ? `Stopped at ${loadedPages}/${pdfDoc.numPages} page(s).` : `Finished loading ${loadedPages}/${pdfDoc.numPages} page(s).`);
}

async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: renderScale });

  const originalPage = document.createElement("section");
  originalPage.className = "original-page";
  originalPage.dataset.page = String(pageNum);
  originalPage.style.width = `${viewport.width}px`;
  originalPage.style.height = `${viewport.height}px`;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  originalPage.appendChild(canvas);
  originalViewer.appendChild(originalPage);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

  const editPage = document.createElement("section");
  editPage.className = "edit-page hide-rendered-background";
  editPage.dataset.page = String(pageNum);
  editPage.style.width = `${viewport.width}px`;
  editPage.style.height = `${viewport.height}px`;
  editPage.classList.toggle("plain", plainMode.checked);
  editPage.innerHTML = `<div class="background-layer"></div><div class="page-content"></div><span class="page-number">p. ${pageNum}</span>`;
  editableViewer.appendChild(editPage);

  await reproduceText(page, viewport, editPage.querySelector(".page-content"), pageNum);
}

async function reproduceText(page, viewport, layer, pageNum) {
  const textContent = await page.getTextContent();
  textContent.items.forEach((item, index) => {
    const text = item.str || "";
    if (!text.trim()) return;
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const x = transform[4];
    const y = transform[5];
    const fontSize = Math.max(6, Math.hypot(transform[2], transform[3]));
    const angle = Math.atan2(transform[1], transform[0]) * 180 / Math.PI;
    const div = document.createElement("div");
    div.className = "text-item";
    div.contentEditable = "true";
    div.spellcheck = false;
    div.dataset.page = String(pageNum);
    div.dataset.index = String(index);
    div.dataset.original = text;
    div.textContent = text;
    div.style.left = `${x}px`;
    div.style.top = `${Math.max(0, y - fontSize)}px`;
    div.style.fontSize = `${fontSize}px`;
    div.style.fontFamily = fallbackFont(item.fontName);
    div.style.transform = `rotate(${angle}deg)`;
    div.style.width = `${Math.max(item.width * renderScale + 6, text.length * fontSize * 0.35)}px`;
    div.addEventListener("focus", () => selectElement(div));
    div.addEventListener("click", event => { event.stopPropagation(); selectElement(div); });
    div.addEventListener("input", () => { div.dataset.edited = "true"; saveAutosnapshot(); });
    layer.appendChild(div);
  });
}

function fallbackFont(name = "") {
  const n = String(name).toLowerCase();
  if (n.includes("serif") || n.includes("times")) return "Georgia, 'Times New Roman', serif";
  if (n.includes("mono")) return "ui-monospace, SFMono-Regular, Consolas, monospace";
  return "Arial, Helvetica, sans-serif";
}

function buildPatternChips() {
  patternChips.innerHTML = "";
  groups.forEach(group => {
    const button = document.createElement("button");
    button.className = `chip ${group.id === activeGroup ? "active" : ""}`;
    button.type = "button";
    button.dataset.group = group.id;
    button.textContent = group.label;
    button.addEventListener("click", () => {
      activeGroup = group.id;
      document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.group === activeGroup));
      renderMatches();
    });
    patternChips.appendChild(button);
  });
}

function scanPatterns() {
  document.querySelectorAll(".text-item,.image-item").forEach(el => {
    el.classList.remove("match", "group-hours", "group-you", "group-number", "group-activity", "group-question", "group-mcq");
    delete el.dataset.groups;
  });
  matches = [];
  groups.forEach(group => {
    document.querySelectorAll(".text-item,.image-item").forEach(el => {
      if (el.classList.contains("deleted")) return;
      const text = el.textContent || "";
      if (group.test(text, el)) {
        el.classList.add("match");
        if (group.className) el.classList.add(group.className);
        const current = el.dataset.groups ? el.dataset.groups.split(",") : [];
        if (!current.includes(group.id)) current.push(group.id);
        el.dataset.groups = current.join(",");
        matches.push({ group: group.id, page: el.dataset.page, text: text.trim() || "image/design", el });
      }
    });
  });
  renderMatches();
  saveAutosnapshot();
}

function renderMatches() {
  const groupMatches = matches.filter(m => m.group === activeGroup && !m.el.classList.contains("deleted"));
  if (!groupMatches.length) {
    matchesList.className = "matches-list empty-box";
    matchesList.textContent = "No matches for this group.";
    return;
  }
  matchesList.className = "matches-list";
  matchesList.innerHTML = "";
  groupMatches.forEach((match, index) => {
    const card = document.createElement("button");
    card.className = "match-card";
    card.type = "button";
    card.innerHTML = `<strong>${escapeHtml(truncate(match.text, 72))}</strong><span class="match-meta">Page ${match.page} · match ${index + 1}</span>`;
    card.addEventListener("click", () => jumpToElement(match.el));
    matchesList.appendChild(card);
  });
}

function selectElement(el) {
  selectedEl?.classList.remove("selected");
  selectedEl = el;
  selectedEl.classList.add("selected");
  selectedInfo.textContent = `Page ${el.dataset.page} · ${truncate((el.textContent || "image/design").trim(), 120)}`;
}
function jumpToElement(el) {
  selectElement(el);
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (syncScroll.checked) originalViewer.querySelector(`.original-page[data-page="${el.dataset.page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function applyToActiveGroup(action) {
  const els = matches.filter(m => m.group === activeGroup && !m.el.classList.contains("deleted")).map(m => m.el);
  if (!els.length) return;
  if (action === "delete") deleteElements(els);
  if (action === "hide") hideElements(els);
}
function deleteElements(elements) { pushUndo(elements); elements.forEach(el => el.classList.add("deleted")); scanPatterns(); }
function hideElements(elements) { pushUndo(elements); elements.forEach(el => { el.style.display = "none"; el.dataset.hidden = "true"; }); scanPatterns(); }
function pushUndo(elements) {
  undoStack.push(elements.map(el => ({ el, className: el.className, style: el.getAttribute("style"), text: el.textContent, html: el.innerHTML })));
  if (undoStack.length > 25) undoStack.shift();
}
function undo() {
  const last = undoStack.pop();
  if (!last) return;
  last.forEach(item => { item.el.className = item.className; item.el.setAttribute("style", item.style || ""); item.el.innerHTML = item.html; });
  scanPatterns();
}
function toggleSelectedCollapse() {
  if (!selectedEl) return;
  if (selectedEl.tagName.toLowerCase() === "details") { selectedEl.open = !selectedEl.open; return; }
  if (selectedEl.classList.contains("text-item")) {
    pushUndo([selectedEl]);
    const details = document.createElement("details");
    details.className = "inserted-block";
    details.style.position = "absolute";
    details.style.left = selectedEl.style.left;
    details.style.top = selectedEl.style.top;
    details.style.width = selectedEl.style.width;
    details.dataset.page = selectedEl.dataset.page;
    details.innerHTML = `<summary contenteditable="true">Collapsed text</summary><div class="inserted-content" contenteditable="true">${escapeHtml(selectedEl.textContent)}</div>`;
    details.addEventListener("click", event => { event.stopPropagation(); selectElement(details); });
    selectedEl.replaceWith(details);
    selectElement(details);
    scanPatterns();
  }
}
function deleteNearbyOptions() {
  if (!selectedEl) return;
  const page = selectedEl.closest(".edit-page");
  const selectedTop = parseFloat(selectedEl.style.top || "0");
  const options = [...page.querySelectorAll(".text-item")].filter(el => {
    const top = parseFloat(el.style.top || "0");
    const text = el.textContent || "";
    return Math.abs(top - selectedTop) < 180 && /^\s*([A-Da-d]|[ivx]+|\d+)[\).:-]\s+/.test(text);
  });
  if (!options.length) return alert("No nearby multiple-choice options found. Try selecting one option directly or use the MCQ group.");
  deleteElements(options);
}
function insertCollapsibleBlock() {
  const page = selectedEl?.closest(".edit-page") || editableViewer.querySelector(".edit-page");
  if (!page) return alert("Load a PDF first.");
  const template = document.getElementById("transcriptTemplate").content.firstElementChild.cloneNode(true);
  template.querySelector("summary").textContent = insertTitle.value.trim() || "Transcript / notes";
  template.querySelector(".inserted-content").textContent = insertText.value.trim() || "Paste transcript or notes here.";
  template.dataset.page = page.dataset.page;
  template.style.position = "absolute";
  template.style.left = selectedEl?.style.left || "40px";
  template.style.top = `${(parseFloat(selectedEl?.style.top || "40") + 40)}px`;
  template.style.width = "70%";
  page.querySelector(".page-content").appendChild(template);
  template.addEventListener("click", event => { event.stopPropagation(); selectElement(template); });
  insertTitle.value = ""; insertText.value = ""; selectElement(template); saveAutosnapshot();
}
function collectEditState() { return { app: "pdf-split-cleaner", version: 2, fileName: currentFileName, exportedAt: new Date().toISOString(), html: editableViewer.innerHTML, plainMode: plainMode.checked, showDeleted: showDeleted.checked }; }
function downloadState() { download(`${safeName(currentFileName)}-edit-state.json`, JSON.stringify(collectEditState(), null, 2), "application/json"); }
function downloadHtml() {
  const cleanHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(currentFileName)} cleaned</title><style>${exportCss()}</style></head><body>${editableViewer.innerHTML}</body></html>`;
  download(`${safeName(currentFileName)}-cleaned.html`, cleanHtml, "text/html");
}
function importEditState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const state = JSON.parse(String(reader.result));
      if (!state.html) throw new Error("No editable HTML found");
      editableViewer.classList.remove("empty-box");
      editableViewer.innerHTML = state.html;
      currentFileName = state.fileName || currentFileName;
      fileTitle.textContent = `${currentFileName} edit state`;
      rebindEditableEvents(); buildPatternChips(); scanPatterns();
    } catch { alert("Could not import that edit state."); } finally { event.target.value = ""; }
  };
  reader.readAsText(file);
}
function rebindEditableEvents() {
  editableViewer.querySelectorAll(".text-item").forEach(div => {
    div.contentEditable = "true";
    div.addEventListener("focus", () => selectElement(div));
    div.addEventListener("click", event => { event.stopPropagation(); selectElement(div); });
    div.addEventListener("input", () => { div.dataset.edited = "true"; saveAutosnapshot(); });
  });
  editableViewer.querySelectorAll(".image-item,.inserted-block").forEach(el => el.addEventListener("click", event => { event.stopPropagation(); selectElement(el); }));
}
function saveAutosnapshot() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collectEditState())); } catch {} }
function exportCss() { return `body{margin:0;background:white;font-family:Arial,sans-serif}.edit-page{position:relative;margin:0 auto;page-break-after:always;background:white;overflow:hidden}.page-content,.background-layer{position:absolute;inset:0}.text-item{position:absolute;white-space:pre;transform-origin:0 0;line-height:1;color:#111}.image-item,.deleted,.page-number{display:none!important}.inserted-block{margin:1rem;border:1px solid #ddd;border-radius:10px;padding:.75rem;background:#fff8e8}.inserted-content{white-space:pre-wrap}`; }
function download(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function truncate(value, length) { return value.length > length ? `${value.slice(0, length - 1)}…` : value; }
function escapeHtml(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function safeName(value) { return String(value || "cleaned-pdf").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cleaned-pdf"; }

window.renderPage = renderPage;
window.buildPatternChips = buildPatternChips;
window.scanPatterns = scanPatterns;
