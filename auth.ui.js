(function(){
'use strict';

let _client=null;

function getClient(){
  if(_client)return _client;
  // Reuse cloud.sync.js client to share session storage (avoids lock conflict)
  if(window.ASTOR_CLOUD?.getClient){
    const shared=window.ASTOR_CLOUD.getClient();
    if(shared){_client=shared;return _client;}
  }
  const cfg=window.ASTOR_CLOUD_CONFIG;
  if(!cfg?.supabaseUrl||!cfg?.publishableKey)return null;
  if(!window.supabase?.createClient)return null;
  _client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{storageKey:"astor-remote-auth",persistSession:true,autoRefreshToken:true}});
  return _client;
}

function injectUI(){
  const nube=document.querySelector('#nube');
  if(!nube||document.querySelector('#auth-panel'))return;
  const p=document.createElement('div');
  p.id='auth-panel';
  p.style.cssText='max-width:420px;margin:1.5rem auto;background:#fff;border-radius:14px;padding:2rem;box-shadow:0 2px 12px rgba(0,0,0,.12)';
  p.innerHTML=`
<div id="auth-out">
  <h3 style="margin:0 0 1.2rem;color:#0d4a4a;font-size:1.15rem">Acceso profesional</h3>
  <label style="display:block;font-size:.82rem;color:#555;margin-bottom:.25rem">Nombre completo</label>
  <input id="aName" type="text" placeholder="Dr. Ana Torres" style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:6px;margin-bottom:.75rem;box-sizing:border-box;font-size:.95rem">
  <label style="display:block;font-size:.82rem;color:#555;margin-bottom:.25rem">Correo electrónico</label>
  <input id="aEmail" type="email" placeholder="profesional@clinica.cl" style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:6px;margin-bottom:.75rem;box-sizing:border-box;font-size:.95rem">
  <label style="display:block;font-size:.82rem;color:#555;margin-bottom:.25rem">Contraseña</label>
  <input id="aPass" type="password" placeholder="••••••••" style="width:100%;padding:.6rem;border:1px solid #ccc;border-radius:6px;margin-bottom:1.2rem;box-sizing:border-box;font-size:.95rem">
  <div style="display:flex;gap:.75rem">
    <button id="aSignIn" style="flex:1;padding:.7rem;background:#00a99d;color:#fff;border:none;border-radius:7px;font-size:.95rem;cursor:pointer;font-weight:600">Iniciar sesión</button>
    <button id="aSignUp" style="flex:1;padding:.7rem;background:#fff;color:#00a99d;border:1.5px solid #00a99d;border-radius:7px;font-size:.95rem;cursor:pointer;font-weight:600">Registrarse</button>
  </div>
  <p id="aMsg" style="margin:.75rem 0 0;font-size:.83rem;min-height:1.1em;color:#c0392b"></p>
</div>
<div id="auth-in" style="display:none;text-align:center;padding:.5rem 0">
  <div style="width:56px;height:56px;border-radius:50%;background:#00a99d;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto .75rem">👤</div>
  <div id="aUserName" style="font-size:1.1rem;font-weight:700;color:#0d4a4a;margin-bottom:.3rem"></div>
  <div id="aUserEmail" style="font-size:.85rem;color:#888;margin-bottom:1.5rem"></div>
  <button id="aSignOut" style="padding:.6rem 1.5rem;background:#e74c3c;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:.9rem">Cerrar sesión</button>
</div>`;
  nube.prepend(p);
  document.getElementById('aSignIn').onclick=()=>doAuth(false);
  document.getElementById('aSignUp').onclick=()=>doAuth(true);
  document.getElementById('aSignOut').onclick=doSignOut;
  document.getElementById('aPass').addEventListener('keydown',e=>{if(e.key==='Enter')doAuth(false);});
}

function msg(txt,ok=false){const el=document.getElementById('aMsg');if(el){el.textContent=txt;el.style.color=ok?'#27ae60':'#c0392b';}}

async function doAuth(isReg){
  const client=getClient();if(!client)return msg('Error de conexión');
  const email=(document.getElementById('aEmail')?.value||'').trim();
  const pass=document.getElementById('aPass')?.value||'';
  const name=(document.getElementById('aName')?.value||'').trim();
  if(!email||!pass)return msg('Completa correo y contraseña');
  msg('Conectando…',true);
  const{data,error}=isReg
    ?await client.auth.signUp({email,password:pass,options:{data:{full_name:name||email.split('@')[0]}}})
    :await client.auth.signInWithPassword({email,password:pass});
  if(error)return msg(error.message);
  // Store profile locally (publishable key JWT omits email)
  try{localStorage.setItem('astor-profile',JSON.stringify({email,name:name||email.split('@')[0]}));}catch(e){}
  if(isReg&&!data.session)return msg('Revisa tu correo y confirma tu cuenta',true);
  msg('');
  updateUI(data.user);
  if(window.ASTOR_CLOUD?.init)await window.ASTOR_CLOUD.init();
}

async function doSignOut(){
  try{localStorage.removeItem('astor-profile');}catch(e){}
  const client=getClient();if(!client)return;
  await client.auth.signOut();
  updateUI(null);
}

function updateUI(user){
  const inEl=document.getElementById('auth-in');
  const outEl=document.getElementById('auth-out');
  if(!inEl||!outEl)return;
  if(user){
    inEl.style.display='block';outEl.style.display='none';
    let _n=user.user_metadata?.full_name||user.email,_e=user.email;
    if(!_n||!_e){try{const p=JSON.parse(localStorage.getItem('astor-profile')||'{}');_n=_n||p.name||'';_e=_e||p.email||'';}catch(ex){}}
    const name=_n.includes('@')?_n.split('@')[0]:(_n||'?');
    document.getElementById('aUserName').textContent=name;
    document.getElementById('aUserEmail').textContent=_e;
    const nb=document.querySelector('[data-section="nube"]');
    if(nb)nb.textContent='☁ '+name.split(' ')[0];
  }else{
    inEl.style.display='none';outEl.style.display='block';
    const nb=document.querySelector('[data-section="nube"]');
    if(nb)nb.textContent='☁ Nube';
  }
}

async function init(){
  let tries=0;
  while(!window.supabase?.createClient&&tries++<30)await new Promise(r=>setTimeout(r,200));
  const client=getClient();if(!client)return;
  const tryInject=()=>{
    if(document.querySelector('#nube')){
      injectUI();
      client.auth.getSession().then(async({data:{session}})=>{
      if(session?.user){updateUI(session.user);return;}
      // Fallback: Supabase v2 CDN may not auto-read storage; restore manually
      try{
        const raw=localStorage.getItem('astor-remote-auth');
        if(raw){const s=JSON.parse(raw);if(s?.refresh_token){
          const {data:d}=await client.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});
          if(d?.session?.user)updateUI(d.session.user);
        }}
      }catch(e){}
    });
    }else{setTimeout(tryInject,400);}
  };
  tryInject();
  // Safety-net: if auth-in active but name empty, fill from astor-profile
  setTimeout(()=>{try{
    const un=document.getElementById('aUserName'),ue=document.getElementById('aUserEmail'),nb=document.querySelector('[data-section="nube"]');
    const p=JSON.parse(localStorage.getItem('astor-profile')||'{}');
    if(un&&!un.textContent&&p.name){un.textContent=p.name;if(ue)ue.textContent=p.email||'';}
    if(nb&&(!nb.textContent||nb.textContent==='☁ '||nb.textContent.includes('?'))&&p.name)nb.textContent='☁ '+p.name.split(' ')[0];
  }catch(ex){}},1200);
  client.auth.onAuthStateChange((_,session)=>{
    updateUI(session?.user||null);
    if(session?.user&&window.ASTOR_CLOUD?.init)window.ASTOR_CLOUD.init();
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();