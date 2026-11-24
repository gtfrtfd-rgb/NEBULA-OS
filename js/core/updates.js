import {$,esc} from './utils.js';
import {VERSION,RUNNING_BUILD,SERVER_BUILD} from './version.js';

/* Владает жизненным циклом обновлений и меткой текущей сборки.
   Перезагрузка предлагается ТОЛЬКО когда сборка на сервере действительно
   отличается от той, что исполняется в этой вкладке — одинаковых хешей
   в полосе обновления быть не может. */

const IS_DEV=RUNNING_BUILD.indexOf('__')===0;
const COMMIT=IS_DEV?'':RUNNING_BUILD;
const RELOAD_KEY='nebula.autoReloadAt';
let reg=null,bar=null,offered=false,checking=false,reloading=false,userAsked=false;
const watching=new WeakSet();

function paintLabels(){
  const sm=$('#smBuild');
  if(sm)sm.innerHTML=`<i></i><span>NEBULA OS ${esc(VERSION)} · ${esc(COMMIT?'сборка '+COMMIT:'локальная сборка')}</span>`;
  const boot=$('#bootSub');
  if(boot&&COMMIT&&!boot.textContent.includes(COMMIT))boot.textContent=boot.textContent+' · '+COMMIT;
}
function doReload(){
  if(reloading)return;
  reloading=true;
  try{sessionStorage.setItem(RELOAD_KEY,String(Date.now()));}catch(e){}
  location.reload();
}
function autoReload(){
  try{
    const t=+(sessionStorage.getItem(RELOAD_KEY)||0);
    if(Date.now()-t<12000)return;
  }catch(e){}
  doReload();
}
async function serverCommit(){
  try{
    const t=await (await fetch('index.html',{cache:'no-cache'})).text();
    const m=t.match(/name="nebula-build"\s+content="([^"]+)"/);
    const c=m?m[1].split('·')[0].trim():'';
    return c||SERVER_BUILD;
  }catch(e){return SERVER_BUILD;}
}
function dismiss(){
  document.documentElement.classList.remove('has-update');
  if(!bar)return;
  const b=bar;bar=null;
  b.classList.remove('on');
  setTimeout(()=>b.remove(),280);
}
async function offer(){
  if(offered||bar||checking||reloading||IS_DEV)return;
  checking=true;
  let next='';
  try{next=await serverCommit();}finally{checking=false;}
  /* ключевая проверка: нет разницы — нет полосы */
  if(!next||next===COMMIT||offered||bar||reloading)return;
  offered=true;
  bar=document.createElement('div');
  bar.id='updateBar';
  bar.setAttribute('role','status');
  bar.setAttribute('aria-live','polite');
  bar.innerHTML=`<span class="upd-ico">🛸</span>
    <div class="upd-txt"><b>Новая сборка готова</b><span>${esc(COMMIT)} → ${esc(next)}</span></div>
    <div class="upd-actions">
      <button class="btn primary sm upd-reload">Перезагрузить</button>
      <button class="btn sm upd-later">Позже</button>
    </div>`;
  document.body.appendChild(bar);
  document.documentElement.classList.add('has-update');
  requestAnimationFrame(()=>bar&&bar.classList.add('on'));
  $('.upd-reload',bar).addEventListener('click',()=>{
    userAsked=true;
    if(reg&&reg.waiting)reg.waiting.postMessage('SKIP_WAITING');
    else doReload();
  });
  $('.upd-later',bar).addEventListener('click',dismiss);
}
function watch(w){
  if(!w||watching.has(w))return;
  watching.add(w);
  w.addEventListener('statechange',()=>{
    if(w.state==='installed'&&navigator.serviceWorker.controller)offer();
  });
}

export const Updates={
  commit:COMMIT,
  running:RUNNING_BUILD,
  server:SERVER_BUILD,
  init(){
    paintLabels();
    if(!('serviceWorker' in navigator))return;
    navigator.serviceWorker.addEventListener('message',e=>{
      const d=e.data;
      if(!d)return;
      if(d.type==='NEBULA_SW_OUTDATED')autoReload();
      else if(d.type==='NEBULA_SW_READY'&&d.build&&COMMIT&&d.build!==COMMIT)offer();
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(userAsked)doReload();
      else offer();
    });
  },
  register(){
    if(!('serviceWorker' in navigator)||location.protocol!=='https:')return;
    navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(r=>{
      reg=r;
      if(r.waiting&&navigator.serviceWorker.controller)offer();
      watch(r.installing);
      r.addEventListener('updatefound',()=>watch(r.installing));
      const ping=()=>{r.update().catch(()=>{});};
      addEventListener('focus',ping);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)ping();});
      setInterval(ping,10*60*1000);
      /* страница могла остаться открытой через публикацию — сверяем сразу */
      offer();
    }).catch(()=>{});
  },
  check(){if(reg)return reg.update().catch(()=>{});return Promise.resolve();}
};