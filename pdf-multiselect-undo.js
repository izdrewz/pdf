(() => {
  if (window.__pdfMultiUndoLoaded) return;
  window.__pdfMultiUndoLoaded = true;

  let multiMode = false;
  const selected = new Set();
  const undoStack = [];

  function $(id) { return document.getElementById(id); }
  function editableTarget(el) {
    return el?.closest?.('.text-item,.image-item,.inserted-block,.redaction-box');
  }
  function pageContentFor(el) {
    return el?.closest?.('.page-content');
  }
  function pageFor(el) {
    return el?.closest?.('.edit-page');
  }

  function setInfo(text) {
    const info = $('selectedInfo');
    if (info) info.textContent = text;
  }

  function setMultiMode(next) {
    multiMode = next;
    const button = $('toggleMultiSelect');
    if (button) {
      button.setAttribute('aria-pressed', String(multiMode));
      button.classList.toggle('active', multiMode);
    }
    document.body.classList.toggle('multi-select-mode', multiMode);
    if (!multiMode) clearMultiSelected();
  }

  function toggleMultiSelected(el) {
    if (!el || el.classList.contains('deleted')) return;
    if (selected.has(el)) {
      selected.delete(el);
      el.classList.remove('multi-selected');
    } else {
      selected.add(el);
      el.classList.add('multi-selected');
    }
    setInfo(`${selected.size} box(es) selected for deletion.`);
  }

  function clearMultiSelected() {
    selected.forEach(el => el.classList.remove('multi-selected'));
    selected.clear();
    setInfo('Multi-select cleared.');
  }

  function snapshot(elements, extraNodes = []) {
    undoStack.push({
      elements: elements.map(el => ({
        el,
        className: el.className,
        style: el.getAttribute('style'),
        hidden: el.classList.contains('deleted'),
        parent: el.parentNode
      })),
      extraNodes
    });
    if (undoStack.length > 40) undoStack.shift();
  }

  function undoLast() {
    const entry = undoStack.pop();
    if (!entry) {
      setInfo('Nothing to undo yet.');
      return;
    }
    entry.extraNodes?.forEach(node => node?.remove?.());
    entry.elements?.forEach(item => {
      if (item.parent && item.el.parentNode !== item.parent) item.parent.appendChild(item.el);
      item.el.className = item.className;
      if (item.style === null || item.style === undefined) item.el.removeAttribute('style');
      else item.el.setAttribute('style', item.style);
      if (!item.hidden) item.el.classList.remove('deleted');
    });
    clearMultiSelected();
    setInfo('Undo restored the last lasso/box deletion.');
  }

  function makeRedactionFromLasso(box) {
    const page = pageFor(box);
    const content = pageContentFor(box);
    if (!content) return null;
    const redaction = document.createElement('div');
    redaction.className = 'redaction-box undoable-redaction';
    redaction.dataset.page = page?.dataset.page || '';
    redaction.style.left = box.style.left;
    redaction.style.top = box.style.top;
    redaction.style.width = box.style.width;
    redaction.style.height = box.style.height;
    content.appendChild(redaction);
    return redaction;
  }

  function deleteLassoWithUndo() {
    const box = document.querySelector('.lasso-box');
    if (!box) {
      alert('Click Lasso, drag a box around the area, then click Delete lasso area.');
      return;
    }
    const page = pageFor(box);
    const boxRect = box.getBoundingClientRect();
    const elements = [...page.querySelectorAll('.text-item,.image-item,.inserted-block')].filter(el => {
      if (el.classList.contains('deleted')) return false;
      const r = el.getBoundingClientRect();
      return !(r.right < boxRect.left || r.left > boxRect.right || r.bottom < boxRect.top || r.top > boxRect.bottom);
    });
    const redaction = makeRedactionFromLasso(box);
    snapshot(elements, redaction ? [redaction] : []);
    elements.forEach(el => el.classList.add('deleted'));
    box.remove();
    document.querySelectorAll('.lasso-selected').forEach(el => el.classList.remove('lasso-selected'));
    setInfo(`Deleted lasso area. Undo can restore ${elements.length} item(s) and remove the white cover.`);
  }

  function deleteMultiSelected() {
    const targets = [...selected].filter(el => !el.classList.contains('deleted'));
    if (!targets.length) {
      alert('Turn on Multi-select, click the boxes you want, then click Delete selected boxes.');
      return;
    }
    snapshot(targets, []);
    targets.forEach(el => {
      el.classList.add('deleted');
      el.classList.remove('multi-selected');
    });
    selected.clear();
    setInfo(`Deleted ${targets.length} selected box(es). Undo can restore them.`);
  }

  function deleteSelectedTextWithUndo() {
    const target = document.querySelector('.selected.text-item,.selected.inserted-block,.selected.image-item,.selected.redaction-box');
    if (!target) return;
    snapshot([target], []);
    target.classList.add('deleted');
    setInfo('Deleted selected box. Undo can restore it.');
  }

  function bind() {
    const multi = $('toggleMultiSelect');
    if (multi && !multi.dataset.multiUndoBound) {
      multi.dataset.multiUndoBound = 'true';
      multi.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        setMultiMode(!multiMode);
      }, true);
    }
    const clear = $('clearMultiSelect');
    if (clear && !clear.dataset.multiUndoBound) {
      clear.dataset.multiUndoBound = 'true';
      clear.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearMultiSelected();
      }, true);
    }
    const delMulti = $('deleteMultiSelected');
    if (delMulti && !delMulti.dataset.multiUndoBound) {
      delMulti.dataset.multiUndoBound = 'true';
      delMulti.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteMultiSelected();
      }, true);
    }
    const undo = $('undoLast');
    if (undo && !undo.dataset.multiUndoBound) {
      undo.dataset.multiUndoBound = 'true';
      undo.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        undoLast();
      }, true);
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#deleteLassoArea')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteLassoWithUndo();
      return;
    }
    if (event.target.closest('#deleteSelected')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelectedTextWithUndo();
      return;
    }
    if (!multiMode) return;
    const target = editableTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMultiSelected(target);
  }, true);

  bind();
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
})();
