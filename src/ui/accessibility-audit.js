// Local development aid. The production build removes its guarded import.
export async function installAccessibilityAudit({ inspectMap, startMotion } = {}) {
  const panel = document.createElement("aside");
  panel.id = "accessibilityAuditPanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Development accessibility audit");
  panel.innerHTML = `
    <style>
      #accessibilityAuditPanel { position: fixed; z-index: 10000; left: 12px; bottom: 12px; max-width: min(680px, calc(100vw - 24px)); color: #202d25; font: 14px/1.5 system-ui, sans-serif; }
      #accessibilityAuditPanel button { padding: 8px 12px; border: 1px solid #40564a; border-radius: 4px; background: #fff; color: #202d25; font: inherit; cursor: pointer; }
      #accessibilityAuditPanel button:focus-visible { outline: 3px solid #a54e35; outline-offset: 3px; }
      #accessibilityAuditPanel .audit-output { margin-top: 6px; padding: 12px; max-height: 55dvh; overflow: auto; background: #fff; border: 1px solid #40564a; border-radius: 4px; box-shadow: 0 3px 20px #0002; }
      #accessibilityAuditPanel .audit-output[hidden] { display: none; }
      #accessibilityAuditPanel pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, monospace; }
      #accessibilityAuditPanel p { margin: 0 0 8px; }
    </style>
    <button type="button" data-audit-run>Run accessibility scan</button>
    <button type="button" data-audit-map>Check map layout</button>
    <button type="button" data-audit-motion>Record journey motion</button>
    <button type="button" data-audit-hide hidden>Hide results</button>
    <div class="audit-output" hidden>
      <p role="status"></p>
      <pre tabindex="0" aria-label="Accessibility scan results"></pre>
    </div>
  `;
  document.body.append(panel);
  // Scanning a popover must not trigger its outside-click dismissal.
  panel.addEventListener("click", (event) => event.stopPropagation());
  const runButton = panel.querySelector("[data-audit-run]");
  const mapButton = panel.querySelector("[data-audit-map]");
  const motionButton = panel.querySelector("[data-audit-motion]");
  const hideButton = panel.querySelector("[data-audit-hide]");
  const output = panel.querySelector(".audit-output");
  const status = panel.querySelector("[role=status]");
  const pre = panel.querySelector("pre");
  let axe;
  let stopMotion;
  const focusEvents = [];
  for (const type of ["focusin", "focusout"]) document.addEventListener(type, (event) => {
    const element = event.target;
    focusEvents.push({ type, tag: element.tagName, id: element.id, place: element.dataset?.place, time: Math.round(performance.now()) });
    if (focusEvents.length > 30) focusEvents.shift();
  });

  function hideResults() {
    output.hidden = true;
    hideButton.hidden = true;
    panel.hidden = true;
  }
  hideButton.addEventListener("click", hideResults);
  async function runScan() {
    if (runButton.disabled) return;
    const activeElement = document.activeElement;
    runButton.disabled = true;
    output.hidden = true;
    pre.textContent = "";
    panel.style.visibility = "hidden";
    try {
      axe ??= (await import("axe-core")).default;
      const result = await axe.run({ exclude: [["#accessibilityAuditPanel"]] }, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }
      });
      status.textContent = `${result.violations.length} violations; ${result.passes.length} checks passed; ${result.incomplete.length} checks need review.`;
      pre.textContent = JSON.stringify({
        url: location.href,
        viewport: `${innerWidth}×${innerHeight}`,
        violations: result.violations.map(({ id, impact, help, helpUrl, nodes }) => ({
          id, impact, help, helpUrl,
          nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary }))
        })),
        incomplete: result.incomplete.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))
      }, null, 2);
    } catch (error) {
      status.textContent = "The accessibility scan could not complete.";
      pre.textContent = String(error);
    } finally {
      panel.hidden = false;
      panel.style.visibility = "";
      runButton.disabled = false;
      output.hidden = false;
      hideButton.hidden = false;
      if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
    }
  }
  runButton.addEventListener("click", runScan);
  async function runMapCheck() {
    if (mapButton.disabled) return;
    mapButton.disabled = true;
    mapButton.textContent = "Checking map…";
    output.hidden = true;
    panel.hidden = false;
    try {
      const result = await inspectMap?.() || { error: "Map inspection is unavailable." };
      result.focusEvents = focusEvents;
      status.textContent = "Map layout inspection. Review projected positions alongside the rendered map.";
      pre.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      status.textContent = "Map inspection could not complete.";
      pre.textContent = JSON.stringify({ error: String(error) });
    } finally {
      mapButton.disabled = false;
      mapButton.textContent = "Check map layout";
      output.hidden = false;
      hideButton.hidden = false;
    }
  }
  mapButton.addEventListener("click", runMapCheck);
  function toggleMotion() {
    panel.hidden = false;
    output.hidden = false;
    hideButton.hidden = false;
    if (stopMotion) {
      pre.textContent = JSON.stringify(stopMotion(), null, 2);
      stopMotion = null;
      status.textContent = "Journey marker positions recorded during movement.";
      motionButton.textContent = "Record journey motion";
    } else {
      stopMotion = startMotion?.();
      pre.textContent = "";
      status.textContent = "Recording. Hide this panel, move the map, then press Alt+Shift+T to finish.";
      motionButton.textContent = "Finish recording";
    }
  }
  motionButton.addEventListener("click", toggleMotion);
  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "KeyT") {
      event.preventDefault();
      toggleMotion();
    }
    if (event.altKey && event.shiftKey && event.code === "KeyA") {
      event.preventDefault();
      runScan();
    }
    if (event.altKey && event.shiftKey && event.code === "KeyH") {
      event.preventDefault();
      hideResults();
    }
    if (event.altKey && event.shiftKey && event.code === "KeyM") {
      event.preventDefault();
      runMapCheck();
    }
  });
}
