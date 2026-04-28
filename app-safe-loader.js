(() => {
  const MAX_RENDER_SCALE = 1.05;
  let loadedPages = 0;
  let isLoadingAll = false;
  let stopRequested = false;

  function $(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function patchWhenReady() {
    if (!window.pdfjsLib || !$('pdfInput') || !window.renderPage) {
      setTimeout(patchWhenReady, 60);
      return;
    }

    const pdfInput = $('pdfInput');
    const loadNextPage = $('loadNextPage');
    const loadAllPagesSlowly = $('loadAllPagesSlowly');
    const stopLoadingPages = $('stopLoadingPages');
    const fileStatus = $('fileStatus');
    const originalViewer = $('originalViewer');
    const editableViewer = $('editableViewer');
    const fileTitle = $('fileTitle');

    const oldInput = pdfInput.cloneNode(true);
    pdfInput.replaceWith(oldInput);

    function setStatus(message) {
      if (fileStatus) fileStatus.textContent = message;
    }

    async function safeLoadPdf() {
      const file = oldInput.files?.[0];
      if (!file) return;
      stopRequested = false;
      isLoadingAll = false;
      loadedPages = 0;
      window.currentFileName = file.name.replace(/\.pdf$/i, '') || 'cleaned-pdf';
      if (fileTitle) fileTitle.textContent = file.name;
      setStatus('Reading PDF…');
      originalViewer?.classList.remove('empty-box');
      editableViewer?.classList.remove('empty-box');
      if (originalViewer) originalViewer.innerHTML = '';
      if (editableViewer) editableViewer.innerHTML = '';

      try {
        window.renderScale = MAX_RENDER_SCALE;
        const arrayBuffer = await file.arrayBuffer();
        window.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, disableAutoFetch: true, disableStream: true }).promise;
        setStatus(`PDF opened. Loading page 1 of ${window.pdfDoc.numPages}…`);
        await loadNext();
        if (window.buildPatternChips) window.buildPatternChips();
        if (window.scanPatterns) window.scanPatterns();
        setStatus(`Page 1 loaded. Use Load next page or Load all slowly for the rest. Total pages: ${window.pdfDoc.numPages}.`);
      } catch (error) {
        console.error(error);
        setStatus('Could not open that PDF.');
        alert('Could not open that PDF. It may be encrypted, damaged, too large for the browser, or blocked by the browser.');
      }
    }

    async function loadNext() {
      if (!window.pdfDoc) return alert('Open a PDF first.');
      if (loadedPages >= window.pdfDoc.numPages) {
        setStatus('All pages are already loaded.');
        return;
      }
      const next = loadedPages + 1;
      setStatus(`Loading page ${next}/${window.pdfDoc.numPages}…`);
      await window.renderPage(next);
      loadedPages = next;
      if (window.buildPatternChips) window.buildPatternChips();
      if (window.scanPatterns) window.scanPatterns();
      setStatus(`Loaded ${loadedPages}/${window.pdfDoc.numPages} page(s).`);
    }

    async function loadAllSlowly() {
      if (!window.pdfDoc) return alert('Open a PDF first.');
      isLoadingAll = true;
      stopRequested = false;
      while (isLoadingAll && !stopRequested && loadedPages < window.pdfDoc.numPages) {
        await loadNext();
        await wait(180);
      }
      isLoadingAll = false;
      setStatus(stopRequested ? `Stopped at ${loadedPages}/${window.pdfDoc.numPages} page(s).` : `Finished loading ${loadedPages}/${window.pdfDoc.numPages} page(s).`);
    }

    oldInput.addEventListener('change', safeLoadPdf);
    loadNextPage?.addEventListener('click', loadNext);
    loadAllPagesSlowly?.addEventListener('click', loadAllSlowly);
    stopLoadingPages?.addEventListener('click', () => { stopRequested = true; isLoadingAll = false; setStatus('Stopping after current page…'); });
  }

  patchWhenReady();
})();
