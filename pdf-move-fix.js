(() => {
  if (window.__pdfMoveFixLoaded) return;
  window.__pdfMoveFixLoaded = true;

  function getEditablePages() {
    return [...document.querySelectorAll('.edit-page')].sort((a, b) => Number(a.dataset.page || 0) - Number(b.dataset.page || 0));
  }

  function pageHeight(page) {
    return Number(page.dataset.baseHeight || parseFloat(page.style.height) || page.offsetHeight || page.getBoundingClientRect().height || 0);
  }

  function elementHeight(el) {
    const scale = Number(el.closest('.edit-page')?.dataset.zoomScale || 1);
    return Math.max(8, el.getBoundingClientRect().height / scale || parseFloat(el.style.height) || 12);
  }

  function targetElements() {
    const lasso = [...document.querySelectorAll('.lasso-selected')].filter(el => el.classList.contains('text-item') || el.classList.contains('inserted-block'));
    if (lasso.length) return lasso;
    const selected = document.querySelector('.text-item.selected, .inserted-block.selected');
    return selected ? [selected] : [];
  }

  function moveElementVertically(el, deltaY) {
    const page = el.closest('.edit-page');
    const content = page?.querySelector('.page-content');
    if (!page || !content) return;

    const pages = getEditablePages();
    const pageNo = Number(page.dataset.page || 0);
    const currentTop = parseFloat(el.style.top || '0');
    const height = elementHeight(el);
    const thisHeight = pageHeight(page);
    let nextTop = currentTop + deltaY;
    let targetPage = page;

    if (nextTop < 0) {
      const previous = pages.find(candidate => Number(candidate.dataset.page || 0) === pageNo - 1);
      if (previous) {
        targetPage = previous;
        nextTop = Math.max(0, pageHeight(previous) + nextTop);
      } else {
        nextTop = 0;
      }
    } else if (nextTop + height > thisHeight) {
      const next = pages.find(candidate => Number(candidate.dataset.page || 0) === pageNo + 1);
      if (next) {
        targetPage = next;
        nextTop = Math.max(0, nextTop - thisHeight);
      } else {
        nextTop = Math.max(0, thisHeight - height);
      }
    }

    const targetContent = targetPage.querySelector('.page-content');
    if (!targetContent) return;

    if (targetPage !== page) {
      targetContent.appendChild(el);
      el.dataset.page = targetPage.dataset.page || el.dataset.page || '';
    }

    el.style.top = `${nextTop}px`;
    el.classList.add('moved-visible');
    el.style.zIndex = '70';
  }

  function moveSelection(deltaY) {
    const targets = targetElements();
    if (!targets.length) {
      alert('Select text with the lasso or click one text item first.');
      return;
    }
    targets.forEach(el => moveElementVertically(el, deltaY));
    const info = document.getElementById('selectedInfo');
    if (info) info.textContent = `Moved ${targets.length} text item(s) ${deltaY < 0 ? 'up' : 'down'}. Text can cross to the page above or below.`;
  }

  function interceptMove(event) {
    const button = event.target.closest('#moveLassoUp, #moveLassoDown');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveSelection(button.id === 'moveLassoUp' ? -18 : 18);
  }

  document.addEventListener('click', interceptMove, true);
})();
