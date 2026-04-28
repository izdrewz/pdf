(() => {
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

  function readDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY)) || []; }
    catch { return []; }
  }
  function writeDismissed(list) {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...new Set(list)]));
  }
  function signatureFor(el) {
    return `${el.dataset.page || ""}|${el.dataset.index || ""}|${String(el.textContent || "image/design").trim().slice(0, 100)}`;
  }
  function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
  function pagePoint(event, page) {
    const rect = page.getBoundingClientRect();
    return {
      x: event.clientX - rect.left + page.scrollLeft,
      y: event.clientY - rect.top + page.scrollTop
    };
  }

  function injectToolPanel() {
    if ($("upgradeToolPanel")) return;
    const tools = document.querySelector(".tools-panel");
    if (!tools) return;
    const panel = document.createElement("section");
    panel.id = "upgradeToolPanel";
    panel.className = "panel upgrade-tool-panel";
    panel.innerHTML = `
      <p class="eyebrow">Area tools</p>
      <h2>Lasso, dismiss, and move</h2>
      <p class="hint">Use lasso to select an area on the editable page. Delete covers the area with a white block and removes selected text. Move only changes vertical position.</p>
      <div class="pattern-actions upgrade-actions">
        <button id="toggleLasso" class="ghost" type="button">Lasso off</button>
        <button id="deleteLassoArea" class="danger" type="button">Delete lasso area</button>
        <button id="moveLassoUp" class="ghost" type="button">Move up</button>
        <button id="moveLassoDown" class="ghost" type="button">Move down</button>
        <button id="dismissSelectedMatch" class="ghost" type="button">Dismiss match</button>
        <button id="clearLasso" class="ghost" type="button">Clear lasso</button>
      </div>
      <label class="switch"><input id="showPageBackground" type="checkbox" checked> Carry rendered PDF page/image background</label>
      <label class="switch"><input id="strongPageBackground" type="checkbox"> Stronger background</label>
    `;
    tools.insertBefore(panel, tools.children[2] || null);

    $("toggleLasso").addEventListener("click", () => {
      lassoMode = !lassoMode;
      $("toggleLasso").textContent = lassoMode ? "Lasso on" : "Lasso off";
      editableViewer.classList.toggle("lasso-mode", lassoMode);
    });
    $("deleteLassoArea").addEventListener("click", deleteLassoArea);
    $("moveLassoUp").addEventListener("click", () => moveSelection(-18));
    $("moveLassoDown").addEventListener("click", () => moveSelection(18));
    $("dismissSelectedMatch").addEventListener("click", dismissSelectedMatch);
    $("clearLasso").addEventListener("click", clearLasso);
    $("showPageBackground").addEventListener("change", event => {
      document.querySelectorAll(".edit-page").forEach(page => page.classList.toggle("hide-rendered-background", !event.target.checked));
    });
    $("strongPageBackground").addEventListener("change", event => {
      document.querySelectorAll(".edit-page").forEach(page => page.classList.toggle("strong-rendered-background", event.target.checked));
    });
  }

  function addRenderedBackgrounds() {
    document.querySelectorAll(".edit-page").forEach(page => {
      if (page.dataset.backgroundAdded) return;
      const pageNo = page.dataset.page;
      const canvas = originalViewer?.querySelector(`.original-page[data-page="${pageNo}"] canvas`);
      const background = page.querySelector(".background-layer");
      if (!canvas || !background) return;
      try {
        background.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
        background.style.backgroundSize = "100% 100%";
        background.style.backgroundRepeat = "no-repeat";
        page.classList.add("with-rendered-background");
        if ($("showPageBackground") && !$("showPageBackground").checked) page.classList.add("hide-rendered-background");
        if ($("strongPageBackground")?.checked) page.classList.add("strong-rendered-background");
        page.dataset.backgroundAdded = "true";
      } catch (error) {
        console.info("Could not copy rendered background", error);
      }
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
    if (!matchesList.querySelector(".match-card") && !matchesList.classList.contains("empty-box")) {
      matchesList.className = "matches-list empty-box";
      matchesList.textContent = "No matches for this group.";
    }
  }

  function bindSelectionTracking() {
    document.addEventListener("click", event => {
      const el = event.target.closest?.(".text-item,.image-item,.inserted-block");
      if (el) currentSelected = el;
    }, true);
  }

  function bindLasso() {
    editableViewer?.addEventListener("pointerdown", event => {
      if (!lassoMode) return;
      const page = event.target.closest(".edit-page");
      if (!page) return;
      if (event.target.closest(".text-item,.inserted-block,button,summary")) return;
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

    editableViewer?.addEventListener("pointermove", event => {
      if (!lassoMode || !lassoBox || !activePage || !lassoStart) return;
      const point = pagePoint(event, activePage);
      const left = Math.min(lassoStart.x, point.x);
      const top = Math.min(lassoStart.y, point.y);
      const width = Math.abs(point.x - lassoStart.x);
      const height = Math.abs(point.y - lassoStart.y);
      Object.assign(lassoBox.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    });

    editableViewer?.addEventListener("pointerup", event => {
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
    lassoSelection = [...page.querySelectorAll(".text-item,.image-item,.inserted-block")].filter(el => {
      if (el.classList.contains("deleted")) return false;
      return rectsIntersect(boxRect, el.getBoundingClientRect());
    });
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

  function deleteLassoArea() {
    if (!lassoBox) return alert("Draw a lasso area first.");
    const pageContent = lassoBox.closest(".page-content");
    const redaction = document.createElement("div");
    redaction.className = "redaction-box";
    redaction.style.left = lassoBox.style.left;
    redaction.style.top = lassoBox.style.top;
    redaction.style.width = lassoBox.style.width;
    redaction.style.height = lassoBox.style.height;
    pageContent?.appendChild(redaction);
    lassoSelection.forEach(el => el.classList.add("deleted"));
    lassoBox.remove();
    lassoBox = null;
    lassoSelection = [];
  }

  function moveSelection(deltaY) {
    const targets = lassoSelection.length ? lassoSelection : (currentSelected ? [currentSelected] : []);
    if (!targets.length) return alert("Select text with the lasso or click one text item first.");
    targets.forEach(el => {
      if (!el.classList.contains("text-item") && !el.classList.contains("inserted-block")) return;
      const currentTop = parseFloat(el.style.top || "0");
      el.style.top = `${currentTop + deltaY}px`;
      el.dataset.movedVerticalOnly = "true";
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
    injectToolPanel();
    bindSelectionTracking();
    bindLasso();
    addRenderedBackgrounds();
    applyDismissedMatches();
    new MutationObserver(() => {
      injectToolPanel();
      addRenderedBackgrounds();
      applyDismissedMatches();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
