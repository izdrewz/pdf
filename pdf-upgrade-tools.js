(() => {
  if (window.__pdfUpgradeToolsV6Loaded) return;
  window.__pdfUpgradeToolsV6Loaded = true;

  const DISMISS_KEY = "pdf-cleaner-dismissed-matches-v1";
  let lassoMode = false;
  let lassoBox = null;
  let lassoStart = null;
  let lassoSelection = [];
  let activePage = null;
  let currentSelected = null;

  const $ = id => document.getElementById(id);
  const editableViewer = $("editableViewer");
  const originalViewer = $("originalViewer");
  const matchesList = $("matchesList");

  function readDismissed() { try { return JSON.parse(localStorage.getItem(DISMISS_KEY)) || []; } catch { return []; } }
  function writeDismissed(list) { localStorage.setItem(DISMISS_KEY, JSON.stringify([...new Set(list)])); }
  function signatureFor(el) { return `${el.dataset.page || ""}|${el.dataset.index || ""}|${String(el.textContent || "image/design").trim().slice(0, 100)}`; }
  function rectsIntersect(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
  function pagePoint(event, page) {
    const rect = page.getBoundingClientRect();
    return { x: event.clientX - rect.left + page.scrollLeft, y: event.clientY - rect.top + page.scrollTop };
  }
  function setLassoMode(next) {
    lassoMode = next;
    const button = $("toggleLasso");
    if (button) {
      button.textContent = "Lasso";
      button.setAttribute("aria-pressed", String(lassoMode));
      button.classList.toggle("active", lassoMode);
    }
    editableViewer?.classList.toggle("lasso-mode", lassoMode);
    if (!lassoMode) clearLasso();
  }

  function bindControls() {
    const lasso = $("toggleLasso");
    if (lasso && !lasso.dataset.bound) {
      lasso.dataset.bound = "true";
      lasso.textContent = "Lasso";
      lasso.setAttribute("aria-pressed", "false");
      lasso.addEventListener("click", () => setLassoMode(!lassoMode));
    }
    const bindings = [
      ["deleteLassoArea", deleteLassoArea],
      ["markLassoImage", markLassoAsImage],
      ["deleteSelectedVisual", deleteSelectedVisual],
      ["moveLassoUp", () => moveSelection(-18)],
      ["moveLassoDown", () => moveSelection(18)],
      ["dismissSelectedMatch", dismissSelectedMatch],
      ["clearLasso", clearLasso]
    ];
    bindings.forEach(([id, fn]) => {
      const el = $(id);
      if (el && !el.dataset.bound) {
        el.dataset.bound = "true";
        el.addEventListener("click", fn);
      }
    });
    const showBg = $("showPageBackground");
    if (showBg && !showBg.dataset.bound) {
      showBg.dataset.bound = "true";
      showBg.addEventListener("change", event => document.querySelectorAll(".edit-page").forEach(page => page.classList.toggle("hide-rendered-background", !event.target.checked)));
    }
    const coverText = $("coverBackgroundText");
    if (coverText && !coverText.dataset.bound) {
      coverText.dataset.bound = "true";
      coverText.addEventListener("change", event => document.querySelectorAll(".edit-page").forEach(page => page.classList.toggle("cover-background-text", event.target.checked)));
    }
    const showImages = $("showImageAreas");
    if (showImages && !showImages.dataset.bound) {
      showImages.dataset.bound = "true";
      showImages.addEventListener("change", event => document.body.classList.toggle("hide-image-areas", !event.target.checked));
    }
  }

  function removeOldInjectedPanels() {
    document.querySelectorAll(".upgrade-tool-panel").forEach((panel, index) => {
      if (panel.id !== "upgradeToolPanel") panel.remove();
      if (panel.id === "upgradeToolPanel" && index > 0) panel.remove();
    });
  }

  function addRenderedBackgrounds() {
    document.querySelectorAll(".edit-page").forEach(page => {
      const pageNo = page.dataset.page;
      const canvas = originalViewer?.querySelector(`.original-page[data-page="${pageNo}"] canvas`);
      const background = page.querySelector(".background-layer");
      if (!canvas || !background) return;
      try {
        if (!page.dataset.backgroundAdded) {
          background.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
          background.style.backgroundSize = "100% 100%";
          background.style.backgroundRepeat = "no-repeat";
          page.dataset.backgroundAdded = "true";
        }
        page.classList.add("with-rendered-background");
        page.classList.toggle("cover-background-text", $("coverBackgroundText") ? $("coverBackgroundText").checked : true);
        page.classList.toggle("hide-rendered-background", $("showPageBackground") ? !$("showPageBackground").checked : false);
      } catch (error) { console.info("Could not copy rendered background", error); }
    });
  }

  function applyDismissedMatches() {
    const dismissed = new Set(readDismissed());
    document.querySelectorAll(".text-item,.image-item").forEach(el => {
      if (!dismissed.has(signatureFor(el))) return;
      el.classList.add("dismissed-match");
      el.classList.remove("match", "group-hours", "group-you", "group-number", "group-activity", "group-question", "group-mcq");
      delete el.dataset.groups;
    });
    filterDismissedMatchCards();
  }

  function filterDismissedMatchCards() {
    const dismissed = readDismissed();
    if (!dismissed.length || !matchesList) return;
    matchesList.querySelectorAll(".match-card").forEach(card => {
      const strong = card.querySelector("strong")?.textContent || "";
      const meta = card.querySelector(".match-meta")?.textContent || "";
      const page = (meta.match(/Page\s+(\d+)/i) || [])[1] || "";
      const hidden = dismissed.some(sig => sig.startsWith(`${page}|`) && sig.includes(strong.replace("…", "").slice(0, 30)));
      if (hidden) card.remove();
    });
  }

  function bindSelectionTracking() {
    if (document.body.dataset.pdfSelectionBound) return;
    document.body.dataset.pdfSelectionBound = "true";
    document.addEventListener("click", event => {
      const el = event.target.closest?.(".text-item,.image-item,.inserted-block,.redaction-box");
      if (!el) return;
      currentSelected = el;
      document.querySelectorAll(".selected").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
      const info = $("selectedInfo");
      if (info) info.textContent = `${el.classList.contains("image-item") ? "Image/art area" : "Selected item"} on page ${el.dataset.page || el.closest(".edit-page")?.dataset.page || ""}.`;
    }, true);
  }

  function bindLasso() {
    if (!editableViewer || editableViewer.dataset.lassoBound) return;
    editableViewer.dataset.lassoBound = "true";
    editableViewer.addEventListener("pointerdown", event => {
      if (!lassoMode) return;
      const page = event.target.closest(".edit-page");
      if (!page) return;
      if (event.target.closest(".text-item,.inserted-block,button,summary,.image-item")) return;
      event.preventDefault();
      activePage = page;
      lassoStart = pagePoint(event, page);
      clearLasso();
      lassoBox = document.createElement("div");
      lassoBox.className = "lasso-box";
      lassoBox.style.left = `${lassoStart.x}px`;
      lassoBox.style.top = `${lassoStart.y}px`;
      lassoBox.style.width = "0px";
      lassoBox.style.height = "0px";
      page.querySelector(".page-content")?.appendChild(lassoBox);
      page.setPointerCapture?.(event.pointerId);
    });
    editableViewer.addEventListener("pointermove", event => {
      if (!lassoMode || !lassoBox || !activePage || !lassoStart) return;
      const point = pagePoint(event, activePage);
      const left = Math.min(lassoStart.x, point.x);
      const top = Math.min(lassoStart.y, point.y);
      const width = Math.abs(point.x - lassoStart.x);
      const height = Math.abs(point.y - lassoStart.y);
      Object.assign(lassoBox.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    });
    editableViewer.addEventListener("pointerup", event => {
      if (!lassoMode || !lassoBox || !activePage) return;
      event.preventDefault();
      selectInsideLasso(activePage, lassoBox);
      activePage.releasePointerCapture?.(event.pointerId);
      lassoStart = null;
      activePage = null;
    });
  }

  function selectInsideLasso(page, box) {
    document.querySelectorAll(".lasso-selected").forEach(el => el.classList.remove("lasso-selected"));
    const boxRect = box.getBoundingClientRect();
    lassoSelection = [...page.querySelectorAll(".text-item,.image-item,.inserted-block")].filter(el => !el.classList.contains("deleted") && rectsIntersect(boxRect, el.getBoundingClientRect()));
    lassoSelection.forEach(el => el.classList.add("lasso-selected"));
    const info = $("selectedInfo");
    if (info) info.textContent = `Lasso selected ${lassoSelection.length} item(s) on page ${page.dataset.page}.`;
  }

  function clearLasso() {
    lassoBox?.remove();
    lassoBox = null;
    lassoSelection.forEach(el => el.classList.remove("lasso-selected"));
    lassoSelection = [];
  }

  function makeRedactionFromBox(box) {
    const page = box.closest(".edit-page");
    const pageContent = box.closest(".page-content");
    const redaction = document.createElement("div");
    redaction.className = "redaction-box";
    redaction.dataset.page = page?.dataset.page || "";
    redaction.style.left = box.style.left;
    redaction.style.top = box.style.top;
    redaction.style.width = box.style.width;
    redaction.style.height = box.style.height;
    pageContent?.appendChild(redaction);
    return redaction;
  }

  function deleteLassoArea() {
    if (!lassoBox) return alert("Click Lasso, drag a box around the area, then click Delete lasso area.");
    makeRedactionFromBox(lassoBox);
    lassoSelection.forEach(el => el.classList.add("deleted"));
    clearLasso();
  }

  function markLassoAsImage() {
    if (!lassoBox) return alert("Click Lasso and drag around the image/art area first.");
    const page = lassoBox.closest(".edit-page");
    const pageContent = lassoBox.closest(".page-content");
    const marker = document.createElement("div");
    marker.className = "image-item manual-image-area";
    marker.dataset.page = page?.dataset.page || "";
    marker.dataset.index = `manual-image-${Date.now()}`;
    marker.textContent = "image/art area";
    marker.style.left = lassoBox.style.left;
    marker.style.top = lassoBox.style.top;
    marker.style.width = lassoBox.style.width;
    marker.style.height = lassoBox.style.height;
    pageContent?.appendChild(marker);
    currentSelected = marker;
    clearLasso();
    document.querySelectorAll(".selected").forEach(x => x.classList.remove("selected"));
    marker.classList.add("selected");
    $("rescanPatterns")?.click();
  }

  function deleteSelectedVisual() {
    const target = currentSelected || document.querySelector(".selected");
    if (!target || (!target.classList.contains("image-item") && !target.classList.contains("redaction-box"))) {
      return alert("Click a marked image/art area first, or lasso an area and mark it as image/art.");
    }
    const redaction = document.createElement("div");
    redaction.className = "redaction-box";
    redaction.dataset.page = target.dataset.page || target.closest(".edit-page")?.dataset.page || "";
    redaction.style.left = target.style.left;
    redaction.style.top = target.style.top;
    redaction.style.width = target.style.width;
    redaction.style.height = target.style.height;
    target.closest(".page-content")?.appendChild(redaction);
    target.classList.add("deleted");
  }

  function moveSelection(deltaY) {
    const targets = lassoSelection.length ? lassoSelection : (currentSelected ? [currentSelected] : []);
    if (!targets.length) return alert("Select text with the lasso or click one text item first.");
    targets.forEach(el => {
      if (!el.classList.contains("text-item") && !el.classList.contains("inserted-block")) return;
      const currentTop = parseFloat(el.style.top || "0");
      el.style.top = `${currentTop + deltaY}px`;
    });
  }

  function dismissSelectedMatch() {
    const target = currentSelected || document.querySelector(".selected,.lasso-selected");
    if (!target) return alert("Click a highlighted match first, then dismiss it.");
    const dismissed = readDismissed();
    dismissed.push(signatureFor(target));
    writeDismissed(dismissed);
    target.classList.add("dismissed-match");
    target.classList.remove("match", "group-hours", "group-you", "group-number", "group-activity", "group-question", "group-mcq");
    delete target.dataset.groups;
    filterDismissedMatchCards();
  }

  function init() {
    removeOldInjectedPanels();
    bindControls();
    bindSelectionTracking();
    bindLasso();
    addRenderedBackgrounds();
    applyDismissedMatches();
    new MutationObserver(() => { removeOldInjectedPanels(); addRenderedBackgrounds(); applyDismissedMatches(); }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
