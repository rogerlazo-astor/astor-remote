/**
 * ASTOR UPDATE 004 — ASTOR LAB v1.0
 * Panel de producción por lotes y etapas.
 *
 * Flujo:
 * Ingreso → LEFA → Realces → Pulido → Top Cover → Logo →
 * Control de calidad → Lista para entrega → Entregada
 */
(function () {
  "use strict";

  const STAGES = [
    { id: "Ingreso", label: "Ingreso" },
    { id: "LEFA", label: "LEFA" },
    { id: "Realces", label: "Realces" },
    { id: "Pulido", label: "Pulido" },
    { id: "Top Cover", label: "Top Cover" },
    { id: "Logo", label: "Logo y grabado" },
    { id: "Control de calidad", label: "Control de calidad" },
    { id: "Lista para entrega", label: "Lista para entrega" },
    { id: "Entregada", label: "Entregada" },
  ];

  let labRecords = [];
  let labCityFilter = "Todos";
  let labStageFilter = "Todos";

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

  function initials(name = "") {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "NN";
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  }

  function cityOf(record) {
    const city = String(record?.fields?.city || "").trim();
    if (/iquique/i.test(city)) return "Iquique";
    if (/arica/i.test(city)) return "Arica";
    return city || "Sin ciudad";
  }

  function stageOf(record) {
    return record?.fields?.labStage || "Ingreso";
  }

  function ensureLabData(record) {
    record.fields = record.fields || {};
    record.history = record.history || [];
    record.fields.labStage = record.fields.labStage || "Ingreso";
    record.fields.labTechnician = record.fields.labTechnician || "";
    record.fields.labPriority = record.fields.labPriority || "Normal";
    record.fields.labStartedAt = record.fields.labStartedAt || "";
    record.fields.labCompletedAt = record.fields.labCompletedAt || "";
    record.fields.labLastStageAt = record.fields.labLastStageAt || "";
    record.fields.labNotes = record.fields.labNotes || "";
    return record;
  }

  function nextStage(current) {
    const index = STAGES.findIndex((stage) => stage.id === current);
    if (index < 0 || index >= STAGES.length - 1) return current;
    return STAGES[index + 1].id;
  }

  function previousStage(current) {
    const index = STAGES.findIndex((stage) => stage.id === current);
    if (index <= 0) return current;
    return STAGES[index - 1].id;
  }

  function addLabHistory(record, title, detail = "") {
    record.history = record.history || [];
    record.history.unshift({
      at: new Date().toISOString(),
      title,
      detail,
    });
  }

  async function persistRecord(record) {
    if (typeof saveRecord === "function") {
      await saveRecord(record);
      return;
    }
    if (typeof persistActive === "function" && typeof activeRecord === "function") {
      const active = activeRecord();
      if (active?.id === record.id) persistActive();
    }
  }

  async function loadRecords() {
    try {
      if (typeof getAllRecords === "function") {
        labRecords = (await getAllRecords()).map(ensureLabData);
      } else {
        const active = typeof activeRecord === "function" ? activeRecord() : null;
        labRecords = active ? [ensureLabData(active)] : [];
      }
    } catch (error) {
      console.error("ASTOR LAB: no se pudieron cargar los casos", error);
      labRecords = [];
    }
    renderLab();
  }

  function injectNavigation() {
    const nav = document.querySelector(".nav-list");
    if (!nav || document.querySelector('[data-section="laboratorio"]')) return;

    const button = document.createElement("button");
    button.className = "nav-item";
    button.type = "button";
    button.dataset.section = "laboratorio";
    button.innerHTML = '<span class="icon">L</span><span>ASTOR LAB</span>';

    const ordersButton = nav.querySelector('[data-section="pedidos"]');
    if (ordersButton) ordersButton.insertAdjacentElement("afterend", button);
    else nav.appendChild(button);

    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
      document.querySelector("#laboratorio")?.classList.add("active-view");

      loadRecords();
    });
  }

  function injectLabSection() {
    const main = document.querySelector(".main-panel");
    if (!main || document.querySelector("#laboratorio")) return;

    const section = document.createElement("section");
    section.id = "laboratorio";
    section.className = "view";
    section.innerHTML = `
      <div class="astor-lab-hero">
        <div>
          <p class="eyebrow">ASTOR LAB · PRODUCCIÓN</p>
          <h3>Cola de fabricación por lotes y etapas</h3>
          <p>
            Arica primero, Iquique después. Cada caso avanza por LEFA, realces,
            pulido, top cover, grabado, control de calidad y entrega.
          </p>
        </div>
        <div class="astor-lab-hero-actions">
          <button id="astorLabRefresh" class="primary-btn" type="button">Actualizar</button>
          <button id="astorLabPrintBatch" class="ghost-btn" type="button">Imprimir lote visible</button>
        </div>
      </div>

      <div class="astor-lab-summary">
        <article><strong id="labTotal">0</strong><span>Total</span></article>
        <article><strong id="labArica">0</strong><span>Arica</span></article>
        <article><strong id="labIquique">0</strong><span>Iquique</span></article>
        <article><strong id="labInProcess">0</strong><span>En proceso</span></article>
        <article><strong id="labCompleted">0</strong><span>Terminadas</span></article>
      </div>

      <div class="astor-lab-toolbar">
        <div class="astor-lab-filter-group">
          <span>Sede</span>
          <button class="lab-filter active" data-lab-city="Todos" type="button">Todas</button>
          <button class="lab-filter" data-lab-city="Arica" type="button">Arica</button>
          <button class="lab-filter" data-lab-city="Iquique" type="button">Iquique</button>
        </div>
        <label>
          Etapa
          <select id="labStageFilter">
            <option value="Todos">Todas</option>
            ${STAGES.map((stage) => `<option value="${esc(stage.id)}">${esc(stage.label)}</option>`).join("")}
          </select>
        </label>
        <label>
          Buscar
          <input id="labSearch" type="search" placeholder="Paciente, código o iniciales">
        </label>
      </div>

      <div id="astorLabStageCards" class="astor-lab-stage-cards"></div>

      <div class="astor-lab-board-wrap">
        <table class="astor-lab-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Paciente</th>
              <th>Sede</th>
              <th>Largo</th>
              <th>Base</th>
              <th>Indicaciones</th>
              <th>Etapa</th>
              <th>Técnico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="astorLabBody"></tbody>
        </table>
      </div>
    `;

    main.appendChild(section);

    document.querySelector("#astorLabRefresh")?.addEventListener("click", loadRecords);
    document.querySelector("#astorLabPrintBatch")?.addEventListener("click", printVisibleBatch);

    document.querySelectorAll("[data-lab-city]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-lab-city]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        labCityFilter = button.dataset.labCity || "Todos";
        renderLab();
      });
    });

    document.querySelector("#labStageFilter")?.addEventListener("change", (event) => {
      labStageFilter = event.target.value;
      renderLab();
    });

    document.querySelector("#labSearch")?.addEventListener("input", renderLab);
  }

  function fabricationSummary(record) {
    const proposal = record.fabricationProposal ||
      (window.ASTOR_FABRICATION_ENGINE
        ? window.ASTOR_FABRICATION_ENGINE.evaluate(record)
        : null);

    if (!proposal) {
      return {
        base: "Sin propuesta",
        indications: record.fields?.corrections || "Pendiente",
      };
    }

    const corrections = [
      ...(proposal.layers?.corrections || []),
      ...(proposal.unloads || []),
    ];

    return {
      base: `EVA ${proposal.layers?.base?.shoreA || "—"} · ${proposal.layers?.base?.thicknessMm || 2} mm`,
      indications: corrections.length ? corrections.join(" · ") : "Sin realces automáticos",
    };
  }

  function lengthSummary(record) {
    const left = record.fields?.leftLengthCm;
    const right = record.fields?.rightLengthCm;
    if (left && right) return `I ${left} / D ${right} cm`;
    if (left) return `I ${left} cm`;
    if (right) return `D ${right} cm`;
    return "—";
  }

  function visibleRecords() {
    const search = String(document.querySelector("#labSearch")?.value || "")
      .trim()
      .toLowerCase();

    return labRecords
      .filter((record) => {
        const city = cityOf(record);
        const stage = stageOf(record);
        const haystack = [
          record.code,
          record.fields?.fullName,
          initials(record.fields?.fullName),
          city,
        ].join(" ").toLowerCase();

        return (
          (labCityFilter === "Todos" || city === labCityFilter) &&
          (labStageFilter === "Todos" || stage === labStageFilter) &&
          (!search || haystack.includes(search))
        );
      })
      .sort((a, b) => {
        const cityOrder = { Arica: 0, Iquique: 1, "Sin ciudad": 2 };
        const cityDiff = (cityOrder[cityOf(a)] ?? 3) - (cityOrder[cityOf(b)] ?? 3);
        if (cityDiff !== 0) return cityDiff;

        const priorityOrder = { Urgente: 0, Alta: 1, Normal: 2, Baja: 3 };
        const priorityDiff =
          (priorityOrder[a.fields?.labPriority] ?? 2) -
          (priorityOrder[b.fields?.labPriority] ?? 2);
        if (priorityDiff !== 0) return priorityDiff;

        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      });
  }

  function renderStageCards() {
    const container = document.querySelector("#astorLabStageCards");
    if (!container) return;

    container.innerHTML = STAGES.map((stage) => {
      const count = labRecords.filter((record) => stageOf(record) === stage.id).length;
      return `
        <button class="astor-stage-card ${labStageFilter === stage.id ? "active" : ""}"
          type="button" data-stage-card="${esc(stage.id)}">
          <strong>${count}</strong>
          <span>${esc(stage.label)}</span>
        </button>
      `;
    }).join("");

    container.querySelectorAll("[data-stage-card]").forEach((button) => {
      button.addEventListener("click", () => {
        labStageFilter = button.dataset.stageCard;
        const select = document.querySelector("#labStageFilter");
        if (select) select.value = labStageFilter;
        renderLab();
      });
    });
  }

  function renderSummary() {
    const total = labRecords.length;
    const arica = labRecords.filter((record) => cityOf(record) === "Arica").length;
    const iquique = labRecords.filter((record) => cityOf(record) === "Iquique").length;
    const completed = labRecords.filter((record) =>
      ["Lista para entrega", "Entregada"].includes(stageOf(record))
    ).length;
    const inProcess = total - completed;

    document.querySelector("#labTotal").textContent = total;
    document.querySelector("#labArica").textContent = arica;
    document.querySelector("#labIquique").textContent = iquique;
    document.querySelector("#labInProcess").textContent = inProcess;
    document.querySelector("#labCompleted").textContent = completed;
  }

  function renderLab() {
    if (!document.querySelector("#laboratorio")) return;

    renderSummary();
    renderStageCards();

    const tbody = document.querySelector("#astorLabBody");
    if (!tbody) return;

    const records = visibleRecords();
    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="astor-lab-empty">No hay casos para este filtro.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records.map((record) => {
      const tech = record.fields?.labTechnician || "";
      const summary = fabricationSummary(record);
      const stage = stageOf(record);
      const priority = record.fields?.labPriority || "Normal";

      return `
        <tr data-lab-record="${esc(record.id)}">
          <td>
            <div class="astor-lab-order-code">${esc(initials(record.fields?.fullName))}</div>
            <small>${esc(record.code || "Sin código")}</small>
            <span class="astor-lab-priority priority-${esc(priority.toLowerCase())}">
              ${esc(priority)}
            </span>
          </td>
          <td>
            <strong>${esc(record.fields?.fullName || "Sin nombre")}</strong>
            <small>${esc(record.fields?.diagnosis || record.fields?.mainPainArea || "Sin diagnóstico")}</small>
          </td>
          <td><span class="astor-city city-${esc(cityOf(record).toLowerCase())}">${esc(cityOf(record))}</span></td>
          <td>${esc(lengthSummary(record))}</td>
          <td>${esc(summary.base)}</td>
          <td class="astor-lab-indications">${esc(summary.indications)}</td>
          <td>
            <select data-lab-stage-select="${esc(record.id)}">
              ${STAGES.map((item) => `
                <option value="${esc(item.id)}" ${item.id === stage ? "selected" : ""}>
                  ${esc(item.label)}
                </option>
              `).join("")}
            </select>
          </td>
          <td>
            <input data-lab-technician="${esc(record.id)}"
              value="${esc(tech)}" placeholder="Nombre">
          </td>
          <td>
            <div class="astor-lab-actions">
              <button type="button" data-lab-prev="${esc(record.id)}">←</button>
              <button type="button" data-lab-next="${esc(record.id)}">→</button>
              <button type="button" data-lab-card="${esc(record.id)}">Ficha</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    bindRowActions();
  }

  function findRecord(id) {
    return labRecords.find((record) => String(record.id) === String(id));
  }

  async function setRecordStage(record, newStage) {
    const oldStage = stageOf(record);
    if (oldStage === newStage) return;

    const now = new Date().toISOString();
    record.fields.labStage = newStage;
    record.fields.labLastStageAt = now;

    if (!record.fields.labStartedAt && newStage !== "Ingreso") {
      record.fields.labStartedAt = now;
    }

    if (newStage === "Entregada") {
      record.fields.labCompletedAt = now;
    }

    if (newStage === "Lista para entrega") {
      record.fields.orderStatus = "Lista para despacho";
    } else if (newStage === "Entregada") {
      record.fields.orderStatus = "Entregada";
    } else if (newStage !== "Ingreso") {
      record.fields.orderStatus = "En fabricación";
    }

    addLabHistory(record, `Laboratorio: ${oldStage} → ${newStage}`);
    await persistRecord(record);
  }

  function bindRowActions() {
    document.querySelectorAll("[data-lab-stage-select]").forEach((select) => {
      select.addEventListener("change", async () => {
        const record = findRecord(select.dataset.labStageSelect);
        if (!record) return;
        await setRecordStage(record, select.value);
        renderLab();
      });
    });

    document.querySelectorAll("[data-lab-technician]").forEach((input) => {
      input.addEventListener("change", async () => {
        const record = findRecord(input.dataset.labTechnician);
        if (!record) return;
        record.fields.labTechnician = input.value.trim();
        addLabHistory(record, "Técnico asignado", record.fields.labTechnician || "Sin asignar");
        await persistRecord(record);
      });
    });

    document.querySelectorAll("[data-lab-next]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = findRecord(button.dataset.labNext);
        if (!record) return;
        await setRecordStage(record, nextStage(stageOf(record)));
        renderLab();
      });
    });

    document.querySelectorAll("[data-lab-prev]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = findRecord(button.dataset.labPrev);
        if (!record) return;
        await setRecordStage(record, previousStage(stageOf(record)));
        renderLab();
      });
    });

    document.querySelectorAll("[data-lab-card]").forEach((button) => {
      button.addEventListener("click", () => {
        const record = findRecord(button.dataset.labCard);
        if (record) printTechnicalCard(record);
      });
    });
  }

  function technicalCardHtml(record) {
    const summary = fabricationSummary(record);
    const proposal = record.fabricationProposal ||
      (window.ASTOR_FABRICATION_ENGINE
        ? window.ASTOR_FABRICATION_ENGINE.evaluate(record)
        : null);

    const corrections = proposal
      ? [...(proposal.layers?.corrections || []), ...(proposal.unloads || [])]
      : [];

    return `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Ficha ${esc(record.code)}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:24px;color:#17384c}
          .card{border:2px solid #153f56;border-radius:14px;padding:20px;max-width:720px}
          .head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #00a889;padding-bottom:12px}
          .initials{font-size:52px;font-weight:900;color:#006f91}
          h1{margin:0;font-size:24px} h2{font-size:18px;margin:20px 0 8px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
          .row{display:flex;justify-content:space-between;border-bottom:1px solid #dbe5eb;padding:7px 0}
          ul{margin:6px 0;padding-left:20px}
          footer{margin-top:18px;font-size:12px;color:#66808f}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">
            <div>
              <h1>ASTOR LAB</h1>
              <strong>${esc(record.fields?.fullName || "Sin nombre")}</strong>
              <div>${esc(record.code || "")}</div>
            </div>
            <div class="initials">${esc(initials(record.fields?.fullName))}</div>
          </div>

          <div class="grid">
            <div class="row"><span>Sede</span><strong>${esc(cityOf(record))}</strong></div>
            <div class="row"><span>Etapa</span><strong>${esc(stageOf(record))}</strong></div>
            <div class="row"><span>Largos</span><strong>${esc(lengthSummary(record))}</strong></div>
            <div class="row"><span>Base</span><strong>${esc(summary.base)}</strong></div>
            <div class="row"><span>Técnico</span><strong>${esc(record.fields?.labTechnician || "—")}</strong></div>
            <div class="row"><span>Prioridad</span><strong>${esc(record.fields?.labPriority || "Normal")}</strong></div>
          </div>

          <h2>Realces, correcciones y descargas</h2>
          <ul>
            ${corrections.length
              ? corrections.map((item) => `<li>${esc(item)}</li>`).join("")
              : "<li>Sin indicaciones automáticas.</li>"}
          </ul>

          <h2>Estructura</h2>
          <ul>
            <li>Base: ${esc(summary.base)}</li>
            <li>Cuero Flex / LEFA: ${esc(proposal?.layers?.structure?.extension || "Según diseño")}</li>
            <li>Top cover: ${esc(proposal?.layers?.topCover?.material || "Por definir")} ${esc(proposal?.layers?.topCover?.thicknessMm || "")} mm</li>
          </ul>

          <h2>Notas</h2>
          <p>${esc(record.fields?.fabricationFinalAdjustments || record.fields?.manufacturingNotes || "Sin notas adicionales.")}</p>

          <footer>Ficha técnica simplificada. Validar contra la orden profesional antes de fabricar.</footer>
        </div>
        <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
      </body>
      </html>
    `;
  }

  function printTechnicalCard(record) {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Permite ventanas emergentes para imprimir la ficha.");
      return;
    }
    win.document.write(technicalCardHtml(record));
    win.document.close();
  }

  function printVisibleBatch() {
    const records = visibleRecords();
    if (!records.length) {
      alert("No hay casos visibles para imprimir.");
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert("Permite ventanas emergentes para imprimir el lote.");
      return;
    }

    const cards = records.map((record) =>
      technicalCardHtml(record)
        .replace(/<!doctype html>[\s\S]*?<body>/i, "")
        .replace(/<script>[\s\S]*?<\/script>[\s\S]*?<\/body>[\s\S]*?<\/html>/i, "")
    ).join('<div style="page-break-after:always"></div>');

    win.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Lote ASTOR LAB</title>
        <style>
          body{font-family:Arial,sans-serif;margin:18px;color:#17384c}
          .card{border:2px solid #153f56;border-radius:14px;padding:20px}
          .head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #00a889;padding-bottom:12px}
          .initials{font-size:52px;font-weight:900;color:#006f91}
          h1{margin:0;font-size:24px} h2{font-size:18px;margin:20px 0 8px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
          .row{display:flex;justify-content:space-between;border-bottom:1px solid #dbe5eb;padding:7px 0}
          ul{margin:6px 0;padding-left:20px}
          footer{margin-top:18px;font-size:12px;color:#66808f}
        </style>
      </head>
      <body>${cards}<script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body>
      </html>
    `);
    win.document.close();
  }

  function observeChanges() {
    const title = document.querySelector("#activePatientTitle");
    if (!title || typeof MutationObserver === "undefined") return;

    new MutationObserver(() => {
      setTimeout(loadRecords, 100);
    }).observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function init() {
    injectNavigation();
    injectLabSection();
    observeChanges();
    loadRecords();
  }

  init();
})();
