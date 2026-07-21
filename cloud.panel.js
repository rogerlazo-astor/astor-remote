/**
 * ASTOR CLOUD PANEL v1.0
 * Panel "Nube" en la sidebar: lista casos sincronizados con Supabase,
 * muestra archivos subidos y permite ver el detalle de cada caso.
 */
(function () {
  "use strict";

  /* ── Helpers ── */

  function esc(value = "") {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileIcon(type = "") {
    if (type.startsWith("image/")) return "🖼";
    if (type.startsWith("video/")) return "🎥";
    if (type === "application/pdf") return "📄";
    return "📎";
  }

  /* ── Etiquetas legibles para file_key ── */

  const FILE_LABELS = {
    prescription: "Receta médica",
    gaitVideo: "Video de marcha",
    paymentProof: "Comprobante de pago",
    postureFront: "Postura frontal",
    postureBack: "Postura posterior",
    postureRight: "Postura lateral derecha",
    postureLeft: "Postura lateral izquierda",
    leftDorsal: "Pie izq. dorsal",
    leftPlantar: "Pie izq. plantar",
    leftMedial: "Pie izq. medial",
    leftLateral: "Pie izq. lateral",
    leftPosterior: "Pie izq. posterior",
    rightDorsal: "Pie der. dorsal",
    rightPlantar: "Pie der. plantar",
    rightMedial: "Pie der. medial",
    rightLateral: "Pie der. lateral",
    rightPosterior: "Pie der. posterior",
  };

  function fileLabel(key) {
    return FILE_LABELS[key] || key;
  }

  /* ── Estado del panel ── */

  const panelState = {
    cases: [],
    loading: false,
    selectedCaseId: null,
    selectedFiles: [],
  };

  /* ── Referencias DOM ── */

  function q(selector) {
    return document.querySelector(selector);
  }

  /* ── Inyección del nav item y la sección ── */

  function injectPanel() {
    /* Nav item */
    const nav = q(".nav-list");
    if (nav && !q('[data-section="nube"]')) {
      const btn = document.createElement("button");
      btn.className = "nav-item";
      btn.type = "button";
      btn.dataset.section = "nube";
      btn.innerHTML = '<span class="icon">☁</span><span>Nube</span>';
      nav.appendChild(btn);

      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".nav-item")
          .forEach((x) => x.classList.remove("active"));
        document
          .querySelectorAll(".view")
          .forEach((x) => x.classList.remove("active-view"));
        btn.classList.add("active");
        q("#nube")?.classList.add("active-view");
        loadCloudCases();
      });
    }

    /* Sección principal */
    const main = q(".main-panel");
    if (main && !q("#nube")) {
      const section = document.createElement("section");
      section.id = "nube";
      section.className = "view";
      section.innerHTML = `
        <div class="section-head">
          <div>
            <h3>Casos en la nube</h3>
            <p>Casos sincronizados con Supabase para este dispositivo.</p>
          </div>
          <button id="cloudRefreshBtn" class="ghost-btn" type="button">Actualizar</button>
        </div>

        <div id="cloudStatusBar" class="cloud-status-bar" hidden></div>

        <div id="cloudCasesGrid" class="cloud-cases-grid">
          <p class="cloud-empty">Abre este panel para cargar los casos sincronizados.</p>
        </div>

        <div id="cloudCaseDetail" class="cloud-case-detail" hidden>
          <div class="cloud-detail-head">
            <div>
              <h4 id="cloudDetailCode">—</h4>
              <p id="cloudDetailPatient">—</p>
            </div>
            <button id="cloudDetailClose" class="ghost-btn" type="button">✕ Cerrar</button>
          </div>
          <div class="cloud-detail-meta" id="cloudDetailMeta"></div>
          <h4 class="cloud-files-heading">Archivos en Storage</h4>
          <div id="cloudFilesList" class="cloud-files-list">
            <p>Cargando archivos…</p>
          </div>
        </div>
      `;
      main.appendChild(section);

      q("#cloudRefreshBtn")?.addEventListener("click", loadCloudCases);
      q("#cloudDetailClose")?.addEventListener("click", closeDetail);
    }
  }

  /* ── Carga de casos desde Supabase ── */

  async function loadCloudCases() {
    if (!window.ASTOR_CLOUD?.isConfigured()) {
      showStatus("Supabase no configurado. Verifica supabase.config.js.", true);
      return;
    }

    setLoading(true);
    showStatus("Cargando casos…");

    try {
      panelState.cases = await window.ASTOR_CLOUD.listCloudCases();
      renderCasesGrid();
      showStatus(
        panelState.cases.length > 0
          ? `${panelState.cases.length} caso(s) encontrado(s).`
          : "No hay casos sincronizados todavía.",
        false
      );
    } catch (err) {
      console.error("ASTOR Cloud Panel:", err);
      showStatus(`Error al cargar: ${err.message}`, true);
      renderError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Render de la grilla de casos ── */

  function renderCasesGrid() {
    const grid = q("#cloudCasesGrid");
    if (!grid) return;

    closeDetail();

    if (!panelState.cases.length) {
      grid.innerHTML =
        '<p class="cloud-empty">No hay casos sincronizados todavía.<br>Usa el botón <strong>Enviar caso a la nube</strong> desde la sidebar.</p>';
      return;
    }

    grid.innerHTML = panelState.cases
      .map((c) => {
        const filesPayload = c.payload?.files || {};
        const totalFiles = Object.keys(filesPayload).length;
        const cloudFiles = Object.values(filesPayload).filter(
          (f) => f?.cloudUrl
        ).length;
        const syncPct =
          totalFiles > 0 ? Math.round((cloudFiles / totalFiles) * 100) : 0;

        const statusClass =
          c.status === "Entregada" || c.status === "Despachada"
            ? "ok"
            : c.status === "En fabricacion" || c.status === "Aprobada"
            ? ""
            : "warn";

        return `
          <article class="cloud-case-card" data-cloud-id="${esc(c.id)}">
            <div class="cloud-card-head">
              <strong>${esc(c.case_code)}</strong>
              <span class="badge ${statusClass}">${esc(c.status || "draft")}</span>
            </div>
            <h4>${esc(c.patient_name || "Sin nombre")}</h4>
            <p>${esc(c.city || "Sin ciudad")} · ${formatDate(c.updated_at)}</p>
            <div class="cloud-card-files">
              <div class="cloud-file-bar">
                <div class="cloud-file-bar-fill" style="width:${syncPct}%"></div>
              </div>
              <small>${cloudFiles} / ${totalFiles} archivos subidos</small>
            </div>
            <button class="ghost-btn cloud-detail-btn" type="button" data-cloud-id="${esc(c.id)}">
              Ver detalle
            </button>
          </article>
        `;
      })
      .join("");

    grid.querySelectorAll(".cloud-detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => openDetail(btn.dataset.cloudId));
    });
  }

  /* ── Detalle de un caso ── */

  async function openDetail(caseId) {
    const caseData = panelState.cases.find((c) => c.id === caseId);
    if (!caseData) return;

    panelState.selectedCaseId = caseId;

    q("#cloudDetailCode").textContent = caseData.case_code || "—";
    q("#cloudDetailPatient").textContent =
      caseData.patient_name || "Sin nombre";

    const meta = q("#cloudDetailMeta");
    if (meta) {
      const p = caseData.payload || {};
      meta.innerHTML = `
        <div class="cloud-meta-grid">
          <span>Ciudad</span><strong>${esc(caseData.city || "—")}</strong>
          <span>Estado</span><strong>${esc(caseData.status || "—")}</strong>
          <span>Sincronizado</span><strong>${formatDate(caseData.updated_at)}</strong>
          <span>IMC</span><strong>${esc(p.fields?.bmiValue || "—")} · ${esc(p.fields?.bmiClassification || "—")}</strong>
          <span>Diagnóstico</span><strong>${esc(p.fields?.diagnosis || "—")}</strong>
          <span>Pago</span><strong>${esc(p.fields?.paymentStatus || "—")}</strong>
        </div>
      `;
    }

    const filesList = q("#cloudFilesList");
    if (filesList) filesList.innerHTML = "<p>Cargando archivos…</p>";

    q("#cloudCaseDetail").hidden = false;
    q("#cloudCasesGrid").style.opacity = "0.4";

    try {
      panelState.selectedFiles = await window.ASTOR_CLOUD.listCaseFiles(caseId);
      renderFilesList(panelState.selectedFiles, caseData.payload?.files || {});
    } catch (err) {
      if (filesList)
        filesList.innerHTML = `<p class="cloud-error">Error al cargar archivos: ${esc(err.message)}</p>`;
    }
  }

  function renderFilesList(files, payloadFiles) {
    const container = q("#cloudFilesList");
    if (!container) return;

    /* Combina archivos en Storage + metadatos del payload */
    const allKeys = new Set([
      ...files.map((f) => f.file_key),
      ...Object.keys(payloadFiles),
    ]);

    if (!allKeys.size) {
      container.innerHTML =
        '<p class="cloud-empty">No se han subido archivos para este caso.</p>';
      return;
    }

    const rows = Array.from(allKeys).map((key) => {
      const fromDb = files.find((f) => f.file_key === key);
      const fromPayload = payloadFiles[key];

      const name = fromDb?.file_name || fromPayload?.name || key;
      const type = fromDb?.mime_type || fromPayload?.type || "";
      const size = fromDb?.size_bytes || fromPayload?.size || 0;
      const url = fromDb?.public_url || fromPayload?.cloudUrl || null;
      const inCloud = Boolean(url);

      return `
        <div class="cloud-file-row ${inCloud ? "synced" : "pending"}">
          <span class="cloud-file-icon">${fileIcon(type)}</span>
          <div class="cloud-file-info">
            <strong>${esc(fileLabel(key))}</strong>
            <small>${esc(name)} · ${formatSize(size)}</small>
          </div>
          <div class="cloud-file-status">
            ${
              inCloud
                ? `<a class="cloud-file-link" href="${esc(url)}" target="_blank" rel="noopener">Ver</a>
                   <span class="cloud-badge-ok">✓ Cloud</span>`
                : `<span class="cloud-badge-pending">Solo local</span>`
            }
          </div>
        </div>
      `;
    });

    container.innerHTML = rows.join("");
  }

  function closeDetail() {
    panelState.selectedCaseId = null;
    panelState.selectedFiles = [];
    const detail = q("#cloudCaseDetail");
    const grid = q("#cloudCasesGrid");
    if (detail) detail.hidden = true;
    if (grid) grid.style.opacity = "1";
  }

  /* ── Helpers UI ── */

  function showStatus(msg, isError = false) {
    const bar = q("#cloudStatusBar");
    if (!bar) return;
    bar.textContent = msg;
    bar.hidden = false;
    bar.className = `cloud-status-bar${isError ? " error" : ""}`;
  }

  function setLoading(loading) {
    panelState.loading = loading;
    const btn = q("#cloudRefreshBtn");
    if (btn) {
      btn.disabled = loading;
      btn.textContent = loading ? "Cargando…" : "Actualizar";
    }
  }

  function renderError(msg) {
    const grid = q("#cloudCasesGrid");
    if (grid)
      grid.innerHTML = `<p class="cloud-error">Error: ${esc(msg)}<br><small>Revisa la consola para más detalles.</small></p>`;
  }

  /* ── Init ── */

  function initCloudPanel() {
    injectPanel();
  }

  /* Espera a que el DOM esté listo */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCloudPanel);
  } else {
    initCloudPanel();
  }

  /* API pública mínima */
  window.ASTOR_CLOUD_PANEL = { reload: loadCloudCases };
})();
