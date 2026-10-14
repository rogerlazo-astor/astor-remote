/* ASTOR V4 patient menu guard: UI-only; server-side authorization remains mandatory. */
(function () {
  "use strict";
  const labels = new Set(["pacientes","panel profesional","pedidos","astor lab","recepción lab","recepcion lab","nube","exportar ficha","caso de ejemplo"]);
  const normalize = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  let scheduled = false;
  function apply() {
    scheduled = false;
    document.body.classList.add("astor-patient-mode");
    document.querySelectorAll("a,button,li,.nav-item,.menu-item,.sidebar-actions>*").forEach(el => {
      const text = normalize(el.textContent);
      const internal = [...labels].some(label => text === label || text.endsWith(label));
      if (!internal) return;
      if (el.dataset.astorInternal !== "true") el.dataset.astorInternal = "true";
      if (el.getAttribute("aria-hidden") !== "true") el.setAttribute("aria-hidden","true");
      if (el.style.getPropertyValue("display") !== "none" || el.style.getPropertyPriority("display") !== "important") {
        el.style.setProperty("display","none","important");
      }
    });
    const button = document.getElementById("astorCloudSyncBtn");
    if (button && button.textContent !== "Enviar mi evaluación a ASTOR") button.textContent = "Enviar mi evaluación a ASTOR";
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }
  function init() {
    apply();
    // Observe inserted nodes only: changing styles/classes here cannot retrigger this observer.
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",init,{once:true}) : init();
})();
