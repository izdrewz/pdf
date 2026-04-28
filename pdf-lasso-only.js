(() => {
  if (window.__pdfLassoOnlyLoaded) return;
  window.__pdfLassoOnlyLoaded = true;

  function activeLassoBox() {
    return document.querySelector('.lasso-box');
  }

  function selectedPage() {
    const box = activeLassoBox();
    if (box) return box.closest('.edit-page');
    const selected = document.querySelector('.selected, .lasso-selected');
    return selected?.closest('.edit-page') || document.querySelector('.edit-page');
  }

  function selectElement(el) {
    document.querySelectorAll('.selected').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');
    const info = document.getElementById('selectedInfo');
    if (info) info.textContent = `Text box on page ${el.dataset.page || el.closest('.edit-page')?.dataset.page || ''}.`;
  }

  function insertTextBoxFromLasso() {
    const box = activeLassoBox();
    const page = selectedPage();
    if (!page) {
      alert('Load a PDF page first.');
      return;
    }
    const content = page.querySelector('.page-content');
    if (!content) return;

    const textBox = document.createElement('div');
    textBox.className = 'text-item inserted-text-box moved-visible';
    textBox.contentEditable = 'true';
    textBox.spellcheck = true;
    textBox.dataset.page = page.dataset.page || '';
    textBox.dataset.index = `inserted-text-${Date.now()}`;
    textBox.textContent = 'Type here';

    if (box) {
      textBox.style.left = box.style.left;
      textBox.style.top = box.style.top;
      textBox.style.width = box.style.width || '220px';
      textBox.style.minHeight = box.style.height || '34px';
    } else {
      textBox.style.left = '40px';
      textBox.style.top = '40px';
      textBox.style.width = '260px';
      textBox.style.minHeight = '34px';
    }

    textBox.style.fontSize = '14px';
    textBox.style.fontFamily = 'Arial, Helvetica, sans-serif';
    textBox.style.whiteSpace = 'pre-wrap';
    textBox.style.lineHeight = '1.35';
    textBox.style.padding = '4px 6px';
    textBox.style.zIndex = '75';
    content.appendChild(textBox);

    textBox.addEventListener('click', event => {
      event.stopPropagation();
      selectElement(textBox);
    });
    textBox.addEventListener('focus', () => selectElement(textBox));

    box?.remove();
    document.querySelectorAll('.lasso-selected').forEach(el => el.classList.remove('lasso-selected'));
    selectElement(textBox);
    textBox.focus();
    document.execCommand?.('selectAll', false, null);
  }

  function bind() {
    const button = document.getElementById('insertLassoTextBox');
    if (button && !button.dataset.bound) {
      button.dataset.bound = 'true';
      button.addEventListener('click', insertTextBoxFromLasso);
    }
  }

  bind();
  new MutationObserver(bind).observe(document.body, { childList: true, subtree: true });
})();
