const DB_NAME = 'plantillas-ortopedicas-distancia';
const DB_VERSION = 1;
const STORE = 'records';

const footViews = [
  ['leftDorsal', 'Pie izquierdo', 'Vista dorsal'],
  ['leftPlantar', 'Pie izquierdo', 'Vista plantar'],
  ['leftMedial', 'Pie izquierdo', 'Vista medial'],
  ['leftLateral', 'Pie izquierdo', 'Vista lateral'],
  ['leftPosterior', 'Pie izquierdo', 'Vista posterior'],
  ['rightDorsal', 'Pie derecho', 'Vista dorsal'],
  ['rightPlantar', 'Pie derecho', 'Vista plantar'],
  ['rightMedial', 'Pie derecho', 'Vista medial'],
  ['rightLateral', 'Pie derecho', 'Vista lateral'],
  ['rightPosterior', 'Pie derecho', 'Vista posterior']
];

const state = {
  db: null,
  records: [],
  activeId: null,
  savingTimer: null,
  orderFilter: 'todos'
};

const photoMeasure = {
  image: null,
  mode: 'calibration',
  points: {
    calibration: [],
    length: [],
    width: []
  },
  scaleCmPerPx: null
};

const soleCamera = {
  stream: null,
  autoCapture: false,
  detectTimer: null,
  stableFrames: 0
};

const els = {
  form: document.querySelector('#recordForm'),
  table: document.querySelector('#patientsTable'),
  search: document.querySelector('#searchInput'),
  activeTitle: document.querySelector('#activePatientTitle'),
  recordCode: document.querySelector('#recordCode'),
  saveState: document.querySelector('#saveState'),
  footGrid: document.querySelector('#footPhotoGrid'),
  footTemplate: document.querySelector('#footPhotoTemplate'),
  prescriptionInput: document.querySelector('#prescriptionInput'),
  prescriptionPreview: document.querySelector('#prescriptionPreview'),
  gaitVideoInput: document.querySelector('#gaitVideoInput'),
  gaitVideoPreview: document.querySelector('#gaitVideoPreview'),
  paymentProofInput: document.querySelector('#paymentProofInput'),
  paymentProofPreview: document.querySelector('#paymentProofPreview'),
  photoMeasureInput: document.querySelector('#photoMeasureInput'),
  photoMeasureCanvas: document.querySelector('#photoMeasureCanvas'),
  photoMeasureEmpty: document.querySelector('#photoMeasureEmpty'),
  calibrationPreset: document.querySelector('#calibrationPreset'),
  calibrationCm: document.querySelector('#calibrationCm'),
  setCalibrationMode: document.querySelector('#setCalibrationMode'),
  setLengthMode: document.querySelector('#setLengthMode'),
  setWidthMode: document.querySelector('#setWidthMode'),
  undoPhotoPoint: document.querySelector('#undoPhotoPoint'),
  clearPhotoMeasure: document.querySelector('#clearPhotoMeasure'),
  calibrationStatus: document.querySelector('#calibrationStatus'),
  photoLengthResult: document.querySelector('#photoLengthResult'),
  photoWidthResult: document.querySelector('#photoWidthResult'),
  photoTargetFoot: document.querySelector('#photoTargetFoot'),
  photoWidthField: document.querySelector('#photoWidthField'),
  applyPhotoMeasures: document.querySelector('#applyPhotoMeasures'),
  summaryMeasure: document.querySelector('#summaryMeasure'),
  remoteReadiness: document.querySelector('#remoteReadiness'),
  soleCameraVideo: document.querySelector('#soleCameraVideo'),
  openSoleCamera: document.querySelector('#openSoleCamera'),
  autoSoleCapture: document.querySelector('#autoSoleCapture'),
  captureSolePhoto: document.querySelector('#captureSolePhoto'),
  closeSoleCamera: document.querySelector('#closeSoleCamera'),
  soleCameraStatus: document.querySelector('#soleCameraStatus')
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(mode = 'readonly') {
  return state.db.transaction(STORE, mode).objectStore(STORE);
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    const request = tx().getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveRecord(record) {
  return new Promise((resolve, reject) => {
    const request = tx('readwrite').put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

function createRecord() {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    code: `PO-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    fields: {
      paymentStatus: 'Pendiente',
      orderStatus: 'Ingreso'
    },
    checks: {},
    files: {}
  };
}

function activeRecord() {
  return state.records.find(record => record.id === state.activeId) || null;
}

function setSaveState(text) {
  els.saveState.textContent = text;
}

async function persistActive() {
  const record = activeRecord();
  if (!record) return;
  record.updatedAt = new Date().toISOString();
  setSaveState('Guardando');
  await saveRecord(record);
  state.records = await getAllRecords();
  setSaveState('Guardado local');
  renderAll();
}

function scheduleSave() {
  clearTimeout(state.savingTimer);
  state.savingTimer = setTimeout(persistActive, 350);
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
      button.classList.add('active');
      document.getElementById(button.dataset.section).classList.add('active-view');
    });
  });
}

function renderPatients() {
  const query = els.search.value.trim().toLowerCase();
  const rows = state.records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(record => {
      const text = [
        record.code,
        record.fields.fullName,
        record.fields.documentId,
        record.fields.phone,
        record.fields.city
      ].join(' ').toLowerCase();
      return text.includes(query);
    });

  els.table.innerHTML = rows.map(record => {
    const selected = record.id === state.activeId ? ' class="selected"' : '';
    const date = new Date(record.createdAt).toLocaleDateString('es-CL');
    const shipping = record.fields.carrier || 'Sin definir';
    return `
      <tr data-id="${record.id}"${selected}>
        <td>${escapeHtml(record.code)}</td>
        <td>${escapeHtml(record.fields.fullName || 'Sin nombre')}</td>
        <td>${escapeHtml(record.fields.city || 'Sin ciudad')}</td>
        <td>${statusBadge(record.fields.orderStatus || 'Ingreso')}</td>
        <td>${escapeHtml(shipping)}</td>
        <td>${date}</td>
      </tr>
    `;
  }).join('');

  els.table.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      state.activeId = row.dataset.id;
      loadActiveIntoUi();
      renderAll();
    });
  });
}

function statusBadge(status) {
  const ok = ['Despachada', 'Entregada', 'Validado'].includes(status);
  const warn = ['Pendiente', 'Ingreso', 'En revision'].includes(status);
  const cls = ok ? ' ok' : warn ? ' warn' : '';
  return `<span class="badge${cls}">${escapeHtml(status)}</span>`;
}

function bindForm() {
  document.querySelectorAll('input[name], select[name], textarea[name]').forEach(input => {
    const eventName = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const record = activeRecord();
      if (!record) return;
      if (input.type === 'checkbox') record.checks[input.name] = input.checked;
      else record.fields[input.name] = input.value;
      updateHeader(record);
      renderSummary();
      scheduleSave();
    });
  });
}

function loadActiveIntoUi() {
  const record = activeRecord();
  document.querySelectorAll('input[name], select[name], textarea[name]').forEach(input => {
    if (!record) {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
      return;
    }
    if (input.type === 'checkbox') input.checked = Boolean(record.checks[input.name]);
    else input.value = record.fields[input.name] || '';
  });

  updateHeader(record);
  renderMediaPreviews();
  renderSummary();
}

function updateHeader(record) {
  els.activeTitle.textContent = record?.fields.fullName || 'Sin paciente seleccionado';
  els.recordCode.textContent = `Codigo: ${record?.code || 'nuevo'}`;
}

function renderSummary() {
  const record = activeRecord();
  if (!record) return;
  const photoCount = footViews.filter(([key]) => record.files[key]).length;
  const hasMeasure = Boolean(
    record.fields.leftLengthCm ||
    record.fields.rightLengthCm ||
    record.fields.leftMttWidthCm ||
    record.fields.rightMttWidthCm
  );
  const qualityChecks = [
    'qcPhotosSharp',
    'qcFullFoot',
    'qcReferenceVisible',
    'qcCameraParallel',
    'qcBothFeet',
    'qcGaitReady'
  ];
  const completedQuality = qualityChecks.filter(key => record.checks[key]).length;
  document.querySelector('#summaryPrescription').textContent = record.files.prescription ? 'Cargada' : 'Pendiente';
  document.querySelector('#summaryPhotos').textContent = `${photoCount} / ${footViews.length}`;
  if (els.summaryMeasure) els.summaryMeasure.textContent = hasMeasure ? 'Con datos' : 'Pendiente';
  document.querySelector('#summaryVideo').textContent = record.files.gaitVideo ? 'Cargado' : 'Pendiente';
  document.querySelector('#summaryPayment').textContent = record.fields.paymentStatus || 'Pendiente';
  document.querySelector('#summaryShipping').textContent = record.fields.trackingCode || record.fields.carrier || 'Pendiente';
  if (els.remoteReadiness) {
    const ready = photoCount >= 6 && hasMeasure && completedQuality >= 4;
    els.remoteReadiness.textContent = ready ? 'Listo para revision' : `${completedQuality} / ${qualityChecks.length} controles`;
    els.remoteReadiness.classList.toggle('ok', ready);
    els.remoteReadiness.classList.toggle('warn', !ready);
  }
  renderProDashboard();
  renderCaseHistory();
}

function buildFootCards() {
  els.footGrid.innerHTML = '';
  footViews.forEach(([key, foot, view]) => {
    const fragment = els.footTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.upload-card');
    const input = fragment.querySelector('input');
    card.dataset.fileKey = key;
    fragment.querySelector('h4').textContent = foot;
    fragment.querySelector('span').textContent = view;
    input.addEventListener('change', event => handleFile(key, event.target.files[0]));
    els.footGrid.append(fragment);
  });
}

async function handleFile(key, file) {
  const record = activeRecord();
  if (!record || !file) return;
  record.files[key] = {
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file
  };
  await persistActive();
  renderMediaPreviews();
}

function renderMediaPreviews() {
  const record = activeRecord();
  renderPreview(els.prescriptionPreview, record?.files.prescription);
  renderPreview(els.paymentProofPreview, record?.files.paymentProof);
  renderVideo(els.gaitVideoPreview, record?.files.gaitVideo);
  document.querySelectorAll('.upload-card[data-file-key]').forEach(card => {
    const key = card.dataset.fileKey;
    renderPreview(card.querySelector('.preview-zone'), record?.files[key]);
  });
}

function renderPreview(container, fileRecord) {
  cleanupObjectUrl(container);
  if (!fileRecord) {
    container.textContent = 'Sin archivo';
    return;
  }
  if (fileRecord.type?.startsWith('image/')) {
    const url = URL.createObjectURL(fileRecord.blob);
    container.dataset.url = url;
    container.innerHTML = `<img alt="${escapeHtml(fileRecord.name)}" src="${url}">`;
    return;
  }
  container.innerHTML = `<div class="file-pill">${escapeHtml(fileRecord.name)}</div>`;
}

function renderVideo(container, fileRecord) {
  cleanupObjectUrl(container);
  if (!fileRecord) {
    container.textContent = 'Sin video';
    return;
  }
  const url = URL.createObjectURL(fileRecord.blob);
  container.dataset.url = url;
  container.innerHTML = `<video controls playsinline src="${url}"></video>`;
}

function cleanupObjectUrl(container) {
  if (container.dataset.url) {
    URL.revokeObjectURL(container.dataset.url);
    delete container.dataset.url;
  }
}

function bindFiles() {
  els.prescriptionInput.addEventListener('change', event => handleFile('prescription', event.target.files[0]));
  els.gaitVideoInput.addEventListener('change', event => handleFile('gaitVideo', event.target.files[0]));
  els.paymentProofInput.addEventListener('change', event => handleFile('paymentProof', event.target.files[0]));
}

function renderAll() {
  renderPatients();
  renderSummary();
  renderOrdersBoard();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function exportActiveRecord() {
  const record = activeRecord();
  if (!record) return;
  const clean = {
    ...record,
    files: Object.fromEntries(Object.entries(record.files).map(([key, file]) => [key, {
      name: file.name,
      type: file.type,
      size: file.size,
      updatedAt: file.updatedAt
    }]))
  };
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${record.code}-ficha-plantillas.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function getCaseReadiness(record = activeRecord()) {
  if (!record) return { percent: 0, missing: ['Seleccione o cree un paciente.'], ready: false };
  const photoCount = footViews.filter(([key]) => record.files[key]).length;
  const hasMeasure = Boolean(
    record.fields.leftLengthCm ||
    record.fields.rightLengthCm ||
    record.fields.leftMttWidthCm ||
    record.fields.rightMttWidthCm
  );
  const qualityKeys = [
    'qcPhotosSharp',
    'qcFullFoot',
    'qcReferenceVisible',
    'qcCameraParallel',
    'qcBothFeet',
    'qcGaitReady'
  ];
  const qualityCount = qualityKeys.filter(key => record.checks[key]).length;
  const items = [
    ['Nombre del paciente', Boolean(record.fields.fullName)],
    ['Telefono de contacto', Boolean(record.fields.phone)],
    ['Ciudad de envio', Boolean(record.fields.city)],
    ['Diagnostico o motivo clinico', Boolean(record.fields.diagnosis)],
    ['Receta medica cargada', Boolean(record.files.prescription)],
    ['Al menos 6 fotos del pie', photoCount >= 6],
    ['Medicion de largo/ancho', hasMeasure],
    ['Video de marcha', Boolean(record.files.gaitVideo)],
    ['4 controles de calidad o mas', qualityCount >= 4],
    ['Tipo de plantilla definido', Boolean(record.fields.insoleType)]
  ];
  const done = items.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / items.length) * 100),
    missing: items.filter(([, ok]) => !ok).map(([label]) => label),
    ready: done === items.length,
    photoCount,
    qualityCount
  };
}

function getOrderStage(record) {
  const readiness = getCaseReadiness(record);
  const status = record.fields.orderStatus || 'Ingreso';
  const payment = record.fields.paymentStatus || 'Pendiente';
  if (['Despachada', 'Entregada'].includes(status)) return 'despacho';
  if (['En fabricacion', 'Lista para despacho'].includes(status)) return 'fabricacion';
  if (payment !== 'Validado') return 'pago';
  if (!readiness.ready) return 'faltantes';
  return 'revision';
}

function getNextAction(record) {
  const readiness = getCaseReadiness(record);
  const payment = record.fields.paymentStatus || 'Pendiente';
  const status = record.fields.orderStatus || 'Ingreso';
  if (!record.fields.fullName || !record.fields.phone) return 'Completar datos de contacto';
  if (readiness.missing.length) return `Pedir: ${readiness.missing.slice(0, 2).join(', ')}`;
  if (payment !== 'Validado') return 'Validar pago o pedir comprobante';
  if (status === 'Ingreso' || status === 'En revision') return 'Aprobar orden tecnica';
  if (status === 'En fabricacion') return 'Revisar fabricacion';
  if (status === 'Lista para despacho') return 'Coordinar despacho';
  if (status === 'Despachada') return 'Confirmar entrega';
  return 'Control post entrega';
}

function renderOrdersBoard() {
  const board = document.querySelector('#ordersBoard');
  if (!board) return;

  const rows = state.records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(record => state.orderFilter === 'todos' || getOrderStage(record) === state.orderFilter);

  const opsNew = document.querySelector('#opsNew');
  const opsMissing = document.querySelector('#opsMissing');
  const opsPaid = document.querySelector('#opsPaid');
  const opsShip = document.querySelector('#opsShip');
  if (opsNew) opsNew.textContent = state.records.filter(record => (record.fields.orderStatus || 'Ingreso') === 'Ingreso').length;
  if (opsMissing) opsMissing.textContent = state.records.filter(record => !getCaseReadiness(record).ready).length;
  if (opsPaid) opsPaid.textContent = state.records.filter(record => record.fields.paymentStatus === 'Validado').length;
  if (opsShip) opsShip.textContent = state.records.filter(record => record.fields.orderStatus === 'Lista para despacho').length;

  if (!rows.length) {
    board.innerHTML = '<p class="empty-board">No hay pedidos para este filtro.</p>';
    return;
  }

  board.innerHTML = rows.map(record => {
    const readiness = getCaseReadiness(record);
    const stage = getOrderStage(record);
    const date = new Date(record.createdAt).toLocaleDateString('es-CL');
    const payment = record.fields.paymentStatus || 'Pendiente';
    const status = record.fields.orderStatus || 'Ingreso';
    const patient = record.fields.fullName || 'Sin nombre';
    const city = record.fields.city || 'Sin ciudad';
    return `
      <article class="order-card ${stage}" data-order-id="${record.id}">
        <div class="order-card-head">
          <div>
            <strong>${escapeHtml(record.code)}</strong>
            <h4>${escapeHtml(patient)}</h4>
            <p>${escapeHtml(city)} - ${date}</p>
          </div>
          <span class="order-score">${readiness.percent}%</span>
        </div>
        <div class="order-badges">
          <span>${escapeHtml(status)}</span>
          <span>${escapeHtml(payment)}</span>
          <span>${escapeHtml(stage)}</span>
        </div>
        <p class="next-action">${escapeHtml(getNextAction(record))}</p>
        <div class="order-progress"><span style="width:${readiness.percent}%"></span></div>
        <button class="ghost-btn open-order-btn" type="button" data-open-order="${record.id}">Abrir caso</button>
      </article>
    `;
  }).join('');

  board.querySelectorAll('[data-open-order]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeId = button.dataset.openOrder;
      loadActiveIntoUi();
      renderAll();
      document.querySelector('.nav-item[data-section="ficha"]')?.click();
    });
  });
}

function addHistoryEvent(title, detail = '') {
  const record = activeRecord();
  if (!record) return;
  record.history = record.history || [];
  record.history.unshift({
    title,
    detail,
    at: new Date().toISOString()
  });
  record.history = record.history.slice(0, 20);
  renderCaseHistory();
  scheduleSave();
}

function renderCaseHistory() {
  const container = document.querySelector('#caseHistory');
  if (!container) return;
  const record = activeRecord();
  const history = record?.history || [];
  if (!history.length) {
    container.innerHTML = '<p>No hay eventos registrados todavia.</p>';
    return;
  }
  container.innerHTML = history.map(item => {
    const date = new Date(item.at).toLocaleString('es-CL');
    return `
      <article>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(date)}</span>
        ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function renderProDashboard() {
  const quality = getCaseReadiness();
  const score = document.querySelector('#proQualityScore');
  const scan = document.querySelector('.pro-scan');
  if (score) score.textContent = `${quality.percent}%`;
  if (scan) {
    scan.style.background = `conic-gradient(var(--tech-mint) ${quality.percent * 3.6}deg, rgba(255,255,255,.12) 0deg), rgba(255,255,255,.08)`;
  }
  const kpiPatients = document.querySelector('#kpiPatients');
  const kpiReady = document.querySelector('#kpiReady');
  const kpiProduction = document.querySelector('#kpiProduction');
  if (kpiPatients) kpiPatients.textContent = state.records.length;
  if (kpiReady) {
    kpiReady.textContent = state.records.filter(record => getCaseReadiness(record).percent >= 80).length;
  }
  if (kpiProduction) {
    kpiProduction.textContent = state.records.filter(record => ['En fabricacion', 'Lista para despacho', 'Despachada'].includes(record.fields.orderStatus)).length;
  }
}

function validateActiveRecord() {
  const result = getCaseReadiness();
  const message = result.ready
    ? 'Ficha lista para revision y fabricacion.'
    : `Faltantes para dejar la ficha lista:\n- ${result.missing.join('\n- ')}`;
  alert(message);
  addHistoryEvent(result.ready ? 'Ficha validada' : 'Validacion con faltantes', result.ready ? 'Caso listo para revision tecnica.' : result.missing.join(', '));
}

function buildPatientRequestMessage(record = activeRecord()) {
  if (!record) return '';
  const result = getCaseReadiness(record);
  const name = record.fields.fullName || 'paciente';
  const missing = result.missing.length ? result.missing.join(', ') : 'no hay faltantes';
  return [
    `Hola ${name}, somos Astor Biomecanica.`,
    'Estamos revisando tu solicitud de plantillas ortopedicas a distancia.',
    `Para completar la evaluacion necesitamos: ${missing}.`,
    'Idealmente enviar fotos con buena luz, pie completo visible, regla o tarjeta de referencia, ambos pies y video caminando si hay dolor al caminar.',
    'Gracias.'
  ].join('\n');
}

function buildPaymentMessage(record = activeRecord()) {
  if (!record) return '';
  const name = record.fields.fullName || 'paciente';
  const amount = record.fields.paymentAmount ? `$${Number(record.fields.paymentAmount).toLocaleString('es-CL')}` : 'monto pendiente de confirmar';
  const method = record.fields.paymentMethod || 'Transferencia';
  return [
    `Hola ${name}, somos Astor Biomecanica.`,
    `Tu solicitud de plantillas ortopedicas a distancia esta registrada con el codigo ${record.code}.`,
    `Medio de pago: ${method}.`,
    `Monto: ${amount}.`,
    'Cuando realices el pago, envia el comprobante para validar la orden y pasar a fabricacion.',
    'Gracias.'
  ].join('\n');
}

async function copyTextToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

async function copyWhatsAppMessage() {
  const text = buildPatientRequestMessage();
  await copyTextToClipboard(text);
  addHistoryEvent('Mensaje copiado', 'Solicitud de antecedentes/fotos enviada a portapapeles.');
  alert('Mensaje copiado para WhatsApp o correo.');
}

async function copyPaymentMessage() {
  const text = buildPaymentMessage();
  await copyTextToClipboard(text);
  addHistoryEvent('Mensaje de pago copiado', 'Solicitud de pago enviada a portapapeles.');
  alert('Mensaje de pago copiado.');
}

function exportDatabase() {
  const clean = state.records.map(record => ({
    ...record,
    files: Object.fromEntries(Object.entries(record.files || {}).map(([key, file]) => [key, {
      name: file.name,
      type: file.type,
      size: file.size,
      updatedAt: file.updatedAt
    }]))
  }));
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `base-plantillas-astor-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function printManufacturingOrder() {
  const record = activeRecord();
  if (!record) { window.print(); return; }

  const esc = escapeHtml;
  const date = new Date().toLocaleDateString('es-CL');
  const f = record.fields || {};

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Orden ${esc(record.code)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#17384c;margin:28px 34px;line-height:1.5;font-size:14px}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #00a6a6;padding-bottom:14px;margin-bottom:20px}
  h1{font-size:20px;margin:0 0 2px;color:#11384f}
  h2{font-size:15px;color:#11384f;border-bottom:1px solid #cbd9e2;padding-bottom:6px;margin:20px 0 10px}
  .code{font-size:22px;font-weight:800;color:#007a9c;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  td{padding:7px 8px;border-bottom:1px solid #dbe5eb;vertical-align:top}
  td:first-child{color:#607b8e;width:38%;font-weight:600}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#e7f7f1;color:#146b50}
  .note{background:#f5f9fb;border-left:3px solid #00a6a6;padding:10px 14px;border-radius:0 8px 8px 0;font-size:13px;color:#2a4d60}
  footer{margin-top:28px;border-top:1px solid #cbd9e2;padding-top:10px;font-size:11px;color:#8099a6;display:flex;justify-content:space-between}
  @media print{body{margin:12mm 14mm}.no-print{display:none}}
</style>
</head>
<body>
<header>
  <div>
    <h1>Orden de Fabricación</h1>
    <p style="margin:0;font-size:13px;color:#607b8e">ASTOR Remote Clinic · Plantillas Ortopédicas</p>
  </div>
  <div style="text-align:right">
    <div class="code">${esc(record.code)}</div>
    <div style="font-size:12px;color:#607b8e;margin-top:4px">${date}</div>
  </div>
</header>

<h2>Datos del paciente</h2>
<table>
  <tr><td>Nombre</td><td>${esc(f.fullName || '—')}</td></tr>
  <tr><td>Teléfono / WhatsApp</td><td>${esc(f.phone || '—')}</td></tr>
  <tr><td>Ciudad / despacho</td><td>${esc(f.city || '—')}</td></tr>
  <tr><td>Diagnóstico</td><td>${esc(f.diagnosis || f.mainPainArea || '—')}</td></tr>
</table>

<h2>Medidas</h2>
<table>
  <tr><td>Largo pie izquierdo</td><td>${esc(f.leftLengthCm || '—')} cm</td></tr>
  <tr><td>Largo pie derecho</td><td>${esc(f.rightLengthCm || '—')} cm</td></tr>
  <tr><td>Ancho MTT izquierdo</td><td>${esc(f.leftMttWidthCm || '—')} cm</td></tr>
  <tr><td>Ancho MTT derecho</td><td>${esc(f.rightMttWidthCm || '—')} cm</td></tr>
  <tr><td>Ancho talón izquierdo</td><td>${esc(f.leftHeelWidthCm || '—')} cm</td></tr>
  <tr><td>Ancho talón derecho</td><td>${esc(f.rightHeelWidthCm || '—')} cm</td></tr>
  <tr><td>Talla calzado izquierdo</td><td>${esc(f.leftShoeSize || '—')}</td></tr>
  <tr><td>Talla calzado derecho</td><td>${esc(f.rightShoeSize || '—')}</td></tr>
</table>

<h2>Especificaciones de fabricación</h2>
<table>
  <tr><td>Tipo de órtesis / plantilla</td><td>${esc(f.insoleType || 'Por definir')}</td></tr>
  <tr><td>Material base</td><td>${esc(f.baseMaterial || 'Por definir')}</td></tr>
  <tr><td>Cobertura superior</td><td>${esc(f.topCover || 'Por definir')}</td></tr>
  <tr><td>Correcciones / modificaciones</td><td>${esc(f.corrections || f.technicalNotes || 'Ver notas')}</td></tr>
  <tr><td>Indicacióm médica</td><td>${esc(f.medicalIndication || '—')}</td></tr>
</table>

<h2>Estado y despacho</h2>
<table>
  <tr><td>Estado de la orden</td><td><span class="badge">${esc(f.orderStatus || 'Ingreso')}</span></td></tr>
  <tr><td>Pago</td><td>${esc(f.paymentStatus || 'Pendiente')}</td></tr>
  <tr><td>Fecha de fabricación</td><td>${esc(f.manufacturingDate || '—')}</td></tr>
  <tr><td>Fecha de despacho</td><td>${esc(f.shippingDate || '—')}</td></tr>
  <tr><td>Transportista</td><td>${esc(f.carrier || '—')}</td></tr>
  <tr><td>Código de seguimiento</td><td>${esc(f.trackingCode || f.trackingUrl || '—')}</td></tr>
</table>

${f.technicalReviewNotes ? `<h2>Revisión técnica</h2><div class="note">${esc(f.technicalReviewNotes)}</div>` : ''}
${f.internalNotes ? `<h2>Notas internas</h2><div class="note">${esc(f.internalNotes)}</div>` : ''}

<footer>
  <span>ASTOR Remote Clinic · ${date}</span>
  <span>Código: ${esc(record.code)} · Autorización pendiente de profesional responsable</span>
</footer>

<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400))<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permite ventanas emergentes para imprimir la orden.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  addHistoryEvent('Orden de fabricación impresa', `Código ${record.code}`);
}

async function importDatabase() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error('El archivo no es una lista de casos.');

      const valid = imported.filter(item => item?.id && item?.code);
      if (!valid.length) throw new Error('No se encontraron casos válidos en el archivo.');

      const confirmMsg = `Se importarán ${valid.length} caso(s).\n\nLos casos existentes con el mismo ID serán sobreescritos.\n¿Continuar?`;
      if (!confirm(confirmMsg)) return;

      for (const record of valid) {
        record.files = record.files || {};
        // Los blobs no se guardan en JSON — se dejan vacíos
        for (const key of Object.keys(record.files)) {
          if (record.files[key]) delete record.files[key].blob;
        }
        await saveRecord(record);
      }

      state.records = await getAllRecords();
      renderAll();
      addHistoryEvent('Base importada', `${valid.length} caso(s) restaurados desde ${file.name}.`);
      alert(`✓ ${valid.length} caso(s) importados correctamente.\n\nNota: los archivos adjuntos (fotos, videos, recetas) no se restauran desde el JSON — solo los datos del formulario.`);
    } catch (err) {
      alert(`Error al importar: ${err.message}`);
    }
  });
  input.click();
}

function buildShippingMessage(record = activeRecord()) {
  if (!record) return '';
  const name = record.fields.fullName || 'paciente';
  const tracking = record.fields.trackingCode || record.fields.trackingUrl || null;
  const carrier = record.fields.carrier || 'el servicio de envío';
  const date = record.fields.shippingDate
    ? new Date(record.fields.shippingDate + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'en los próximos días';
  return [
    `Hola ${name}, somos Astor Biomecánica.`,
    `¡Tu plantilla ortopédica ya fue despachada!`,
    `Tu número de orden es ${record.code}.`,
    `Enviamos a través de ${carrier}, despacho estimado: ${date}.`,
    tracking ? `Código de seguimiento: ${tracking}` : '',
    `Ante cualquier consulta estamos a tu disposición.`,
    `¡Que te mejore mucho!`
  ].filter(Boolean).join('\n');
}

function buildPostDeliveryMessage(record = activeRecord()) {
  if (!record) return '';
  const name = record.fields.fullName || 'paciente';
  return [
    `Hola ${name}, somos Astor Biomecánica.`,
    `Esperamos que hayas recibido tu plantilla ortopédica en perfectas condiciones.`,
    `Para un mejor resultado, recuerda:`,
    `· Úsala de forma progresiva los primeros días.`,
    `· Cualquier molestia inusual nos la cuentas para ajustar.`,
    `· Recomendamos control a las 4 semanas.`,
    `¿Pudiste recibirla bien? Nos avisas para cerrar tu caso.`,
    `¡Gracias por confiar en Astor Biomecánica!`
  ].join('\n');
}

async function createDemoRecord() {
  if (!confirm('Se creará un caso de ejemplo con datos ficticios para explorar la app.\n¿Continuar?')) return;

  const now = new Date();
  const demo = {
    id: crypto.randomUUID(),
    code: `DEMO-${String(now.getTime()).slice(-5)}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [
      { title: 'Caso creado', detail: 'Caso de demostración generado automáticamente.', at: now.toISOString() }
    ],
    checks: {
      consentRemoteEvaluation: true,
      consentHealthData: true,
      consentPhotosVideos: true,
      consentCommunication: true,
      consentTerms: true,
      qcPhotosSharp: true,
      qcFullFoot: true,
      qcReferenceVisible: true,
      qcCameraParallel: true,
      qcBothFeet: true,
      qcGaitReady: true,
    },
    files: {},
    fields: {
      fullName: 'María González Soto',
      documentId: '12.345.678-9',
      phone: '+56 9 8765 4321',
      email: 'maria.gonzalez@ejemplo.cl',
      city: 'Santiago',
      occupation: 'Profesora',
      weightKg: '72',
      heightCm: '163',
      bmiValue: '27.1',
      bmiClassification: 'Sobrepeso',
      diagnosis: 'Fascitis plantar bilateral con pie plano flexible grado II',
      mainPainArea: 'Talón y arco plantar bilateral',
      painScale: '6',
      activityLevel: 'Moderado',
      footwearType: 'Zapatos cerrados con taco bajo',
      functionalGoal: 'Reducir dolor al caminar más de 30 minutos',
      medicalIndication: 'Plantilla ortopédica con soporte de arco y descarga de talón',
      evaluationNotes: 'Paciente con sobrepeso, trabajo de pie 6h/día. Dolor matutino fuerte al levantarse.',
      consentDate: now.toISOString().slice(0, 10),
      leftLengthCm: '24.5',
      rightLengthCm: '24.3',
      leftMttWidthCm: '9.2',
      rightMttWidthCm: '9.1',
      leftHeelWidthCm: '6.8',
      rightHeelWidthCm: '6.7',
      leftShoeSize: '38',
      rightShoeSize: '38',
      leftArch: 'Plano',
      rightArch: 'Plano',
      insoleType: 'Plantilla de soporte total con cuña de pronación',
      baseMaterial: 'EVA 45° + capa de memoria',
      topCover: 'Poron 3mm',
      corrections: 'Cuña varo 4° bilateral, alza de talón 6mm, descarga metatarsal',
      medicalIndication: 'Soporte plantar completo con control de pronación',
      paymentMethod: 'Transferencia bancaria',
      paymentAmount: '65000',
      paymentStatus: 'Validado',
      orderStatus: 'En revisión',
      manufacturingDate: new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10),
    }
  };

  await saveRecord(demo);
  state.records = await getAllRecords();
  state.activeId = demo.id;
  loadActiveIntoUi();
  renderAll();
  addHistoryEvent('Caso de ejemplo cargado', 'María González · DEMO · datos ficticios para exploración.');
  alert(`✓ Caso de ejemplo creado: ${demo.code}\n\nExplora las secciones del menú lateral para ver todas las funciones.\nLos datos son ficticios — puedes eliminarlo cuando termines.`);
}

function bindProEnhancements() {
  document.querySelectorAll('[data-goto]').forEach(button => {
    button.addEventListener('click', () => {
      const section = button.dataset.goto;
      document.querySelector(`.nav-item[data-section="${section}"]`)?.click();
    });
  });
  document.querySelector('#validateReadyBtn')?.addEventListener('click', validateActiveRecord);
  document.querySelector('#validateReadyBtnAlt')?.addEventListener('click', validateActiveRecord);
  document.querySelector('#copyWhatsAppBtn')?.addEventListener('click', copyWhatsAppMessage);
  document.querySelector('#copyOrderMsgBtn')?.addEventListener('click', copyWhatsAppMessage);
  document.querySelector('#copyPaymentMsgBtn')?.addEventListener('click', copyPaymentMessage);
  document.querySelector('#exportDatabaseBtn')?.addEventListener('click', exportDatabase);
  document.querySelector('#importDatabaseBtn')?.addEventListener('click', importDatabase);
  document.querySelector('#printOrderBtn')?.addEventListener('click', printManufacturingOrder);
  document.querySelector('#copyShippingMsgBtn')?.addEventListener('click', async () => {
    const text = buildShippingMessage();
    if (!text) { alert('Primero selecciona un caso.'); return; }
    await copyTextToClipboard(text);
    addHistoryEvent('Mensaje de despacho copiado', 'Confirmación de envío al portapapeles.');
    alert('Mensaje de despacho copiado.');
  });
  document.querySelector('#copyPostDeliveryMsgBtn')?.addEventListener('click', async () => {
    const text = buildPostDeliveryMessage();
    if (!text) { alert('Primero selecciona un caso.'); return; }
    await copyTextToClipboard(text);
    addHistoryEvent('Mensaje post-entrega copiado', 'Seguimiento post-entrega al portapapeles.');
    alert('Mensaje post-entrega copiado.');
  });
  document.querySelector('#addReviewNoteBtn')?.addEventListener('click', () => {
    const detail = prompt('Nota tecnica para este caso:');
    if (detail) addHistoryEvent('Nota tecnica', detail);
  });
  document.querySelectorAll('[data-order-filter]').forEach(button => {
    button.addEventListener('click', () => {
      state.orderFilter = button.dataset.orderFilter;
      document.querySelectorAll('[data-order-filter]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      renderOrdersBoard();
    });
  });
}

function setPhotoMeasureMode(mode) {
  photoMeasure.mode = mode;
  const labels = {
    calibration: 'Marca dos puntos sobre la referencia.',
    length: 'Marca talon y punta del dedo mas largo.',
    width: 'Marca los extremos del ancho a medir.'
  };
  els.calibrationStatus.textContent = labels[mode];
}

function loadPhotoMeasure(file) {
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(image.src);
    photoMeasure.image = image;
    photoMeasure.points.calibration = [];
    photoMeasure.points.length = [];
    photoMeasure.points.width = [];
    photoMeasure.scaleCmPerPx = null;
    els.photoMeasureEmpty.hidden = true;
    resizePhotoCanvas();
    renderPhotoMeasure();
    setPhotoMeasureMode('calibration');
  };
  image.src = URL.createObjectURL(file);
}

function resizePhotoCanvas() {
  const canvas = els.photoMeasureCanvas;
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(800, Math.round(box.width * ratio));
  canvas.height = Math.max(520, Math.round(box.height * ratio));
}

function imageDrawBox(canvas, image) {
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
    scale
  };
}

function canvasPoint(event) {
  const canvas = els.photoMeasureCanvas;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function addPhotoPoint(event) {
  if (!photoMeasure.image) return;
  const list = photoMeasure.points[photoMeasure.mode];
  list.push(canvasPoint(event));
  if (list.length > 2) list.shift();
  updatePhotoScaleAndResults();
  renderPhotoMeasure();
  advancePhotoMeasureMode();
}

function updatePhotoScaleAndResults() {
  const calibration = photoMeasure.points.calibration;
  if (calibration.length === 2) {
    const realCm = Number(els.calibrationCm.value);
    const px = distance(calibration[0], calibration[1]);
    photoMeasure.scaleCmPerPx = realCm > 0 && px > 0 ? realCm / px : null;
  }

  const length = measurePhotoPair('length');
  const width = measurePhotoPair('width');
  els.photoLengthResult.textContent = length ? `${length.toFixed(1)} cm` : '-- cm';
  els.photoWidthResult.textContent = width ? `${width.toFixed(1)} cm` : '-- cm';
  els.calibrationStatus.textContent = photoMeasure.scaleCmPerPx
    ? `Calibrado: ${(1 / photoMeasure.scaleCmPerPx).toFixed(1)} px/cm`
    : 'Sin calibrar';
}

function measurePhotoPair(key) {
  const points = photoMeasure.points[key];
  if (!photoMeasure.scaleCmPerPx || points.length !== 2) return null;
  return distance(points[0], points[1]) * photoMeasure.scaleCmPerPx;
}

function renderPhotoMeasure() {
  const canvas = els.photoMeasureCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1418';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!photoMeasure.image) return;

  const box = imageDrawBox(canvas, photoMeasure.image);
  ctx.drawImage(photoMeasure.image, box.x, box.y, box.width, box.height);
  drawPhotoPair(ctx, 'calibration', '#d7663f', 'REF');
  drawPhotoPair(ctx, 'length', '#2d7a62', 'LARGO');
  drawPhotoPair(ctx, 'width', '#3f6fd7', 'ANCHO');
}

function drawPhotoPair(ctx, key, color, label) {
  const points = photoMeasure.points[key];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  points.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.font = '700 24px Arial';
    ctx.fillText(label, (points[0].x + points[1].x) / 2 + 10, (points[0].y + points[1].y) / 2 - 10);
  }
}

function clearPhotoMeasurePoints() {
  photoMeasure.points.calibration = [];
  photoMeasure.points.length = [];
  photoMeasure.points.width = [];
  photoMeasure.scaleCmPerPx = null;
  updatePhotoScaleAndResults();
  renderPhotoMeasure();
}

function undoPhotoPoint() {
  const current = photoMeasure.points[photoMeasure.mode];
  if (current.length) {
    current.pop();
  } else if (photoMeasure.mode === 'width' && photoMeasure.points.length.length) {
    photoMeasure.mode = 'length';
    photoMeasure.points.length.pop();
  } else if (photoMeasure.mode === 'length' && photoMeasure.points.calibration.length) {
    photoMeasure.mode = 'calibration';
    photoMeasure.points.calibration.pop();
  }
  updatePhotoScaleAndResults();
  renderPhotoMeasure();
}

function advancePhotoMeasureMode() {
  if (photoMeasure.mode === 'calibration' && photoMeasure.points.calibration.length === 2) {
    setPhotoMeasureMode('length');
  } else if (photoMeasure.mode === 'length' && photoMeasure.points.length.length === 2) {
    setPhotoMeasureMode('width');
  }
}

function applyPhotoMeasuresToRecord() {
  const record = activeRecord();
  if (!record) return;
  const foot = els.photoTargetFoot.value;
  const length = measurePhotoPair('length');
  const width = measurePhotoPair('width');
  if (length) record.fields[`${foot}LengthCm`] = length.toFixed(1);
  if (width) {
    const widthKey = els.photoWidthField.value === 'heel' ? 'HeelWidthCm' : 'MttWidthCm';
    record.fields[`${foot}${widthKey}`] = width.toFixed(1);
  }
  loadActiveIntoUi();
  scheduleSave();
}

function bindPhotoMeasure() {
  els.photoMeasureInput?.addEventListener('change', event => loadPhotoMeasure(event.target.files[0]));
  els.photoMeasureCanvas?.addEventListener('click', addPhotoPoint);
  els.calibrationPreset?.addEventListener('change', () => {
    if (els.calibrationPreset.value !== 'custom') {
      els.calibrationCm.value = els.calibrationPreset.value;
    }
    updatePhotoScaleAndResults();
    renderPhotoMeasure();
  });
  els.calibrationCm?.addEventListener('input', () => {
    if (els.calibrationPreset) els.calibrationPreset.value = 'custom';
    updatePhotoScaleAndResults();
    renderPhotoMeasure();
  });
  els.setCalibrationMode?.addEventListener('click', () => setPhotoMeasureMode('calibration'));
  els.setLengthMode?.addEventListener('click', () => setPhotoMeasureMode('length'));
  els.setWidthMode?.addEventListener('click', () => setPhotoMeasureMode('width'));
  els.undoPhotoPoint?.addEventListener('click', undoPhotoPoint);
  els.clearPhotoMeasure?.addEventListener('click', clearPhotoMeasurePoints);
  els.applyPhotoMeasures?.addEventListener('click', applyPhotoMeasuresToRecord);
  window.addEventListener('resize', () => {
    if (!photoMeasure.image) return;
    resizePhotoCanvas();
    renderPhotoMeasure();
  });
}

async function openSoleCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setSoleCameraStatus('Camara no disponible en este navegador');
    return;
  }
  closeSoleCamera();
  try {
    soleCamera.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    els.soleCameraVideo.srcObject = soleCamera.stream;
    await els.soleCameraVideo.play();
    setSoleCameraStatus('Apoya el pie dentro del contorno');
    startSoleDetection();
  } catch (error) {
    setSoleCameraStatus('No se pudo abrir la camara');
  }
}

function closeSoleCamera() {
  stopSoleDetection();
  if (soleCamera.stream) {
    soleCamera.stream.getTracks().forEach(track => track.stop());
    soleCamera.stream = null;
  }
  if (els.soleCameraVideo) els.soleCameraVideo.srcObject = null;
  soleCamera.autoCapture = false;
  soleCamera.stableFrames = 0;
  setSoleCameraStatus('Camara cerrada');
}

function setSoleCameraStatus(text) {
  if (els.soleCameraStatus) els.soleCameraStatus.textContent = text;
}

function startSoleDetection() {
  stopSoleDetection();
  soleCamera.detectTimer = window.setInterval(analyzeSoleFrame, 650);
}

function stopSoleDetection() {
  if (soleCamera.detectTimer) {
    window.clearInterval(soleCamera.detectTimer);
    soleCamera.detectTimer = null;
  }
}

function analyzeSoleFrame() {
  const video = els.soleCameraVideo;
  if (!video || video.readyState < 2) return;
  const sample = document.createElement('canvas');
  sample.width = 96;
  sample.height = 96;
  const ctx = sample.getContext('2d');
  ctx.drawImage(video, 0, 0, sample.width, sample.height);
  const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
  let total = 0;
  let totalSq = 0;
  for (let index = 0; index < data.length; index += 4) {
    const value = (data[index] + data[index + 1] + data[index + 2]) / 3;
    total += value;
    totalSq += value * value;
  }
  const count = data.length / 4;
  const mean = total / count;
  const variance = totalSq / count - mean * mean;
  const looksUsable = mean > 35 && mean < 230 && variance > 280;

  if (looksUsable) {
    soleCamera.stableFrames += 1;
    setSoleCameraStatus(soleCamera.autoCapture ? `Pie detectado, mantente quieto ${soleCamera.stableFrames}/3` : 'Pie detectado dentro del visor');
  } else {
    soleCamera.stableFrames = 0;
    setSoleCameraStatus('Alinea el pie dentro del contorno y mejora la luz');
  }

  if (soleCamera.autoCapture && soleCamera.stableFrames >= 3) {
    soleCamera.autoCapture = false;
    captureSolePhoto();
  }
}

function captureSolePhoto() {
  const video = els.soleCameraVideo;
  if (!video || video.readyState < 2) {
    setSoleCameraStatus('Abre la camara antes de capturar');
    return;
  }
  const capture = document.createElement('canvas');
  capture.width = video.videoWidth || 1280;
  capture.height = video.videoHeight || 720;
  capture.getContext('2d').drawImage(video, 0, 0, capture.width, capture.height);
  const image = new Image();
  image.onload = () => {
    photoMeasure.image = image;
    photoMeasure.points.calibration = [];
    photoMeasure.points.length = [];
    photoMeasure.points.width = [];
    photoMeasure.scaleCmPerPx = null;
    els.photoMeasureEmpty.hidden = true;
    resizePhotoCanvas();
    renderPhotoMeasure();
    setPhotoMeasureMode('calibration');
    setSoleCameraStatus('Captura lista para medir');
  };
  image.src = capture.toDataURL('image/jpeg', .92);
}

function bindSoleCamera() {
  els.openSoleCamera?.addEventListener('click', openSoleCamera);
  els.closeSoleCamera?.addEventListener('click', closeSoleCamera);
  els.captureSolePhoto?.addEventListener('click', captureSolePhoto);
  els.autoSoleCapture?.addEventListener('click', () => {
    if (!soleCamera.stream) {
      openSoleCamera().then(() => {
        soleCamera.autoCapture = true;
        soleCamera.stableFrames = 0;
      });
      return;
    }
    soleCamera.autoCapture = true;
    soleCamera.stableFrames = 0;
    setSoleCameraStatus('Captura automatica activa');
  });
}

async function init() {
  state.db = await openDb();
  state.records = await getAllRecords();
  if (!state.records.length) {
    const record = createRecord();
    await saveRecord(record);
    state.records = [record];
  }
  state.activeId = state.records[0].id;

  buildFootCards();
  bindNavigation();
  bindForm();
  bindFiles();
  bindPhotoMeasure();
  bindSoleCamera();
  bindProEnhancements();

  document.querySelector('#newRecordBtn').addEventListener('click', async () => {
    const record = createRecord();
    state.records.unshift(record);
    state.activeId = record.id;
    await saveRecord(record);
    loadActiveIntoUi();
    renderAll();
  });

  document.querySelector('#copyLeftToRight').addEventListener('click', () => {
    const record = activeRecord();
    if (!record) return;
    record.fields.rightLengthCm = record.fields.leftLengthCm || '';
    record.fields.rightMttWidthCm = record.fields.leftMttWidthCm || '';
    record.fields.rightHeelWidthCm = record.fields.leftHeelWidthCm || '';
    record.fields.rightShoeSize = record.fields.leftShoeSize || '';
    record.fields.rightArch = record.fields.leftArch || '';
    loadActiveIntoUi();
    scheduleSave();
  });

  document.querySelector('#exportBtn').addEventListener('click', exportActiveRecord);
  document.querySelector('#demoRecordBtn')?.addEventListener('click', createDemoRecord);
  els.search.addEventListener('input', renderPatients);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  loadActiveIntoUi();
  renderAll();
  renderProDashboard();
  renderCaseHistory();
}

init().catch(error => {
  console.error(error);
  setSaveState('Error al iniciar');
});
