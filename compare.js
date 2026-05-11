(() => {
  const els = {
    fileOne: document.getElementById('fileOne'),
    fileTwo: document.getElementById('fileTwo'),
    pasteOne: document.getElementById('pasteOne'),
    pasteTwo: document.getElementById('pasteTwo'),
    fileOneTitle: document.getElementById('fileOneTitle'),
    fileTwoTitle: document.getElementById('fileTwoTitle'),
    fileOneView: document.getElementById('fileOneView'),
    fileTwoView: document.getElementById('fileTwoView'),
    loadStatus: document.getElementById('loadStatus'),
    compareNow: document.getElementById('compareNow'),
    glossaryInput: document.getElementById('glossaryInput'),
    applyGlossary: document.getElementById('applyGlossary'),
    topicCount: document.getElementById('topicCount'),
    exactCount: document.getElementById('exactCount'),
    similarCount: document.getElementById('similarCount'),
    uniqueOneCount: document.getElementById('uniqueOneCount'),
    uniqueTwoCount: document.getElementById('uniqueTwoCount'),
    matchList: document.getElementById('matchList'),
    matchListTitle: document.getElementById('matchListTitle'),
    clearFilter: document.getElementById('clearFilter'),
    mergedView: document.getElementById('mergedView'),
    holdTray: document.getElementById('holdTray'),
    rebuildMerge: document.getElementById('rebuildMerge'),
    copyMerged: document.getElementById('copyMerged'),
    exportMerged: document.getElementById('exportMerged'),
    exportReport: document.getElementById('exportReport'),
    dialog: document.getElementById('choiceDialog'),
    choiceFileOne: document.getElementById('choiceFileOne'),
    choiceFileTwo: document.getElementById('choiceFileTwo'),
    choiceHybrid: document.getElementById('choiceHybrid'),
    chooseFileOne: document.getElementById('chooseFileOne'),
    chooseFileTwo: document.getElementById('chooseFileTwo'),
    holdFileOne: document.getElementById('holdFileOne'),
    holdFileTwo: document.getElementById('holdFileTwo'),
    chooseHybrid: document.getElementById('chooseHybrid'),
    useHeld: document.getElementById('useHeld'),
    clearSlot: document.getElementById('clearSlot')
  };

  const state = {
    file1: { name: '', text: '', sentences: [] },
    file2: { name: '', text: '', sentences: [] },
    exact: [],
    similar: [],
    unique1: [],
    unique2: [],
    topicMatches: [],
    glossary: [],
    slots: [],
    held: [],
    activeSlotId: null
  };

  const DEFAULT_GLOSSARY = [
    'stigma: shame, discrimination, stigmatised, stereotypes',
    'support: help, services, intervention, access',
    'risk: harm, vulnerability, safeguarding, adverse',
    'family: parent, child, children, household, carer',
    'education: school, learning, student, attainment',
    'health: wellbeing, mental health, physical health, illness',
    'poverty: low income, deprivation, inequality, food bank',
    'policy: law, guidance, framework, legislation',
    'life course: childhood, adulthood, transition, development'
  ].join('\n');

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function esc(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function norm(value) { return clean(value).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function words(value) { return norm(value).split(/\s+/).filter(Boolean); }
  function makeId(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

  function init() {
    els.glossaryInput.value = localStorage.getItem('comparer-glossary-v1') || DEFAULT_GLOSSARY;
    parseGlossary();
    bind();
  }

  function bind() {
    els.fileOne.addEventListener('change', event => readFile(event.target.files?.[0], 1));
    els.fileTwo.addEventListener('change', event => readFile(event.target.files?.[0], 2));
    els.compareNow.addEventListener('click', compare);
    els.applyGlossary.addEventListener('click', () => {
      localStorage.setItem('comparer-glossary-v1', els.glossaryInput.value);
      parseGlossary();
      if (state.file1.sentences.length || state.file2.sentences.length) compare();
    });
    els.clearFilter.addEventListener('click', () => renderMatchList('all'));
    document.querySelectorAll('.stat-button').forEach(button => button.addEventListener('click', () => renderMatchList(button.dataset.filter)));
    els.rebuildMerge.addEventListener('click', buildMergeSlots);
    els.copyMerged.addEventListener('click', copyMerged);
    els.exportMerged.addEventListener('click', exportMerged);
    els.exportReport.addEventListener('click', exportReport);
    els.chooseFileOne.addEventListener('click', () => chooseForSlot('file1'));
    els.chooseFileTwo.addEventListener('click', () => chooseForSlot('file2'));
    els.holdFileOne.addEventListener('click', () => holdFromDialog('file1'));
    els.holdFileTwo.addEventListener('click', () => holdFromDialog('file2'));
    els.chooseHybrid.addEventListener('click', () => chooseForSlot('hybrid'));
    els.useHeld.addEventListener('click', useHeldInSlot);
    els.clearSlot.addEventListener('click', clearSlot);
  }

  async function readFile(file, fileNo) {
    if (!file) return;
    const target = fileNo === 1 ? state.file1 : state.file2;
    const title = fileNo === 1 ? els.fileOneTitle : els.fileTwoTitle;
    const paste = fileNo === 1 ? els.pasteOne : els.pasteTwo;
    els.loadStatus.textContent = `Reading ${file.name}...`;
    try {
      target.name = file.name;
      target.text = await fileToText(file);
      paste.value = target.text;
      title.textContent = file.name;
      els.loadStatus.textContent = `Loaded ${file.name}.`;
    } catch (error) {
      els.loadStatus.textContent = `Could not read ${file.name}. Paste the text manually.`;
    }
  }

  async function fileToText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx') && window.mammoth) {
      const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value || '';
    }
    if (name.endsWith('.pdf') && window.pdfjsLib) {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await window.pdfjsLib.getDocument({ data }).promise;
      const pages = [];
      for (let p = 1; p <= pdf.numPages; p += 1) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
      }
      return pages.join('\n\n');
    }
    return file.text();
  }

  function splitSentences(text, fileNo) {
    const source = String(text || '').replace(/\r/g, '\n').replace(/\n{2,}/g, '\n\n');
    const rough = source.match(/[^.!?\n]+[.!?]+|[^.!?\n]+(?=\n|$)/g) || [];
    return rough.map((sentence, index) => ({
      id: `f${fileNo}s${index}`,
      fileNo,
      index,
      text: clean(sentence),
      normal: norm(sentence),
      words: words(sentence),
      topics: []
    })).filter(item => item.text.length > 1);
  }

  function parseGlossary() {
    state.glossary = els.glossaryInput.value.split(/\n+/).map(line => {
      const [topic, rest = ''] = line.split(':');
      const label = clean(topic);
      const aliases = [label, ...rest.split(/,|;/).map(clean)].filter(Boolean);
      return { label, aliases: aliases.map(norm).filter(Boolean) };
    }).filter(item => item.label && item.aliases.length);
  }

  function applyTopics(sentence) {
    const hay = ` ${sentence.normal} `;
    sentence.topics = state.glossary.filter(topic => topic.aliases.some(alias => hay.includes(` ${alias} `) || hay.includes(alias))).map(topic => topic.label);
    return sentence;
  }

  function compare() {
    parseGlossary();
    state.file1.name ||= els.fileOne.files?.[0]?.name || 'File 1';
    state.file2.name ||= els.fileTwo.files?.[0]?.name || 'File 2';
    state.file1.text = els.pasteOne.value || state.file1.text || '';
    state.file2.text = els.pasteTwo.value || state.file2.text || '';
    state.file1.sentences = splitSentences(state.file1.text, 1).map(applyTopics);
    state.file2.sentences = splitSentences(state.file2.text, 2).map(applyTopics);
    if (!state.file1.sentences.length || !state.file2.sentences.length) {
      els.loadStatus.textContent = 'Add text or upload both files before comparing.';
      return;
    }
    classifySentences();
    renderSentences();
    renderStats();
    renderMatchList('all');
    buildMergeSlots();
    els.loadStatus.textContent = `Compared ${state.file1.sentences.length} File 1 sentences and ${state.file2.sentences.length} File 2 sentences.`;
  }

  function similarity(a, b) {
    if (!a.words.length || !b.words.length) return 0;
    const setA = new Set(a.words.filter(w => w.length > 2));
    const setB = new Set(b.words.filter(w => w.length > 2));
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    setA.forEach(w => { if (setB.has(w)) intersection += 1; });
    const union = new Set([...setA, ...setB]).size;
    const jaccard = intersection / union;
    const contained = intersection / Math.min(setA.size, setB.size);
    return Math.max(jaccard, contained * 0.82);
  }

  function classifySentences() {
    state.exact = [];
    state.similar = [];
    state.unique1 = [];
    state.unique2 = [];
    state.topicMatches = [];
    state.file1.sentences.forEach(s => { s.match = null; s.matchType = 'unique'; });
    state.file2.sentences.forEach(s => { s.match = null; s.matchType = 'unique'; });

    const used2 = new Set();
    state.file1.sentences.forEach(s1 => {
      const exact = state.file2.sentences.find(s2 => !used2.has(s2.id) && s1.normal && s1.normal === s2.normal);
      if (exact) {
        used2.add(exact.id);
        s1.match = exact.id; s1.matchType = 'exact';
        exact.match = s1.id; exact.matchType = 'exact';
        state.exact.push({ id: makeId('exact'), s1, s2: exact, type: 'exact' });
      }
    });

    state.file1.sentences.filter(s => !s.match).forEach(s1 => {
      let best = null;
      state.file2.sentences.filter(s2 => !s2.match && !used2.has(s2.id)).forEach(s2 => {
        const score = similarity(s1, s2);
        if (score >= 0.50 && (!best || score > best.score)) best = { s2, score };
      });
      if (best) {
        used2.add(best.s2.id);
        s1.match = best.s2.id; s1.matchType = 'similar'; s1.score = best.score;
        best.s2.match = s1.id; best.s2.matchType = 'similar'; best.s2.score = best.score;
        state.similar.push({ id: makeId('similar'), s1, s2: best.s2, score: best.score, type: 'similar' });
      }
    });

    state.unique1 = state.file1.sentences.filter(s => !s.match).map(s => ({ id: makeId('unique1'), s1: s, type: 'unique1' }));
    state.unique2 = state.file2.sentences.filter(s => !s.match).map(s => ({ id: makeId('unique2'), s2: s, type: 'unique2' }));

    state.file1.sentences.forEach(s1 => {
      state.file2.sentences.forEach(s2 => {
        const shared = s1.topics.filter(t => s2.topics.includes(t));
        if (shared.length && s1.id !== s2.match) state.topicMatches.push({ id: makeId('topic'), s1, s2, topics: shared, type: 'topic' });
      });
    });
  }

  function sentenceClass(sentence) {
    return ['sentence', sentence.matchType || 'unique', sentence.topics.length ? 'topic' : ''].join(' ');
  }

  function renderSentences() {
    renderFileView(els.fileOneView, state.file1.sentences);
    renderFileView(els.fileTwoView, state.file2.sentences);
  }

  function renderFileView(root, sentences) {
    root.className = 'sentence-view';
    root.innerHTML = sentences.map(s => `<article id="${s.id}" class="${sentenceClass(s)}" data-sentence-id="${s.id}">
      <strong class="index">${s.fileNo}.${s.index + 1}</strong>${esc(s.text)}
      <div class="sentence-tags">${tagHtml(s)}</div>
    </article>`).join('');
    root.querySelectorAll('.sentence').forEach(el => el.addEventListener('click', () => jumpToSentence(el.dataset.sentenceId, true)));
  }

  function tagHtml(s) {
    const tags = [];
    if (s.matchType === 'exact') tags.push('<span class="tag exact">exact</span>');
    else if (s.matchType === 'similar') tags.push(`<span class="tag similar">similar ${Math.round((s.score || 0) * 100)}%</span>`);
    else tags.push('<span class="tag unique">unique</span>');
    s.topics.forEach(t => tags.push(`<span class="tag topic">${esc(t)}</span>`));
    return tags.join('');
  }

  function renderStats() {
    els.topicCount.textContent = String(state.topicMatches.length);
    els.exactCount.textContent = String(state.exact.length);
    els.similarCount.textContent = String(state.similar.length);
    els.uniqueOneCount.textContent = String(state.unique1.length);
    els.uniqueTwoCount.textContent = String(state.unique2.length);
  }

  function listFor(filter) {
    if (filter === 'exact') return state.exact;
    if (filter === 'similar') return state.similar;
    if (filter === 'unique1') return state.unique1;
    if (filter === 'unique2') return state.unique2;
    if (filter === 'topic') return state.topicMatches;
    return [...state.exact, ...state.similar, ...state.unique1, ...state.unique2, ...state.topicMatches].slice(0, 250);
  }

  function renderMatchList(filter) {
    const labels = { all: 'All matches', exact: 'Exact same sentences', similar: 'Slightly same sentences', unique1: 'Unique to file 1', unique2: 'Unique to file 2', topic: 'Topic matches shared' };
    els.matchListTitle.textContent = labels[filter] || 'Matches';
    const list = listFor(filter);
    if (!list.length) {
      els.matchList.className = 'match-list empty-box';
      els.matchList.textContent = 'No matches in this group.';
      return;
    }
    els.matchList.className = 'match-list';
    els.matchList.innerHTML = list.map(item => matchListItem(item)).join('');
    els.matchList.querySelectorAll('.match-list-item').forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.s1) jumpToSentence(button.dataset.s1, true);
        if (button.dataset.s2) setTimeout(() => jumpToSentence(button.dataset.s2, true), 180);
      });
    });
  }

  function matchListItem(item) {
    const s1 = item.s1;
    const s2 = item.s2;
    const label = item.type === 'topic' ? `Topics: ${item.topics.join(', ')}` : item.type === 'similar' ? `Similar ${Math.round(item.score * 100)}%` : item.type === 'exact' ? 'Exact match' : item.type === 'unique1' ? 'Unique in file 1' : 'Unique in file 2';
    const text = s1?.text || s2?.text || '';
    return `<button class="match-list-item ${item.type}" type="button" data-s1="${s1?.id || ''}" data-s2="${s2?.id || ''}"><strong>${esc(label)}</strong><br>${esc(text.slice(0, 160))}${text.length > 160 ? '…' : ''}</button>`;
  }

  function jumpToSentence(id, flash = false) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('.sentence.active').forEach(item => item.classList.remove('active'));
    if (flash) {
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 1800);
    }
  }

  function anchorItems() {
    return [...state.exact].sort((a, b) => a.s1.index - b.s1.index);
  }

  function gapSentences(fileSentences, startIndex, endIndex) {
    return fileSentences.filter(s => s.index > startIndex && s.index < endIndex && s.matchType !== 'exact');
  }

  function buildMergeSlots() {
    const anchors = anchorItems();
    state.slots = [];
    if (!anchors.length) {
      fallbackMergeSlots();
      renderMerged();
      return;
    }

    let prev1 = -1;
    let prev2 = -1;
    anchors.forEach((anchor, anchorIndex) => {
      const before1 = gapSentences(state.file1.sentences, prev1, anchor.s1.index);
      const before2 = gapSentences(state.file2.sentences, prev2, anchor.s2.index);
      addGapSlots(before1, before2, `Before exact ${anchorIndex + 1}`);
      state.slots.push({
        id: makeId('slot'),
        type: 'accepted',
        accepted: true,
        text: anchor.s1.text,
        s1: anchor.s1,
        s2: anchor.s2,
        label: 'Exact in both files'
      });
      prev1 = anchor.s1.index;
      prev2 = anchor.s2.index;
    });
    const after1 = state.file1.sentences.filter(s => s.index > prev1 && s.matchType !== 'exact');
    const after2 = state.file2.sentences.filter(s => s.index > prev2 && s.matchType !== 'exact');
    addGapSlots(after1, after2, 'After final exact');
    renderMerged();
  }

  function fallbackMergeSlots() {
    const max = Math.max(state.file1.sentences.length, state.file2.sentences.length);
    for (let i = 0; i < max; i += 1) {
      state.slots.push({ id: makeId('slot'), type: 'empty', text: '', s1: state.file1.sentences[i] || null, s2: state.file2.sentences[i] || null, label: 'No exact anchor found' });
    }
  }

  function addGapSlots(list1, list2, label) {
    const max = Math.max(list1.length, list2.length);
    for (let i = 0; i < max; i += 1) {
      state.slots.push({ id: makeId('slot'), type: 'empty', text: '', s1: list1[i] || null, s2: list2[i] || null, label });
    }
  }

  function renderMerged() {
    renderHoldTray();
    if (!state.slots.length) {
      els.mergedView.className = 'merged-view empty-box';
      els.mergedView.textContent = 'Run a comparison to build File 3.';
      return;
    }
    els.mergedView.className = 'merged-view';
    els.mergedView.innerHTML = state.slots.map((slot, index) => {
      if (slot.accepted || slot.text) {
        return `<article class="merge-slot ${slot.accepted ? 'accepted' : 'manual'}" data-slot-id="${slot.id}"><strong class="index">${index + 1}</strong>${esc(slot.text)}<div class="merge-tags"><span class="tag ${slot.accepted ? 'exact' : 'similar'}">${esc(slot.accepted ? 'auto accepted exact' : 'chosen')}</span></div></article>`;
      }
      return `<article class="merge-slot empty" data-slot-id="${slot.id}"><button class="merge-slot-empty-button" type="button" data-open-slot="${slot.id}"><strong class="index">${index + 1}</strong> Empty holder — ${esc(slot.label || '')}<br><span>${esc(slot.s1?.text?.slice(0, 120) || 'No File 1 sentence')}${slot.s1?.text?.length > 120 ? '…' : ''}</span><br><span>${esc(slot.s2?.text?.slice(0, 120) || 'No File 2 sentence')}${slot.s2?.text?.length > 120 ? '…' : ''}</span></button></article>`;
    }).join('');
    els.mergedView.querySelectorAll('[data-open-slot]').forEach(button => button.addEventListener('click', () => openChoice(button.dataset.openSlot)));
  }

  function openChoice(slotId) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot) return;
    state.activeSlotId = slotId;
    els.choiceFileOne.textContent = slot.s1?.text || 'No File 1 sentence for this slot.';
    els.choiceFileTwo.textContent = slot.s2?.text || 'No File 2 sentence for this slot.';
    els.choiceHybrid.value = '';
    els.dialog.showModal();
  }

  function activeSlot() { return state.slots.find(s => s.id === state.activeSlotId); }

  function chooseForSlot(source) {
    const slot = activeSlot();
    if (!slot) return;
    let text = '';
    if (source === 'file1') text = slot.s1?.text || '';
    if (source === 'file2') text = slot.s2?.text || '';
    if (source === 'hybrid') text = clean(els.choiceHybrid.value);
    if (!text) return;
    slot.text = text;
    slot.type = source;
    slot.accepted = false;
    els.dialog.close();
    renderMerged();
  }

  function holdFromDialog(source) {
    const slot = activeSlot();
    if (!slot) return;
    const sentence = source === 'file1' ? slot.s1 : slot.s2;
    if (!sentence) return;
    state.held.push({ id: makeId('held'), source, text: sentence.text });
    renderHoldTray();
  }

  function useHeldInSlot() {
    const slot = activeSlot();
    if (!slot || !state.held.length) return;
    const held = state.held.shift();
    slot.text = held.text;
    slot.type = `held-${held.source}`;
    slot.accepted = false;
    els.dialog.close();
    renderMerged();
  }

  function clearSlot() {
    const slot = activeSlot();
    if (!slot) return;
    slot.text = '';
    slot.accepted = false;
    slot.type = 'empty';
    els.dialog.close();
    renderMerged();
  }

  function renderHoldTray() {
    if (!state.held.length) {
      els.holdTray.className = 'hold-tray empty-box';
      els.holdTray.textContent = 'No held sentence yet.';
      return;
    }
    els.holdTray.className = 'hold-tray';
    els.holdTray.innerHTML = `<strong>Held for next slot:</strong> ${state.held.map(h => `<span class="tag">${esc(h.source)}: ${esc(h.text.slice(0, 90))}${h.text.length > 90 ? '…' : ''}</span>`).join(' ')}`;
  }

  function mergedText() {
    return state.slots.map(slot => clean(slot.text)).filter(Boolean).join('\n\n');
  }

  function copyMerged() { copyText(mergedText()); }

  function copyText(text) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function exportMerged() {
    download(`merged-document-${dateSlug()}.txt`, mergedText());
  }

  function exportReport() {
    const report = {
      exportedAt: new Date().toISOString(),
      file1: state.file1.name || 'File 1',
      file2: state.file2.name || 'File 2',
      counts: {
        topicMatchesShared: state.topicMatches.length,
        exactSameSentences: state.exact.length,
        slightlySameSentences: state.similar.length,
        uniqueFile1: state.unique1.length,
        uniqueFile2: state.unique2.length
      },
      exact: state.exact.map(x => ({ file1Index: x.s1.index + 1, file2Index: x.s2.index + 1, text: x.s1.text })),
      similar: state.similar.map(x => ({ file1Index: x.s1.index + 1, file2Index: x.s2.index + 1, score: x.score, file1: x.s1.text, file2: x.s2.text })),
      unique1: state.unique1.map(x => ({ index: x.s1.index + 1, text: x.s1.text })),
      unique2: state.unique2.map(x => ({ index: x.s2.index + 1, text: x.s2.text })),
      topics: state.topicMatches.slice(0, 500).map(x => ({ topics: x.topics, file1Index: x.s1.index + 1, file2Index: x.s2.index + 1 }))
    };
    download(`comparison-report-${dateSlug()}.json`, JSON.stringify(report, null, 2));
  }

  function download(name, text) {
    const blob = new Blob([text], { type: name.endsWith('.json') ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function dateSlug() { return new Date().toISOString().slice(0, 10); }

  init();
})();
