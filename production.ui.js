/**
 * ASTOR UPDATE 003
 * Orden visual de producción + integración con Fabrication Engine.
 */
(function () {
  "use strict";

  function rec() {
    return typeof activeRecord === "function" ? activeRecord() : null;
  }

  function esc(value = "") {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function ensureEngine() {
    if (!window.ASTOR_FABRICATION_ENGINE) {
      alert("El motor de fabricación no está cargado.");
      return false;
    }
    return true;
  }

  function proposal() {
    const record = rec();
    if (!record || !ensureEngine()) return null;
    return window.ASTOR_FABRICATION_ENGINE.evaluate(record);
  }

  function injectProductionPanel() {
    const orderSection = document.querySelector("#orden");
    if (!orderSection || document.querySelector("#astorProductionPanel")) return;

    const panel = document.createElement("section");
    panel.id = "astorProductionPanel";
    panel.className = "astor-production-panel";
    panel.innerHTML = `
      <div class="astor-production-head">
        <div>
          <p class="eyebrow">ASTOR FABRICATION ENGINE</p>
          <h3>Orden visual de producción</h3>
          <p>Propuesta preliminar editable y pendiente de validación profesional.</p>
        </div>
        <div class="astor-production-actions">
          <button id="astorGenerateProposal" class="primary-btn" type="button">
            Generar propuesta
          </button>
          <button id="astorCopyProductionOrder" class="ghost-btn" type="button">
            Copiar orden
          </button>
          <button id="astorPrintProductionOrder" class="ghost-btn" type="button">
            Imprimir
          </button>
        </div>
      </div>

      <div id="astorProductionAlert" class="astor-production-alert" hidden></div>

      <div class="astor-layer-grid">
        <article class="astor-layer-card">
          <span class="astor-layer-number">1</span>
          <h4>Base</h4>
          <div class="astor-field-row">
            <span>Material</span><strong id="astorBaseMaterial">—</strong>
          </div>
          <div class="astor-field-row">
            <span>Densidad</span><strong id="astorBaseDensity">—</strong>
          </div>
          <div class="astor-field-row">
            <span>Espesor</span><strong id="astorBaseThickness">—</strong>
          </div>
        </article>

        <article class="astor-layer-card">
          <span class="astor-layer-number">2</span>
          <h4>Estructura</h4>
          <div class="astor-field-row">
            <span>Material</span><strong id="astorStructureMaterial">—</strong>
          </div>
          <div class="astor-field-row">
            <span>Extensión</span><strong id="astorStructureExtension">—</strong>
          </div>
          <div class="astor-field-row">
            <span>Función</span><strong id="astorStructureNotes">—</strong>
          </div>
        </article>

        <article class="astor-layer-card">
          <span class="astor-layer-number">3</span>
          <h4>Correcciones</h4>
          <div id="astorCorrectionsList" class="astor-chip-list">
            <span class="astor-empty-chip">Sin propuesta</span>
          </div>
          <h5>Descargas</h5>
          <div id="astorUnloadsList" class="astor-chip-list">
            <span class="astor-empty-chip">Sin propuesta</span>
          </div>
        </article>

        <article class="astor-layer-card">
          <span class="astor-layer-number">4</span>
          <h4>Top cover</h4>
          <div class="astor-field-row">
            <span>Material</span><strong id="astorTopMaterial">—</strong>
          </div>
          <div class="astor-field-row">
            <span>Espesor</span><strong id="astorTopThickness">—</strong>
          </div>
          <h5>Complementos</h5>
          <div id="astorTopExtras" class="astor-chip-list">
            <span class="astor-empty-chip">Sin complementos</span>
          </div>
        </article>
      </div>

      <div class="astor-production-bottom-grid">
        <article class="astor-summary-card">
          <h4>Geometría y refuerzos</h4>
          <div class="astor-field-row"><span>Copa de talón</span><strong id="astorHeelCup">—</strong></div>
          <div class="astor-field-row"><span>Perfil de arco</span><strong id="astorArchProfile">—</strong></div>
          <div id="astorReinforcements" class="astor-chip-list"></div>
        </article>

        <article class="astor-summary-card">
          <h4>Observaciones de fabricación</h4>
          <ul id="astorManufacturingNotes" class="astor-production-list">
            <li>Genera la propuesta para visualizar las indicaciones.</li>
          </ul>
        </article>

        <article class="astor-summary-card">
          <h4>Fundamento clínico</h4>
          <ul id="astorRationale" class="astor-production-list">
            <li>Pendiente.</li>
          </ul>
        </article>
      </div>

      <fieldset class="astor-validation-box">
        <legend>Validación profesional</legend>
        <label>
          <input type="checkbox" name="fabricationProposalApproved">
          Apruebo la propuesta técnica para fabricación.
        </label>
        <label>
          Ajustes finales
          <textarea name="fabricationFinalAdjustments" rows="5"
            placeholder="Registrar cambios manuales antes de liberar la orden."></textarea>
        </label>
        <button id="astorReleaseProductionOrder" class="primary-btn" type="button">
          Liberar orden a producción
        </button>
      </fieldset>
    `;

    orderSection.appendChild(panel);

    document.querySelector("#astorGenerateProposal")
      ?.addEventListener("click", renderProposal);

    document.querySelector("#astorCopyProductionOrder")
      ?.addEventListener("click", copyOrder);

    document.querySelector("#astorPrintProductionOrder")
      ?.addEventListener("click", printOrder);

    document.querySelector("#astorReleaseProductionOrder")
      ?.addEventListener("click", releaseOrder);

    document.querySelector('[name="fabricationProposalApproved"]')
      ?.addEventListener("change", persistValidation);

    document.querySelector('[name="fabricationFinalAdjustments"]')
      ?.addEventListener("input", persistValidation);
  }

  function renderChips(containerId, values, emptyText) {
    const container = document.querySelector(containerId);
    if (!container) return;

    container.innerHTML = values?.length
      ? values.map((value) => `<span class="astor-production-chip">${esc(value)}</span>`).join("")
      : `<span class="astor-empty-chip">${esc(emptyText)}</span>`;
  }

  function renderList(containerId, values, emptyText) {
    const container = document.querySelector(containerId);
    if (!container) return;

    container.innerHTML = values?.length
      ? values.map((value) => `<li>${esc(value)}</li>`).join("")
      : `<li>${esc(emptyText)}</li>`;
  }

  function renderProposal() {
    const record = rec();
    if (!record) {
      alert("Primero crea o selecciona un caso.");
      return;
    }

    const data = proposal();
    if (!data) return;

    document.querySelector("#astorBaseMaterial").textContent =
      data.layers.base.material;
    document.querySelector("#astorBaseDensity").textContent =
      `${data.layers.base.shoreA} Shore A`;
    document.querySelector("#astorBaseThickness").textContent =
      `${data.layers.base.thicknessMm} mm`;

    document.querySelector("#astorStructureMaterial").textContent =
      data.layers.structure.material;
    document.querySelector("#astorStructureExtension").textContent =
      data.layers.structure.extension;
    document.querySelector("#astorStructureNotes").textContent =
      data.layers.structure.notes;

    document.querySelector("#astorTopMaterial").textContent =
      data.layers.topCover.material;
    document.querySelector("#astorTopThickness").textContent =
      data.layers.topCover.thicknessMm
        ? `${data.layers.topCover.thicknessMm} mm`
        : "Según diseño";

    document.querySelector("#astorHeelCup").textContent = data.heelCup;
    document.querySelector("#astorArchProfile").textContent = data.archProfile;

    renderChips("#astorCorrectionsList", data.layers.corrections, "Sin propuesta");
    renderChips("#astorUnloadsList", data.unloads, "Sin propuesta");
    renderChips("#astorTopExtras", data.layers.topCover.additionalMaterials, "Sin complementos");
    renderChips("#astorReinforcements", data.reinforcements, "Sin refuerzos");
    renderList("#astorManufacturingNotes", data.manufacturingNotes, "Sin observaciones");
    renderList("#astorRationale", data.rationale, "Sin fundamentos automáticos");

    const alertBox = document.querySelector("#astorProductionAlert");
    if (alertBox) {
      if (data.alerts.length) {
        alertBox.hidden = false;
        alertBox.innerHTML = `
          <strong>Alertas clínicas</strong>
          <ul>${data.alerts.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        `;
      } else {
        alertBox.hidden = true;
        alertBox.innerHTML = "";
      }
    }

    record.fabricationProposal = data;

    if (typeof addHistoryEvent === "function") {
      addHistoryEvent(
        "Propuesta de fabricación generada",
        `Base EVA ${data.layers.base.shoreA} Shore A de ${data.layers.base.thicknessMm} mm.`
      );
    }

    if (typeof persistActive === "function") persistActive();
  }

  function loadSavedProposal() {
    const record = rec();
    if (!record) return;

    const approved = document.querySelector('[name="fabricationProposalApproved"]');
    const adjustments = document.querySelector('[name="fabricationFinalAdjustments"]');

    if (approved) approved.checked = Boolean(record.checks?.fabricationProposalApproved);
    if (adjustments) adjustments.value = record.fields?.fabricationFinalAdjustments || "";

    if (record.fabricationProposal) renderProposal();
  }

  function persistValidation() {
    const record = rec();
    if (!record) return;

    record.checks = record.checks || {};
    record.fields = record.fields || {};

    record.checks.fabricationProposalApproved =
      Boolean(document.querySelector('[name="fabricationProposalApproved"]')?.checked);

    record.fields.fabricationFinalAdjustments =
      document.querySelector('[name="fabricationFinalAdjustments"]')?.value || "";

    if (typeof scheduleSave === "function") scheduleSave();
  }

  async function copyOrder() {
    const record = rec();
    if (!record || !ensureEngine()) {
      if (!record) alert("Primero crea o selecciona un caso.");
      return;
    }

    const text = window.ASTOR_FABRICATION_ENGINE.formatOrder(
      record,
      record.fabricationProposal || proposal()
    );

    if (typeof copyTextToClipboard === "function") {
      await copyTextToClipboard(text);
    } else {
      await navigator.clipboard.writeText(text);
    }

    alert("Orden de fabricación copiada.");
  }

  function printOrder() {
    const record = rec();
    if (!record || !ensureEngine()) {
      if (!record) alert("Primero crea o selecciona un caso.");
      return;
    }

    const text = window.ASTOR_FABRICATION_ENGINE.formatOrder(
      record,
      record.fabricationProposal || proposal()
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Permite ventanas emergentes para imprimir la orden.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Orden ${esc(record.code)}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:30px;color:#17384c}
          h1{margin:0;color:#0c5674}
          pre{white-space:pre-wrap;font:15px/1.5 Arial,sans-serif}
          .box{border:1px solid #b8cbd5;border-radius:14px;padding:22px;margin-top:20px}
          footer{margin-top:28px;border-top:1px solid #ccd9df;padding-top:12px;font-size:12px}
        </style>
      </head>
      <body>
        <h1>ASTOR Remote Clinic</h1>
        <p>Orden preliminar de fabricación</p>
        <div class="box"><pre>${esc(text)}</pre></div>
        <footer>Pendiente de validación profesional.</footer>
        <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
      </body>
      </html>
    `);

    printWindow.document.close();
  }

  function releaseOrder() {
    const record = rec();
    if (!record) {
      alert("Primero crea o selecciona un caso.");
      return;
    }

    const approved =
      document.querySelector('[name="fabricationProposalApproved"]')?.checked;

    if (!approved) {
      alert("Debes aprobar la propuesta técnica antes de liberar la orden.");
      return;
    }

    persistValidation();

    record.fields.orderStatus = "En fabricación";
    record.fields.productionReleasedAt = new Date().toISOString();

    if (typeof addHistoryEvent === "function") {
      addHistoryEvent(
        "Orden liberada a producción",
        record.fields.fabricationFinalAdjustments || "Sin ajustes adicionales."
      );
    }

    if (typeof persistActive === "function") persistActive();
    if (typeof renderAll === "function") renderAll();

    alert(`Caso ${record.code} liberado a producción.`);
  }

  function observeRecordChange() {
    const title = document.querySelector("#activePatientTitle");
    if (!title || typeof MutationObserver === "undefined") return;

    new MutationObserver(() => {
      setTimeout(loadSavedProposal, 80);
    }).observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function init() {
    injectProductionPanel();
    observeRecordChange();
    setTimeout(loadSavedProposal, 400);
  }

  init();
})();
