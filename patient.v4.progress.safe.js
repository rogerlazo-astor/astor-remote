/* ASTOR V4 - observer guard for patient wizard. Integration testing required. */
(function(){
"use strict";
const STEP_LABELS=["Datos del paciente","Consentimiento","Evaluación clínica","Receta y pies","Postura","Marcha","Medidas","Pago y orden","Revisión final"];
const norm=s=>String(s||"").replace(/\s+/g," ").trim().toLowerCase();
function active(){try{return typeof activeRecord==="function"?activeRecord():null}catch{return null}}
function missing(){const r=active(),f=r?.fields||{},c=r?.checks||{};return [
["Nombre completo",!!f.fullName],["Teléfono o WhatsApp",!!(f.phone||f.whatsapp)],["Ciudad",!!f.city],
["Consentimiento",!!(c.consent||c.consentAccepted||f.consentAccepted)],["Motivo de consulta",!!(f.reason||f.consultationReason||f.chiefComplaint)],
["Receta o fotografía",!!(f.prescriptionFile||f.recipeFile||f.photoRight||f.photoLeft||Object.values(f).some(v=>v&&typeof v==="object"&&(v.dataUrl||v.cloudPath||v.name)))],
["Video de marcha",!!(f.gaitVideo||f.walkVideo||f.videoMarcha||Object.entries(f).some(([k,v])=>/video|marcha/i.test(k)&&v))],
["Medidas",Object.entries(f).some(([k,v])=>/medida|length|width|largo|ancho|shoe/i.test(k)&&v)],
["Pago u orden",!!(f.paymentMethod||f.paymentReceipt||f.orderStatus||f.paymentStatus)],
["Declaración final",!!(c.finalConfirm||f.finalConfirm)]].filter(([,ok])=>!ok).map(([label])=>label)}
function step(){const a=document.querySelector(".view.active-view,section.active-view,.view.active");const h=norm(a?.querySelector("h1,h2,h3")?.textContent);const i=STEP_LABELS.findIndex(x=>h.includes(norm(x)));return i<0?0:i}
function navigate(label){const el=[...document.querySelectorAll("button,a,.nav-item")].find(e=>norm(e.textContent).endsWith(norm(label)));el?.click()}
function toast(message){let el=document.querySelector("#astorV4Notice");if(!el){el=document.createElement("div");el.id="astorV4Notice";el.setAttribute("role","status");document.body.append(el)}el.textContent=message}
function progress(){const el=document.querySelector("#astorV4Progress");if(!el)return;const n=missing().length;el.textContent="Paso "+(step()+1)+" de 9 · "+Math.round((10-n)*10)+"% completado"}
function setup(){
if(!document.querySelector("#astorV4Progress")){const el=document.createElement("div");el.id="astorV4Progress";el.setAttribute("role","status");(document.querySelector(".topbar,header")||document.body).append(el)}
progress();
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;setup()})}
async function save(){if(typeof persistActive==="function")await persistActive()}
function init(){setup();document.addEventListener("input",schedule,true);document.addEventListener("change",schedule,true);
document.addEventListener("click",e=>{const btn=e.target.closest("[data-astor-v4-validate]");if(!btn)return;const m=missing();toast(m.length?"Faltan: "+m.join(", "):"Evaluación lista para revisión")});
const obs=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n.id!=="astorV4Progress")))schedule()});obs.observe(document.body,{childList:true,subtree:true});
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
