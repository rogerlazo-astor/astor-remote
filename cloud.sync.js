/**
 * ASTOR CLOUD SYNC v2.0
 */
(function () {
  "use strict";

  const state = { authClient: null, session: null, user: null, initPromise: null };

  function cfg() { return window.ASTOR_CLOUD_CONFIG || {}; }

  function isConfigured() {
    const c = cfg();
    return Boolean(c.enabled === true && c.supabaseUrl && c.publishableKey &&
      !c.supabaseUrl.includes("PEGAR_") && !c.publishableKey.includes("PEGAR_"));
  }

  function updateCloudBadge(text, isError = false) {
    let badge = document.querySelector("#astorCloudBadge");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "astorCloudBadge";
      badge.className = "astor-cloud-badge";
      document.querySelector(".status-strip")?.appendChild(badge);
    }
    badge.textContent = `Nube: ${text}`;
    badge.classList.toggle("error", isError);
  }

  function getAuthClient() {
    if (state.authClient) return state.authClient;
    const c = cfg();
    state.authClient = window.supabase.createClient(c.supabaseUrl, c.publishableKey, {
      auth: { storageKey: "astor-remote-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return state.authClient;
  }

  async function ensureSession() {
    const client = getAuthClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (!sessionError && sessionData.session?.access_token) {
      const { data: userData, error: userError } = await client.auth.getUser(sessionData.session.access_token);
      if (!userError && userData.user) {
        state.session = sessionData.session;
        state.user = userData.user;
        return sessionData.session;
      }
    }
    try { await client.auth.signOut({ scope: "local" }); } catch (e) {}
    const { data, error } = await client.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session?.access_token || !data.user) throw new Error("No se pudo crear una sesion anonima valida.");
    state.session = data.session;
    state.user = data.user;
    return data.session;
  }

  async function getDataClient() { await ensureSession(); return getAuthClient(); }

  function recordPayload(record) {
    const filesMetadata = {};
    for (const [key, file] of Object.entries(record.files || {})) {
      if (file) filesMetadata[key] = { name: file.name, type: file.type, size: file.size, updatedAt: file.updatedAt || null, cloudPath: file.cloudPath || null, cloudUrl: file.cloudUrl || null };
    }
    return { id: record.id, code: record.code, fields: record.fields || {}, checks: record.checks || {}, history: record.history || [], fabricationProposal: record.fabricationProposal || null, createdAt: record.createdAt || null, updatedAt: new Date().toISOString(), files: filesMetadata };
  }

  async function init() {
    if (state.initPromise) return state.initPromise;
    state.initPromise = (async () => {
      if (!isConfigured()) throw new Error("Supabase no esta configurado.");
      if (!window.supabase?.createClient) throw new Error("No se cargo supabase-js.");
      const session = await ensureSession();
      const client = await getDataClient();
      const { error: profileError } = await client.from("astor_profiles").upsert({ user_id: session.user.id, role: "patient", display_name: null }, { onConflict: "user_id" });
      if (profileError) console.warn("ASTOR profile warning:", profileError);
      updateCloudBadge("Conectado");
      return true;
    })();
    try { return await state.initPromise; } catch (error) { state.initPromise = null; updateCloudBadge("Error", true); throw error; }
  }

  async function uploadFiles(record, caseId, client, session) {
    const bucket = cfg().bucket || "astor-case-files";
    const userId = session.user.id;
    const localId = String(record.id);
    const filesToUpload = Object.entries(record.files || {}).filter(([, file]) => file?.blob instanceof Blob || file?.blob instanceof File);
    const uploaded = [], errors = [];
    for (const [key, file] of filesToUpload) {
      try {
        const ext = (file.name || "").split(".").pop() || "bin";
        const storagePath = `${userId}/${localId}/${key}.${ext}`;
        const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, file.blob, { upsert: true, contentType: file.type || "application/octet-stream" });
        if (uploadError) { errors.push({ key, error: uploadError.message }); continue; }
        const { data: urlData } = client.storage.from(bucket).getPublicUrl(storagePath);
        file.cloudPath = storagePath;
        file.cloudUrl = urlData?.publicUrl || null;
        await client.from("astor_case_files").upsert({ case_id: caseId, owner_id: userId, file_key: key, file_name: file.name, mime_type: file.type, size_bytes: file.size || null, storage_path: storagePath, public_url: file.cloudUrl }, { onConflict: "case_id,file_key" });
        uploaded.push({ key, path: storagePath, url: file.cloudUrl });
      } catch (err) { errors.push({ key, error: err.message }); }
    }
    return { uploaded, errors };
  }

  async function syncRecord(record) {
    if (!record) throw new Error("No existe un caso activo.");
    updateCloudBadge("Enviando...");
    try {
      await init();
      const session = await ensureSession();
      const client = await getDataClient();
      const { data, error } = await client.from("astor_cases").upsert({
        owner_id: session.user.id, local_id: String(record.id),
        case_code: record.code || `AST-${Date.now()}`,
        patient_name: record.fields?.fullName || null,
        city: record.fields?.city || null,
        status: record.fields?.orderStatus || "draft",
        payload: recordPayload(record),
      }, { onConflict: "owner_id,local_id" }).select("id,case_code,status,updated_at").single();
      if (error) throw error;
      record.fields = record.fields || {};
      record.fields.cloudCaseId = data.id;
      record.fields.cloudUpdatedAt = data.updated_at;
      updateCloudBadge("Subiendo archivos...");
      const { uploaded, errors } = await uploadFiles(record, data.id, client, session);
      if (uploaded.length > 0) await client.from("astor_cases").update({ payload: recordPayload(record) }).eq("id", data.id);
      const remoteStatus = data.status;
      const localStatus = record.fields?.orderStatus;
      if (remoteStatus && remoteStatus !== localStatus && remoteStatus !== 'draft') {
        record.fields.orderStatus = remoteStatus;
      }
      if (typeof persistActive === "function") persistActive();
      if (errors.length > 0) updateCloudBadge(`${uploaded.length} archivos · ${errors.length} errores`, true);
      else updateCloudBadge(uploaded.length > 0 ? `Sincronizado · ${uploaded.length} archivos` : "Sincronizado");
      return { caseId: data.id, caseCode: data.case_code, uploaded, errors };
    } catch (error) { console.error("ASTOR Cloud sync error:", error); updateCloudBadge("Error", true); throw error; }
  }

  async function listCloudCases() {
    await init(); const client = await getDataClient();
    const { data, error } = await client.from("astor_cases").select("id,case_code,patient_name,city,status,updated_at,payload").order("updated_at", { ascending: false });
    if (error) throw error; return data || [];
  }

  async function listCaseFiles(caseId) {
    await init(); const client = await getDataClient();
    const { data, error } = await client.from("astor_case_files").select("file_key,file_name,mime_type,size_bytes,public_url,created_at").eq("case_id", caseId).order("created_at", { ascending: true });
    if (error) throw error; return data || [];
  }

  function injectCloudButton() {
    const actions = document.querySelector(".sidebar-actions") || document.querySelector(".sidebar") || document.querySelector("aside");
    if (!actions || document.querySelector("#astorCloudSyncBtn")) return;
    const button = document.createElement("button");
    button.id = "astorCloudSyncBtn"; button.className = "ghost-btn"; button.type = "button"; button.textContent = "Enviar caso a la nube";
    button.addEventListener("click", async () => {
      const record = typeof activeRecord === "function" ? activeRecord() : null;
      if (!record) { alert("Primero crea o selecciona un caso."); return; }
      button.disabled = true; button.textContent = "Enviando...";
      try {
        const result = await syncRecord(record);
        const fileMsg = result.uploaded.length > 0 ? `\n${result.uploaded.length} archivo(s) subido(s) al almacenamiento.` : "\nSin archivos nuevos para subir.";
        const errMsg = result.errors.length > 0 ? `\n⚠ ${result.errors.length} archivo(s) con error:\n  · ${result.errors.map((e) => e.key).join("\n  · ")}` : "";
        alert(`Caso sincronizado.\nCodigo: ${result.caseCode}${fileMsg}${errMsg}`);
      } catch (error) { alert(`No se pudo sincronizar:\n${error.message}`); }
      finally { button.disabled = false; button.textContent = "Enviar caso a la nube"; }
    });
    actions.appendChild(button);
  }

  async function initUi() {
    injectCloudButton();
    if (!isConfigured()) { updateCloudBadge("Pendiente"); return; }
    try { await init(); } catch (error) { console.error("ASTOR Cloud init error:", error); }
  }

  function getClient(){ return state.authClient||null; }
  window.ASTOR_CLOUD = { init, syncRecord, listCloudCases, listCaseFiles, isConfigured, getClient };
  initUi();
})();
