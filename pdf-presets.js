(() => {
  const presets = [
    {
      id: "time",
      label: "Remove study-time estimates",
      description: "Deletes hours/time estimates and obvious time-spend instructions.",
      steps: [{ group: "hours", action: "delete" }]
    },
    {
      id: "conversational",
      label: "Remove conversational wording",
      description: "Deletes likely 'you', 'your', 'let us', and conversational instruction fragments.",
      steps: [{ group: "you", action: "delete" }]
    },
    {
      id: "quizzes",
      label: "Remove quiz / answer clutter",
      description: "Deletes MCQ options and question clutter. Review after running, because not every question is unwanted.",
      steps: [{ group: "mcq", action: "delete" }, { group: "questions", action: "hide" }]
    },
    {
      id: "design",
      label: "Remove design clutter",
      description: "Hides detected image/design placeholders and text-box clutter.",
      steps: [{ group: "images", action: "hide" }, { group: "clutter", action: "hide" }]
    },
    {
      id: "plain-study",
      label: "Plain study notes mode",
      description: "Turns on plain white mode, removes time estimates and conversational wording, hides image/design clutter.",
      plain: true,
      steps: [{ group: "hours", action: "delete" }, { group: "you", action: "delete" }, { group: "images", action: "hide" }, { group: "clutter", action: "hide" }]
    }
  ];

  function injectPresets() {
    if (document.getElementById("presetPanel")) return;
    const tools = document.querySelector(".tools-panel");
    if (!tools) return;
    const panel = document.createElement("section");
    panel.id = "presetPanel";
    panel.className = "panel preset-panel";
    panel.innerHTML = `
      <p class="eyebrow">Presets</p>
      <h2>One-click cleanup</h2>
      <p class="hint">Run a preset, then use Undo if it removes too much. Export edit state before heavy cleanup.</p>
      <div class="preset-list">
        ${presets.map(p => `<button class="ghost preset-button" type="button" data-preset="${p.id}"><strong>${p.label}</strong><span>${p.description}</span></button>`).join("")}
      </div>`;
    const secondPanel = tools.children[1];
    tools.insertBefore(panel, secondPanel || null);
    panel.querySelectorAll("[data-preset]").forEach(button => {
      button.addEventListener("click", () => runPreset(button.dataset.preset));
    });
  }

  function runPreset(id) {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    const loaded = document.querySelector(".edit-page");
    if (!loaded) {
      alert("Open a PDF before running a cleanup preset.");
      return;
    }
    const ok = confirm(`Run preset: ${preset.label}?\n\n${preset.description}\n\nUse Undo if it removes too much.`);
    if (!ok) return;
    if (preset.plain) {
      const plain = document.getElementById("plainMode");
      if (plain && !plain.checked) {
        plain.checked = true;
        plain.dispatchEvent(new Event("change"));
      }
    }
    preset.steps.forEach(step => {
      const chip = document.querySelector(`.chip[data-group="${step.group}"]`);
      chip?.click();
      const actionButton = document.getElementById(step.action === "delete" ? "deleteGroup" : "hideGroup");
      actionButton?.click();
    });
    document.getElementById("rescanPatterns")?.click();
  }

  injectPresets();
  new MutationObserver(injectPresets).observe(document.body, { childList: true, subtree: true });
})();
