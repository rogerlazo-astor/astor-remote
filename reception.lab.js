(function(){
"use strict";
const q=s=>document.querySelector(s);
function rec(){return typeof activeRecord==="function"?activeRecord():null}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function consentOk(r){return ["consentRemoteEvaluation","consentHealthData","consentPhotosVideos","consentCommunication","consentTerms"].every(k=>!!r?.checks?.[k])}
function photoCount(r){return typeof footViews==="undefined"?0:footViews.filter(([k])=>!!r?.files?.[k]).length}
function shortCode(r){
  r.fields=r.fields||{};
  if(r.fields.productionShortCode)return r.fields.productionShortCode;
  const city=(r.fields.city||"").toLowerCase();
  const prefix=city.includes("iquique")?"IQ":city.includes("arica")?"A":"RC";
  const digits=String(r.code||r.id||Date.now()).replace(/\D/g,"").slice(-4).padStart(4,"0");
  return r.fields.productionShortCode=`${prefix}-${digits}`;
}
function readiness(r){
  if(!r)return{color:"red",label:"Sin caso",canSend:false,done:[],block:["Crear o seleccionar un caso"],warn:[]};
  const done=[],block=[],warn=[];
  (r.fields?.fullName&&r.fields?.phone&&r.fields?.city?done:block).push("Datos del paciente");
  (consentOk(r)?done:block).push("Consentimiento");
  (r.files?.prescription?done:block).push("Receta mÃÂÃÂ©dica");
  const pc=photoCount(r); (pc>=6?done:block).push(`FotografÃÂÃÂ­as ${pc}/10`);
  (r.files?.gaitVideo?done:warn).push("Video de marcha");
  (r.fields?.leftLengthCm||r.fields?.rightLengthCm?done:block).push("Medidas");
  (r.fields?.paymentStatus==="Validado"?done:warn).push(`Pago: ${r.fields?.paymentStatus||"Pendiente"}`);
  (r.checks?.fabricationProposalApproved?done:block).push("AprobaciÃÂÃÂ³n tÃÂÃÂ©cnica");
  if(block.length)return{color:"red",label:"No fabricar",canSend:false,done,block,warn};
  if(warn.length)return{color:"yellow",label:"Listo con observaciones",canSend:true,done,block,warn};
  return{color:"green",label:"Listo para producciÃÂÃÂ³n",canSend:true,done,block,warn};
}
function inject(){
  const nav=q(".nav-list"),main=q(".main-panel");
  if(nav&&!q('[data-section="recepcion-lab"]')){
    const b=document.createElement("button"); b.className="nav-item"; b.type="button"; b.dataset.section="recepcion-lab";
    b.innerHTML='<span class="icon">R</span><span>RecepciÃÂÃÂ³n LAB</span>'; nav.appendChild(b);
    b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(x=>x.classList.remove("active-view"));q("#recepcion-lab")?.classList.add("active-view");render()};
  }
  if(main&&(!q("#recepcion-lab")||!q("#recepcion-lab").children.length)){
    const s=q("#recepcion-lab")||document.createElement("section"); s.id="recepcion-lab"; s.className="view";
    s.innerHTML=`<div class="reception-hero"><div><p class="eyebrow">ASTOR ÃÂÃÂ· RECEPCIÃÂÃÂN LAB</p><h3>Finalizar caso y enviar a producciÃÂÃÂ³n</h3><p>Revisa los requisitos antes de liberar el caso.</p></div><div id="receptionTraffic" class="reception-traffic red"><span></span><strong id="receptionLabel">Sin caso</strong></div></div>
    <div class="reception-case"><div><small>Paciente</small><strong id="rPatient">ÃÂ¢ÃÂÃÂ</strong></div><div><small>SÃÂÃÂ³digo clÃÂÃÂ­nico</small><strong id="rClinical">ÃÂ¢ÃÂÃÂ</strong></div><div><small>CÃÂÃÂ³digo producciÃÂÃÂ³n</small><strong id="rProduction">ÃÂ¢ÃÂÃÂ</strong></div><div><small>Sede</small><strong id="rCity">ÃÂ¢ÃÂÃÂ</strong></div></div>
    <div class="reception-grid"><article><h4>Completado</h4><ul id="rDone"></ul></article><article><h4>Bloqueos</h4><ul id="rBlock"></ul></article><article><h4>Advertencias</h4><ul id="rWarn"></ul></article></div>
    <fieldset><legend>Control final</legend><label>Responsable<input name="receptionResponsible"></label><label>Prioridad<select name="labPriority"><option>Normal</option><option>Alta</option><option>Urgente</option><option>Baja</option></select></label><label>Observaciones<textarea name="receptionLabNotes" rows="4"></textarea></label><label><input type="checkbox" name="receptionFinalConfirmation"> Confirmo la revisiÃÂÃÂ³n final.</label><div class="reception-actions"><button id="rRefresh" class="ghost-btn" type="button">Actualizar</button><button id="rSend" class="primary-btn" type="button">Enviar a producciÃÂÃÂ³n</button></div></fieldset>`;
    if(!s.parentElement)main.appendChild(s); const _rr=q("#rRefresh");if(_rr)_rr.onclick=render; const _rs=q("#rSend");if(_rs)_rs.onclick=send;
    s.querySelectorAll("input[name],select[name],textarea[name]").forEach(x=>x.addEventListener(x.type==="checkbox"||x.tagName==="SELECT"?"change":"input",persist));
  }
}
function li(a,e){return a.length?a.map(x=>`<li>${esc(x)}</li>`).join(""):`<li>${e}</li>`}
function loadFields(r){if(!r)return;["receptionResponsible","labPriority","receptionLabNotes"].forEach(n=>{const x=q(`[name="${n}"]`);if(x&&document.activeElement!==x)x.value=r.fields?.[n]|| (n==="labPriority"?"Normal":"")});const c=q('[name="receptionFinalConfirmation"]');if(c)c.checked=!!r.checks?.receptionFinalConfirmation}
function persist(){
  const r=rec(); if(!r)return; r.fields=r.fields||{};r.checks=r.checks||{};
  r.fields.receptionResponsible=q('[name="receptionResponsible"]')?.value||"";
  r.fields.labPriority=q('[name="labPriority"]')?.value||"Normal";
  r.fields.receptionLabNotes=q('[name="receptionLabNotes"]')?.value||"";
  r.checks.receptionFinalConfirmation=!!q('[name="receptionFinalConfirmation"]')?.checked;
  shortCode(r); if(typeof scheduleSave==="function")scheduleSave();
}
function render(){
  const r=rec(),st=readiness(r),t=q("#receptionTraffic"); if(!t)return;
  t.className=`reception-traffic ${st.color}`;q("#receptionLabel").textContent=st.label;q("#rPatient").textContent=r?.fields?.fullName||"ÃÂ¢ÃÂÃÂ";q("#rClinical").textContent=r?.code||"ÃÂ¢ÃÂÃÂ";q("#rProduction").textContent=r?shortCode(r):"ÃÂ¢ÃÂÃÂ";q("#rCity").textContent=r?.fields?.city||"ÃÂ¢ÃÂÃÂ";q("#rDone").innerHTML=li(st.done,"Nada completado");q("#rBlock").innerHTML=li(st.block,"Sin bloqueos");q("#rWarn").innerHTML=li(st.warn,"Sin advertencias");q("#rSend").disabled=!st.canSend;loadFields(r);
}
async function send(){
  const r=rec();if(!r)return alert("Selecciona un caso.");persist();const st=readiness(r);
  if(!r.checks?.receptionFinalConfirmation)return alert("Confirma la revisiÃÂÃÂ³n final.");
  if(!st.canSend)return alert("No se puede enviar.\n\nFalta:\n- "+st.block.join("\n- "));
  const now=new Date().toISOString();r.fields.labStage="Ingreso";r.fields.orderStatus="En fabricaciÃÂÃÂ³n";r.fields.sentToProductionAt=now;r.history=r.history||[];r.history.unshift({at:now,title:"Caso enviado a ASTOR LAB",detail:`${shortCode(r)} ÃÂÃÂ· ${r.fields.receptionResponsible||"RecepciÃÂÃÂ³n"}`});
  if(typeof saveRecord==="function")await saveRecord(r);else if(typeof persistActive==="function")persistActive();
  if(typeof renderAll==="function")renderAll();alert(`Caso ${shortCode(r)} enviado a producciÃÂÃÂ³n.`);render();
}
function init(){inject();setTimeout(render,350);const title=q("#activePatientTitle");if(title&&window.MutationObserver)new MutationObserver(()=>setTimeout(render,60)).observe(title,{childList:true,subtree:true,characterData:true})}
init();
})();