/**
 * ASTOR REMOTE CLINIC — 4 módulos MVP
 * 1. IMC + riesgo
 * 2. Análisis postural clínico asistido
 * 3. Progreso del caso
 * 4. Informe imprimible / guardar como PDF
 */
(function () {
  "use strict";

  const POSTURE_FIELDS = [
    ["postureHeadForward", "Cabeza adelantada"],
    ["postureShoulderAsymmetry", "Asimetría de hombros"],
    ["posturePelvicTilt", "Inclinación pélvica"],
    ["postureKneeValgus", "Genu valgo"],
    ["postureKneeVarus", "Genu varo"],
    ["postureFootPronation", "Pronación visible"],
    ["postureFootSupination", "Supinación visible"],
    ["postureTrunkShift", "Desplazamiento del tronco"],
  ];

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

  function ensureFields() {
    const record = rec();
    if (!record) return;
    record.fields = record.fields || {};
    record.checks = record.checks || {};
    record.files = record.files || {};
  }

  function bmiData(record = rec()) {
    if (!record) return { value: null, classification: "Sin datos", risk: "Sin datos" };

    const weight = Number(record.fields?.weightKg);
    const heightCm = Number(record.fields?.heightCm);
    if (!weight || !heightCm) {
      return { value: null, classification: "Sin datos", risk: "Sin datos" };
    }

    const bmi = weight / ((heightCm / 100) ** 2);
    let classification = "";
    let risk = "";

    if (bmi < 18.5) {
      classification = "Bajo peso";
      risk = "Revisar condición nutricional";
    } else if (bmi < 25) {
      classification = "Rango saludable";
      risk = "Carga antropométrica habitual";
    } else if (bmi < 30) {
      classification = "Sobrepeso";
      risk = "Carga mecánica aumentada";
    } else if (bmi < 35) {
      classification = "Obesidad grado I";
      risk = "Riesgo mecánico elevado";
    } else if (bmi < 40) {
      classification = "Obesidad grado II";
      risk = "Riesgo mecánico alto";
    } else {
      classification = "Obesidad grado III";
      risk = "Riesgo mecánico muy alto";
    }

    return { value: bmi.toFixed(1), classification, risk };
  }

  function postureData(record = rec()) {
    const selected = POSTURE_FIELDS.filter(([key]) => Boolean(record?.checks?.[key]));
    const photos = ["postureFront", "postureBack", "postureRight", "postureLeft"]
      .filter((key) => Boolean(record?.files?.[key])).length;

    let level = "Sin evaluar";
    let css = "";
    if (selected.length === 0 && photos > 0) {
      level = "Fotos cargadas, revisión pendiente";
      css = "arc-risk-medium";
    } else if (selected.length <= 2 && selected.length > 0) {
      level = "Riesgo postural bajo";
      css = "arc-risk-low";
    } else if (selected.length <= 4) {
      level = "Riesgo postural moderado";
      css = "arc-risk-medium";
    } else if (selected.length > 4) {
      level = "Riesgo postural alto";
      css = "arc-risk-high";
    }

    return {
      selected,
      photos,
      level,
      css,
      score: Math.min(100, selected.length * 12 + photos * 4),
    };
  }

  function consentOk(record) {
    const keys = [
      "consentRemoteEvaluation",
      "consentHealthData",
      "consentPhotosVideos",
      "consentCommunication",
      "consentTerms",
    ];
    return keys.every((key) => Boolean(record?.checks?.[key]));
  }

  function progressData(record = rec()) {
    if (!record) return { percent: 0, done: 0, total: 10, missing: ["Crear paciente"] };

    const footCount = typeof footViews !== "undefined"
      ? footViews.filter(([key]) => Boolean(record.files?.[key])).length
      : 0;

    const posturePhotos = ["postureFront", "postureBack", "postureRight", "postureLeft"]
      .filter((key) => Boolean(record.files?.[key])).length;

    const hasMeasures = Boolean(
      record.fields?.leftLengthCm ||
      record.fields?.rightLengthCm ||
      record.fields?.leftMttWidthCm ||
      record.fields?.rightMttWidthCm
    );

    const items = [
      ["Datos del paciente", Boolean(record.fields?.fullName && record.fields?.phone && record.fields?.city)],
      ["Consentimiento", consentOk(record)],
      ["Evaluación clínica", Boolean(record.fields?.diagnosis || record.fields?.mainPainArea)],
      ["Peso y estatura", Boolean(record.fields?.weightKg && record.fields?.heightCm)],
      ["Receta médica", Boolean(record.files?.prescription)],
      ["Fotografías de pies", footCount >= 6],
      ["Fotografías posturales", posturePhotos >= 2],
      ["Video de marcha", Boolean(record.files?.gaitVideo)],
      ["Medidas", hasMeasures],
      ["Confirmación final", Boolean(record.checks?.finalConfirmation)],
    ];

    const done = items.filter(([, ok]) => ok).length;
    return {
      percent: Math.round(done / items.length * 100),
      done,
      total: items.length,
      missing: items.filter(([, ok]) => !ok).map(([label]) => label),
      footCount,
      posturePhotos,
    };
  }

  function injectProgress() {
    const revision = document.querySelector("#revision");
    if (!revision || document.querySelector("#arcProgressShell")) return;

    const shell = document.createElement("div");
    shell.id = "arcProgressShell";
    shell.className = "arc-progress-shell";
    shell.innerHTML = `
      <div class="arc-progress-head">
        <div>
          <p class="eyebrow">Preparación del caso</p>
          <h3>Progreso clínico y documental</h3>
        </div>
        <strong id="arcProgressPercent">0%</strong>
      </div>
      <div class="arc-progress-track">
        <div id="arcProgressBar" class="arc-progress-bar"></div>
      </div>
      <div class="arc-progress-meta">
        <span id="arcProgressSteps">0 de 10 requisitos</span>
        <span id="arcProgressNext">Siguiente: crear paciente</span>
      </div>
    `;

    revision.insertBefore(shell, revision.children[1] || null);
  }

  function injectRiskCards() {
    const revision = document.querySelector("#revision");
    if (!revision || document.querySelector("#arcModuleGrid")) return;

    const grid = document.createElement("div");
    grid.id = "arcModuleGrid";
    grid.className = "arc-module-grid";
    grid.innerHTML = `
      <article class="arc-risk-card">
        <div class="arc-risk-head"><h4>IMC</h4><span>Antropometría</span></div>
        <div id="arcBmiValue" class="arc-risk-value">—</div>
        <strong id="arcBmiClass">Sin datos</strong>
        <p id="arcBmiRisk" class="arc-risk-label">Ingresa peso y estatura.</p>
      </article>
      <article class="arc-risk-card">
        <div class="arc-risk-head"><h4>Postura</h4><span>Revisión clínica</span></div>
        <div id="arcPostureScore" class="arc-risk-value">0%</div>
        <strong id="arcPostureLevel">Sin evaluar</strong>
        <p id="arcPosturePhotos" class="arc-risk-label">0 de 4 fotografías.</p>
      </article>
      <article class="arc-risk-card">
        <div class="arc-risk-head"><h4>Expediente</h4><span>Completitud</span></div>
        <div id="arcFileScore" class="arc-risk-value">0%</div>
        <strong id="arcFileStatus">Incompleto</strong>
        <p id="arcFileMissing" class="arc-risk-label">Crea o selecciona un caso.</p>
      </article>
    `;

    const progress = document.querySelector("#arcProgressShell");
    progress?.insertAdjacentElement("afterend", grid);
  }

  function injectPostureAssessment() {
    const posture = document.querySelector("#postura");
    if (!posture || document.querySelector("#arcPosturePanel")) return;

    const panel = document.createElement("div");
    panel.id = "arcPosturePanel";
    panel.className = "arc-posture-panel";
    panel.innerHTML = `
      <div class="arc-posture-summary">
        <div>
          <p class="eyebrow">Análisis postural clínico asistido</p>
          <h4>Hallazgos observables</h4>
        </div>
        <strong id="arcPosturePanelResult">Sin evaluar</strong>
      </div>
      <p class="arc-posture-note">
        Marca únicamente hallazgos visibles. Esta sección apoya la revisión profesional y no reemplaza el diagnóstico clínico.
      </p>
      <div class="arc-posture-checks">
        ${POSTURE_FIELDS.map(([key, label]) => `
          <label>
            <input type="checkbox" name="${key}">
            <span>${esc(label)}</span>
          </label>
        `).join("")}
      </div>
      <label>
        Resumen postural del profesional
        <textarea name="posturalClinicalSummary" rows="5" placeholder="Ej.: asimetría de hombros, valgo bilateral y pronación derecha..."></textarea>
      </label>
    `;

    posture.appendChild(panel);

    panel.querySelectorAll("input[name], textarea[name]").forEach((input) => {
      const eventName = input.type === "checkbox" ? "change" : "input";
      input.addEventListener(eventName, () => {
        const record = rec();
        if (!record) return;

        if (input.type === "checkbox") record.checks[input.name] = input.checked;
        else record.fields[input.name] = input.value;

        if (typeof scheduleSave === "function") scheduleSave();
        refreshModules();
      });
    });
  }

  function injectReportButtons() {
    const revision = document.querySelector("#revision .history-panel");
    if (!revision || document.querySelector("#arcReportActions")) return;

    const actions = document.createElement("div");
    actions.id = "arcReportActions";
    actions.className = "arc-report-actions";
    actions.innerHTML = `
      <button id="arcGenerateReport" class="arc-report-btn" type="button">
        Generar informe PDF
      </button>
      <button id="arcCopySummary" class="arc-secondary-btn" type="button">
        Copiar resumen clínico
      </button>
    `;

    revision.appendChild(actions);

    document.querySelector("#arcGenerateReport")?.addEventListener("click", generateReport);
    document.querySelector("#arcCopySummary")?.addEventListener("click", copySummary);
  }

  function loadPostureInputs() {
    const record = rec();
    POSTURE_FIELDS.forEach(([key]) => {
      const input = document.querySelector(`[name="${key}"]`);
      if (input) input.checked = Boolean(record?.checks?.[key]);
    });

    const summary = document.querySelector('[name="posturalClinicalSummary"]');
    if (summary) summary.value = record?.fields?.posturalClinicalSummary || "";
  }

  function refreshModules() {
    const record = rec();
    const bmi = bmiData(record);
    const posture = postureData(record);
    const progress = progressData(record);

    const percent = document.querySelector("#arcProgressPercent");
    const bar = document.querySelector("#arcProgressBar");
    const steps = document.querySelector("#arcProgressSteps");
    const next = document.querySelector("#arcProgressNext");

    if (percent) percent.textContent = `${progress.percent}%`;
    if (bar) bar.style.width = `${progress.percent}%`;
    if (steps) steps.textContent = `${progress.done} de ${progress.total} requisitos`;
    if (next) next.textContent = progress.missing.length
      ? `Siguiente: ${progress.missing[0]}`
      : "Caso completo";

    const bmiValue = document.querySelector("#arcBmiValue");
    const bmiClass = document.querySelector("#arcBmiClass");
    const bmiRisk = document.querySelector("#arcBmiRisk");
    if (bmiValue) bmiValue.textContent = bmi.value || "—";
    if (bmiClass) bmiClass.textContent = bmi.classification;
    if (bmiRisk) bmiRisk.textContent = bmi.risk;

    const postureScore = document.querySelector("#arcPostureScore");
    const postureLevel = document.querySelector("#arcPostureLevel");
    const posturePhotos = document.querySelector("#arcPosturePhotos");
    const posturePanelResult = document.querySelector("#arcPosturePanelResult");

    if (postureScore) postureScore.textContent = `${posture.score}%`;
    if (postureLevel) {
      postureLevel.textContent = posture.level;
      postureLevel.className = posture.css;
    }
    if (posturePhotos) posturePhotos.textContent = `${posture.photos} de 4 fotografías posturales.`;
    if (posturePanelResult) {
      posturePanelResult.textContent = posture.level;
      posturePanelResult.className = posture.css;
    }

    const fileScore = document.querySelector("#arcFileScore");
    const fileStatus = document.querySelector("#arcFileStatus");
    const fileMissing = document.querySelector("#arcFileMissing");
    if (fileScore) fileScore.textContent = `${progress.percent}%`;
    if (fileStatus) fileStatus.textContent = progress.percent === 100 ? "Completo" : "Incompleto";
    if (fileMissing) fileMissing.textContent = progress.missing.length
      ? `Falta: ${progress.missing.slice(0, 3).join(", ")}`
      : "Listo para revisión profesional.";

    loadPostureInputs();
  }

  function filePhotoUrls(record) {
    const keys = [
      "prescription",
      "leftDorsal",
      "leftPlantar",
      "rightDorsal",
      "rightPlantar",
      "postureFront",
      "postureBack",
      "postureRight",
      "postureLeft",
    ];

    return keys
      .filter((key) => record?.files?.[key]?.blob && record.files[key].type?.startsWith("image/"))
      .map((key) => ({
        key,
        name: record.files[key].name,
        url: URL.createObjectURL(record.files[key].blob),
      }));
  }

  function reportHtml(record, photoUrls) {
    const bmi = bmiData(record);
    const posture = postureData(record);
    const progress = progressData(record);
    const selectedPosture = posture.selected.map(([, label]) => label);
    const date = new Date().toLocaleDateString("es-CL");

    const photos = photoUrls.length
      ? photoUrls.map((photo) => `
          <figure>
            <img src="${photo.url}" alt="${esc(photo.name)}">
            <figcaption>${esc(photo.name)}</figcaption>
          </figure>
        `).join("")
      : "<p>No se incorporaron imágenes al informe.</p>";

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(record.code)} - Informe ASTOR</title>
<style>
  body{font-family:Arial,sans-serif;color:#17384c;margin:34px;line-height:1.45}
  header{display:flex;justify-content:space-between;border-bottom:3px solid #00a6a6;padding-bottom:16px}
  h1,h2,h3{color:#11384f} .code{font-weight:800;color:#007a9c}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:20px 0}
  .card{border:1px solid #cbd9e2;border-radius:12px;padding:14px}
  .card strong{display:block;font-size:21px;margin-top:5px}
  table{width:100%;border-collapse:collapse;margin:15px 0}
  td{border-bottom:1px solid #dbe5eb;padding:8px}
  td:first-child{color:#607b8e;width:38%}
  .photos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  figure{margin:0;border:1px solid #d6e2e8;padding:8px;border-radius:10px}
  img{width:100%;max-height:300px;object-fit:contain}
  figcaption{font-size:12px;margin-top:5px}
  footer{margin-top:28px;border-top:1px solid #cbd9e2;padding-top:12px;font-size:12px;color:#607b8e}
  @media print{body{margin:16mm}.no-print{display:none}}
</style>
</head>
<body>
<header>
  <div>
    <h1>ASTOR Remote Clinic</h1>
    <p>Informe clínico remoto y orden preliminar</p>
  </div>
  <div>
    <div class="code">${esc(record.code)}</div>
    <div>${date}</div>
  </div>
</header>

<div class="grid">
  <div class="card">Paciente<strong>${esc(record.fields?.fullName || "Sin nombre")}</strong></div>
  <div class="card">Completitud del caso<strong>${progress.percent}%</strong></div>
  <div class="card">IMC<strong>${bmi.value || "—"} · ${esc(bmi.classification)}</strong></div>
  <div class="card">Evaluación postural<strong>${esc(posture.level)}</strong></div>
</div>

<h2>Datos del paciente</h2>
<table>
  <tr><td>Documento</td><td>${esc(record.fields?.documentId || "—")}</td></tr>
  <tr><td>Teléfono</td><td>${esc(record.fields?.phone || "—")}</td></tr>
  <tr><td>Correo</td><td>${esc(record.fields?.email || "—")}</td></tr>
  <tr><td>Ciudad</td><td>${esc(record.fields?.city || "—")}</td></tr>
  <tr><td>Peso / estatura</td><td>${esc(record.fields?.weightKg || "—")} kg / ${esc(record.fields?.heightCm || "—")} cm</td></tr>
  <tr><td>Ocupación</td><td>${esc(record.fields?.occupation || "—")}</td></tr>
</table>

<h2>Resumen clínico</h2>
<table>
  <tr><td>Diagnóstico / motivo</td><td>${esc(record.fields?.diagnosis || record.fields?.mainPainArea || "—")}</td></tr>
  <tr><td>Dolor</td><td>${esc(record.fields?.painScale || "—")} / 10</td></tr>
  <tr><td>Objetivo funcional</td><td>${esc(record.fields?.functionalGoal || record.fields?.treatmentGoal || "—")}</td></tr>
  <tr><td>Indicación médica</td><td>${esc(record.fields?.medicalIndication || "—")}</td></tr>
  <tr><td>Observaciones</td><td>${esc(record.fields?.evaluationNotes || "—")}</td></tr>
</table>

<h2>Análisis postural clínico asistido</h2>
<p><strong>Hallazgos:</strong> ${selectedPosture.length ? esc(selectedPosture.join(", ")) : "Sin hallazgos marcados."}</p>
<p><strong>Resumen profesional:</strong> ${esc(record.fields?.posturalClinicalSummary || record.fields?.posturalNotes || "Pendiente de revisión.")}</p>

<h2>Medidas y fabricación</h2>
<table>
  <tr><td>Largo pie izquierdo</td><td>${esc(record.fields?.leftLengthCm || "—")} cm</td></tr>
  <tr><td>Largo pie derecho</td><td>${esc(record.fields?.rightLengthCm || "—")} cm</td></tr>
  <tr><td>Ancho MTT izquierdo</td><td>${esc(record.fields?.leftMttWidthCm || "—")} cm</td></tr>
  <tr><td>Ancho MTT derecho</td><td>${esc(record.fields?.rightMttWidthCm || "—")} cm</td></tr>
  <tr><td>Tipo de órtesis</td><td>${esc(record.fields?.insoleType || "Por definir")}</td></tr>
  <tr><td>Material base</td><td>${esc(record.fields?.baseMaterial || "Por definir")}</td></tr>
  <tr><td>Correcciones</td><td>${esc(record.fields?.corrections || "Por definir")}</td></tr>
</table>

<h2>Evidencia visual</h2>
<div class="photos">${photos}</div>

<h2>Estado operativo</h2>
<table>
  <tr><td>Pago</td><td>${esc(record.fields?.paymentStatus || "Pendiente")}</td></tr>
  <tr><td>Orden</td><td>${esc(record.fields?.orderStatus || "Ingreso")}</td></tr>
  <tr><td>Despacho</td><td>${esc(record.fields?.carrier || "Por definir")} · ${esc(record.fields?.trackingCode || "Sin seguimiento")}</td></tr>
</table>

<footer>
  Documento generado por ASTOR Remote Clinic. La revisión definitiva y autorización de fabricación corresponden al profesional responsable.
</footer>

<script>
  window.addEventListener("load", () => setTimeout(() => window.print(), 500));
</script>
</body>
</html>`;
  }

  function generateReport() {
    const record = rec();
    if (!record) {
      alert("Primero crea o selecciona un caso.");
      return;
    }

    const photoUrls = filePhotoUrls(record);
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      photoUrls.forEach((photo) => URL.revokeObjectURL(photo.url));
      alert("El navegador bloqueó la ventana del informe. Permite ventanas emergentes.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(reportHtml(record, photoUrls));
    reportWindow.document.close();

    setTimeout(() => {
      photoUrls.forEach((photo) => URL.revokeObjectURL(photo.url));
    }, 60000);
  }

  function summaryText(record = rec()) {
    if (!record) return "";
    const bmi = bmiData(record);
    const posture = postureData(record);
    const progress = progressData(record);

    return [
      `ASTOR REMOTE CLINIC`,
      `Caso: ${record.code}`,
      `Paciente: ${record.fields?.fullName || "Sin nombre"}`,
      `Ciudad: ${record.fields?.city || "Sin ciudad"}`,
      `Completitud: ${progress.percent}%`,
      `IMC: ${bmi.value || "—"} (${bmi.classification})`,
      `Postura: ${posture.level}`,
      `Receta: ${record.files?.prescription ? "Cargada" : "Pendiente"}`,
      `Fotos de pies: ${progress.footCount}/10`,
      `Fotos posturales: ${progress.posturePhotos}/4`,
      `Video: ${record.files?.gaitVideo ? "Cargado" : "Pendiente"}`,
      `Pago: ${record.fields?.paymentStatus || "Pendiente"}`,
      `Estado: ${record.fields?.orderStatus || "Ingreso"}`,
      progress.missing.length ? `Faltantes: ${progress.missing.join(", ")}` : "Caso completo.",
    ].join("\n");
  }

  async function copySummary() {
    const text = summaryText();
    if (!text) {
      alert("Primero crea o selecciona un caso.");
      return;
    }

    if (typeof copyTextToClipboard === "function") {
      await copyTextToClipboard(text);
    } else {
      await navigator.clipboard.writeText(text);
    }
    alert("Resumen clínico copiado.");
  }

  function observePatientChanges() {
    const title = document.querySelector("#activePatientTitle");
    if (!title || typeof MutationObserver === "undefined") return;

    new MutationObserver(() => {
      setTimeout(refreshModules, 60);
    }).observe(title, { childList: true, characterData: true, subtree: true });
  }

  function bindGlobalRefresh() {
    document.querySelectorAll("input[name], select[name], textarea[name]").forEach((input) => {
      const eventName = input.type === "checkbox" || input.tagName === "SELECT"
        ? "change"
        : "input";
      input.addEventListener(eventName, () => setTimeout(refreshModules, 30));
    });
  }

  function initFourModules() {
    injectProgress();
    injectRiskCards();
    injectPostureAssessment();
    injectReportButtons();
    bindGlobalRefresh();
    observePatientChanges();
    setTimeout(refreshModules, 350);
  }

  initFourModules();
})();
