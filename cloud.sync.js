/**
 * ASTOR CLOUD SYNC v2.5
 *
 * Root-cause fix: supabase-js's PostgREST client captures window.fetch at module
 * load time (before our patch), so it never receives our patched version.
 * Also, astorFetch was overriding explicit JWT headers with the stale localStorage
 * token, which caused 401 on our own raw-fetch calls.
 *
 * v2.5 approach:
 *   1. _patchFetch: only injects JWT when caller has NO existing JWT (Bearer ey...)
 *   2. ensureSession(): saves state.accessToken from the fresh in-memory session
 *   3. _dbFetch(): raw fetch helper that sets Authorization: Bearer ${state.accessToken}
 *      explicitly — bypasses supabase-js PostgREST entirely
 *   4. All DB operations (syncRecord, listCloudCases, listCaseFiles, init) use _dbFetch
 */
(function () {
  "use strict";

  const state = { authClient: null, session: null, user: null, accessToken: null, initPromise: null };

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

  // Patch window.fetch: only injects JWT when the caller has NO existing JWT.
  // This prevents overriding explicit Authorization headers set by our own _dbFetch().
  // (supabase-js PostgREST doesn't go through window.fetch anyway — it captured
  //  the original at module-load time — so this only affects our own fetch calls.)
  function _patchFetch(supabaseUrl) {
    const _orig = window.fetch.bind(window);
    window.fetch = function astorFetch(url, options) {
      const u = String(url);
      if (u.startsWith(supabaseUrl + "/rest/") || u.startsWith(supabaseUrl + "/storage/")) {
        try {
          // Read existing Authorization header
          const hdrs = options?.headers;
          const existingAuth = hdrs instanceof Headers
            ? hdrs.get("Authorization")
            : (hdrs?.Authorization || hdrs?.authorization || "");
          // Only inject if no valid JWT already present
          if (!existingAuth || !existingAuth.startsWith("Bearer ey")) {
            const token = state.accessToken;
            if (token) {
              const headers = new Headers(hdrs || {});
              headers.set("Authorization", "Bearer " + token);
              options = Object.assign({}, options, { headers });
            }
          }
        } catch (_) {}
      }
      return _orig(url, options);
    };
  }

  function getAuthClient() {
    if (state.authClient) return state.authClient;
    const c = cfg();
    state.authClient = window.supabase.createClient(c.supabaseUrl, c.publishableKey, {
      auth: { storageKey: "astor-remote-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return state.authClient;
  }

  function getClient() { return state.authClient || null; }

  async function ensureSession() {
    const client = getAuthClient();

    // 1. Try getSession() — works when supabase client has in-memory session
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (!sessionError && sessionData.session?.access_token) {
      const { data: userData, error: userError } = await client.auth.getUser(sessionData.session.access_token);
      if (!userError && userData.user) {
        state.session = sessionData.session;
        state.user = userData.user;
        state.accessToken = sessionData.session.access_token; // save for _dbFetch
        return sessionData.session;
      }
    }

    // 2. Fallback: restore from localStorage (set by auth.ui.js after user sign-in)
    try {
      const raw = localStorage.getItem("astor-remote-auth");
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored?.access_token && stored?.refresh_token) {
          const { data: sd, error: se } = await client.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          });
          if (!se && sd?.session?.user) {
            state.session = sd.session;
            state.user = sd.session.user;
            state.accessToken = sd.session.access_token; // save for _dbFetch
            return sd.session;
          }
        }
      }
    } catch (e) {}

    throw new Error("Sesión no encontrada. Por favor inicia sesión.");
  }

  // Raw REST helper — bypasses supabase-js PostgREST client entirely.
  // Sets Authorization: Bearer <state.accessToken> explicitly so astorFetch
  // won't override it (it only injects when no JWT is present).
  async function _dbFetch(path, method, body, prefer) {
    const c = cfg();
    const token = state.accessToken;
    if (!token) throw new Error("Sin sesión activa. Por favor inicia sesión.");
    const headers = {
      "Authorization": "Bearer " + token,
      "apikey": c.publishableKey,
      "Content-Type": "application/json",
    };
    if (prefer) headers["Prefer"] = prefer;
    const resp = await fetch(
      `${c.supabaseUrl}/rest/v1/${path}`,
      { method: method || "GET", headers, ...(body != null ? { body: JSON.stringify(body) } : {}) }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw Object.assign(new Error(err.message || `HTTP ${resp.status}`), { code: err.code, details: err.details });
    }
    return resp.json();
  }

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
      // Profile upsert via raw fetch (avoids supabase-js PostgREST JWT issue)
      try {
        await _dbFetch("astor_profiles", "POST",
          { user_id: session.user.id, role: "patient", display_name: null },
          "resolution=merge-duplicates"
        );
      } catch (e) { console.warn("ASTOR profile warning:", e.message); }
      updateCloudBadge("Conectado");
      return true;
    })();
    try { return await state.initPromise; } catch (error) { state.initPromise = null; updateCloudBadge("Error", true); throw error; }
  }

  async function uploadFiles(record, caseId, session) {
    const c = cfg();
    const bucket = c.bucket || "astor-case-files";
    const userId = session.user.id;
    const localId = String(record.id);
    const token = state.accessToken;
    const filesToUpload = Object.entries(record.files || {}).filter(([, file]) => file?.blob instanceof Blob || file?.blob instanceof File);
    const uploaded = [], errors = [];
    for (const [key, file] of filesToUpload) {
      try {
        const ext = (file.name || "").split(".").pop() || "bin";
        const storagePath = `${userId}/${localId}/${key}.${ext}`;
        // Upload via raw fetch (bypasses supabase-js storage client JWT issue)
        const uploadResp = await fetch(
          `${c.supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`,
          {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + token,
              "apikey": c.publishableKey,
              "Content-Type": file.type || "application/octet-stream",
              "x-upsert": "true",
            },
            body: file.blob,
          }
        );
        if (!uploadResp.ok) {
          const e = await uploadResp.json().catch(() => ({}));
          errors.push({ key, error: e.message || `HTTP ${uploadResp.status}` });
          continue;
        }
        const publicUrl = `${c.supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
        file.cloudPath = storagePath;
        file.cloudUrl = publicUrl;
        // Register in astor_case_files via raw fetch
        await _dbFetch("astor_case_files", "POST",
          { case_id: caseId, owner_id: userId, file_key: key, file_name: file.name, mime_type: file.type, size_bytes: file.size || null, storage_path: storagePath, public_url: publicUrl },
          "resolution=merge-duplicates"
        );
        uploaded.push({ key, path: storagePath, url: publicUrl });
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

      // Upsert case via raw fetch
      const rows = await _dbFetch(
        "astor_cases?select=id,case_code,status,updated_at",
        "POST",
        {
          owner_id: session.user.id,
          local_id: String(record.id),
          case_code: record.code || `AST-${Date.now()}`,
          patient_name: record.fields?.fullName || null,
          city: record.fields?.city || null,
          status: record.fields?.orderStatus || "draft",
          payload: recordPayload(record),
        },
        "resolution=merge-duplicates,return=representation"
      );
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (!data?.id) throw new Error("No se recibió confirmación del servidor.");

      record.fields = record.fields || {};
      record.fields.cloudCaseId = data.id;
      record.fields.cloudUpdatedAt = data.updated_at;

      updateCloudBadge("Subiendo archivos...");
      const { uploaded, errors } = await uploadFiles(record, data.id, session);

      // Update payload after file upload (adds cloudPath/cloudUrl)
      if (uploaded.length > 0) {
        await _dbFetch(`astor_cases?id=eq.${data.id}`, "PATCH", { payload: recordPayload(record) });
      }

      // Sync inverso: if admin changed status, apply locally
      const remoteStatus = data.status;
      const localStatus = record.fields?.orderStatus;
      if (remoteStatus && remoteStatus !== localStatus && remoteStatus !== "draft") {
        record.fields.orderStatus = remoteStatus;
        console.info(`ASTOR: estado actualizado por admin -> ${remoteStatus}`);
      }
      if (typeof persistActive === "function") persistActive();

      if (errors.length > 0) updateCloudBadge(`${uploaded.length} archivos · ${errors.length} errores`, true);
      else updateCloudBadge(uploaded.length > 0 ? `Sincronizado · ${uploaded.length} archivos` : "Sincronizado");

      return { caseId: data.id, caseCode: data.case_code, uploaded, errors };
    } catch (error) {
      console.error("ASTOR Cloud sync error:", error);
      updateCloudBadge("Error", true);
      throw error;
    }
  }

  async function listCloudCases() {
    await init();
    await ensureSession();
    return _dbFetch("astor_cases?select=id,case_code,patient_name,city,status,updated_at,payload&order=updated_at.desc");
  }

  async function listCaseFiles(caseId) {
    await init();
    await ensureSession();
    return _dbFetch(`astor_case_files?select=file_key,file_name,mime_type,size_bytes,public_url,created_at&case_id=eq.${caseId}&order=created_at.asc`);
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

  // Patch window.fetch FIRST (before createClient), so supabase-js auth module
  // captures the patched version for its dynamic window.fetch calls.
  if (window.supabase?.createClient && isConfigured()) {
    _patchFetch(cfg().supabaseUrl);
    getAuthClient();
  }

  window.ASTOR_CLOUD = { init, syncRecord, listCloudCases, listCaseFiles, isConfigured, getClient };
  initUi();
})();
