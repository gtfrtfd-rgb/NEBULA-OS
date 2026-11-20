import {$,$$,icon,esc,tileHtml,fmtBytes,fmtUp} from '../core/utils.js';
import {settings,setSetting,ACCENTS,WALL_NAMES} from '../core/settings.js';
import {bus} from '../core/bus.js';
import {store} from '../core/store.js';
import {session} from '../core/session.js';
import {Audio} from '../core/audio.js';
import {notify} from '../core/notifications.js';
import {confirmDlg} from '../core/dialogs.js';
import {VFS_KEY} from '../core/vfs.js';
import {paintScene,Wall} from '../core/wallpaper.js';
import {WM} from '../wm.js';

export default {name:'Настройки',icon:'sliders',g:['#8a93c9','#4a5382'],w:730,h:560,minW:480,minH:400,single:true,
mount(body,win,params){
  let section=params.section||'look';
  body.innerHTML=`<div class="set"><div class="set-nav"></div><div class="set-body"></div></div>`;
  const nav=$('.set-nav',body),sb=$('.set-body',body);
  const SECTIONS=[['look','brush','Оформление'],['sound','vol','Звук'],['system','cpu','Система'],['about','info','О системе']];
  function renderNav(){nav.innerHTML=SECTIONS.map(([id,i,n])=>`<button data-s="${id}" class="${id===section?'on':''}">${icon(i,16)}<span>${n}</span></button>`).join('');}
  nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b){section=b.dataset.s;render();}});
  function storageUsed(){let n=0;['nebula.settings.v1',VFS_KEY,'nebula.best.v1'].forEach(k=>{try{n+=(localStorage.getItem(k)||'').length*2;}catch(e){}});return n;}
  function render(){renderNav();
    if(section==='look'){
      sb.innerHTML=`<div class="set-h">Оформление</div><div class="set-sub">Сделайте космос своим — всё применяется мгновенно.</div>
      <div class="set-row"><div class="sr-t"><b>Акцент системы</b><span>Кнопки, окна, подсветка и терминал</span></div>
        <div class="acc-swatches">${Object.entries(ACCENTS).map(([k,a])=>`<button class="acc-sw ${settings.accent===k?'on':''}" data-a="${k}" style="background:linear-gradient(135deg,${a.c},${a.b})" title="${a.name}">${settings.accent===k?icon('check',15):''}</button>`).join('')}</div></div>
      <div class="set-row"><div class="sr-t"><b>Тема окон</b><span>Тёмная — родная для туманностей</span></div>
        <div class="seg theme-seg"><button data-t="dark" class="${settings.theme==='dark'?'on':''}">${icon('moon',13)} Тёмная</button><button data-t="light" class="${settings.theme==='light'?'on':''}">${icon('sun',13)} Светлая</button></div></div>
      <div style="padding:12px 0"><div class="sr-t" style="margin-bottom:10px"><b style="font-size:13px">Живые обои</b><span style="font-size:11.5px;color:var(--faint);display:block">Рендерятся на Canvas в реальном времени</span></div>
        <div class="wp-grid">${Object.entries(WALL_NAMES).map(([k,n])=>`<button class="wp-card ${settings.wallpaper===k?'on':''}" data-w="${k}"><canvas width="128" height="72"></canvas><span>${n}</span></button>`).join('')}</div></div>
      <div class="set-row"><div class="sr-t"><b>Анимации интерфейса</b><span>Полёты окон, каскады иконок, дрейф туманностей</span></div>
        <label class="tgl"><input type="checkbox" data-set="animations" ${settings.animations?'checked':''}><i></i></label></div>`;
      $$('.acc-sw',sb).forEach(b=>b.addEventListener('click',()=>{setSetting('accent',b.dataset.a);render();}));
      $$('.theme-seg button',sb).forEach(b=>b.addEventListener('click',()=>{setSetting('theme',b.dataset.t);render();}));
      $$('.wp-card',sb).forEach(c=>{const x=$('canvas',c).getContext('2d');
        const stars=Array.from({length:40},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.2+.3,ph:Math.random()*7,sp:1}));
        paintScene(x,128,72,c.dataset.w,5,stars,Wall.blobs);
        c.addEventListener('click',()=>{setSetting('wallpaper',c.dataset.w);render();});});
      $('[data-set="animations"]',sb).addEventListener('change',e=>setSetting('animations',e.target.checked));
    }
    else if(section==='sound'){
      sb.innerHTML=`<div class="set-h">Звук</div><div class="set-sub">Система звучит: загрузка, окна, уведомления и генеративная музыка.</div>
      <div class="set-row"><div class="sr-t"><b>Звук системы</b><span>Главный выключатель — глушит вообще всё</span></div>
        <label class="tgl"><input type="checkbox" data-set="sound" ${settings.sound?'checked':''}><i></i></label></div>
      <div class="set-row"><div class="sr-t"><b>Громкость</b><span class="vol-label">${settings.volume}%</span></div>
        <input type="range" class="vol-range" min="0" max="100" value="${settings.volume}" style="width:170px"></div>
      <div class="set-row"><div class="sr-t"><b>Звуки интерфейса</b><span>Щелчки, открытие окон, клавиши</span></div>
        <label class="tgl"><input type="checkbox" data-set="uiSounds" ${settings.uiSounds?'checked':''}><i></i></label></div>
      <div class="set-row"><div class="sr-t"><b>Громкость Волны FM</b><span>Отдельный канал генеративного эфира</span></div>
        <input type="range" class="mvol-range" min="0" max="100" value="${settings.musicVol}" style="width:170px"></div>
      <div style="padding:14px 0"><button class="btn test-snd">${icon('vol',14)} Проверить звук</button></div>`;
      $('[data-set="sound"]',sb).addEventListener('change',e=>setSetting('sound',e.target.checked));
      $('[data-set="uiSounds"]',sb).addEventListener('change',e=>setSetting('uiSounds',e.target.checked));
      const vr=$('.vol-range',sb);const upd=()=>vr.style.setProperty('--val',vr.value+'%');upd();
      vr.addEventListener('input',()=>{setSetting('volume',+vr.value);$('.vol-label',sb).textContent=vr.value+'%';upd();});
      const mr=$('.mvol-range',sb);const upd2=()=>mr.style.setProperty('--val',mr.value+'%');upd2();
      mr.addEventListener('input',()=>{setSetting('musicVol',+mr.value);Audio.setMusicVol(+mr.value);upd2();});
      $('.test-snd',sb).addEventListener('click',()=>{Audio.init();Audio.resume();Audio.sfx('chime');});
    }
    else if(section==='system'){
      const used=storageUsed(),quota=5*1024*1024;
      sb.innerHTML=`<div class="set-h">Система</div><div class="set-sub">Ресурсы, качество и обслуживание.</div>
      <div class="set-row"><div class="sr-t"><b>Имя пользователя</b><span>Отображается на экране входа и в терминале</span></div>
        <input class="inp user-inp" value="${esc(settings.username)}" maxlength="24" style="width:170px"></div>
      <div class="set-row"><div class="sr-t"><b>Качество рендера</b><span>Экономный режим отключает стекло и снижает разрешение обоев</span></div>
        <select class="sel q-sel"><option value="high">Высокое</option><option value="med">Среднее</option><option value="eco">Экономное</option></select></div>
      <div style="padding:14px 0;border-bottom:1px solid var(--border)">
        <div class="sr-t"><b style="font-size:13px">Хранилище nebulaFS</b><span style="font-size:11.5px;color:var(--faint)">${fmtBytes(used)} из ~5 МБ · файлы, настройки, рекорды</span></div>
        <div class="storage-bar"><i style="width:${clamp(used/quota*100,1,100)}%"></i></div></div>
      <div style="padding:16px 0;display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn open-mon">${icon('activity',14)} Монитор системы</button>
        <button class="btn danger reset-os">${icon('alert',14)} Сбросить NEBULA OS</button></div>`;
      $('.q-sel',sb).value=settings.quality;
      $('.q-sel',sb).addEventListener('change',e=>setSetting('quality',e.target.value));
      $('.user-inp',sb).addEventListener('change',e=>{const v=e.target.value.trim()||'Космонавт';setSetting('username',v);notify('success','Имя обновлено',`Теперь вы — ${v}.`);});
      $('.open-mon',sb).addEventListener('click',()=>WM.open('monitor'));
      $('.reset-os',sb).addEventListener('click',async()=>{
        const yes=await confirmDlg({title:'Сбросить систему?',msg:'Все файлы, рисунки, настройки и рекорды будут удалены безвозвратно. NEBULA перезагрузится с заводским содержимым.',ok:'Стереть всё',danger:true});
        if(yes){['nebula.settings.v1',VFS_KEY,'nebula.best.v1'].forEach(store.del);location.reload();}});
    }
    else{
      sb.innerHTML=`<div class="set-h">О системе</div><div class="set-sub">Паспорт космического аппарата.</div>
      <div class="about-logo">${tileHtml({icon:'logo',g:['#7c6bff','#22d3ee']},58)}<div><b>NEBULA OS</b><span>Версия 1.0 «Пульсар» · сборка 2026.11.19</span></div></div>
      <dl class="about-grid">
        <dt>Ядро</dt><dd>6.2.0-nebula</dd>
        <dt>Оболочка</dt><dd>NebulaShell 1.0</dd>
        <dt>Движок</dt><dd>Vanilla JS · Canvas 2D · Web Audio</dd>
        <dt>Файловая система</dt><dd>nebulaFS (localStorage)</dd>
        <dt>Экран</dt><dd>${innerWidth} × ${innerHeight}</dd>
        <dt>Платформа</dt><dd>${esc(navigator.userAgentData?.platform||navigator.platform||'космос')}</dd>
        <dt>Аптайм</dt><dd class="about-up">${fmtUp((Date.now()-session.bootTime)/1000)}</dd></dl>
      <button class="btn primary upd-btn">${icon('zap',14)} Проверить обновления</button>
      <p style="font-size:11.5px;color:var(--faint);margin-top:16px;line-height:1.6">Сделано с любовью к космосу ✦<br>Каждая нота Волны FM синтезируется заново — записей не существует.</p>`;
      $('.upd-btn',sb).addEventListener('click',e=>{const b=e.currentTarget;b.disabled=true;b.innerHTML=`<span class="spin">${icon('restart',14)}</span> Проверка…`;
        setTimeout(()=>{b.disabled=false;b.innerHTML=icon('zap',14)+' Проверить обновления';notify('success','Обновления','У вас последняя версия — Звёздный совет одобряет. ✨');},1500);});
    }}
  const off=bus.on('settings',k=>{
    if(k==='volume'){const r=$('.vol-range',sb);if(r){r.value=settings.volume;r.style.setProperty('--val',r.value+'%');$('.vol-label',sb)?.replaceChildren(settings.volume+'%');}}
    if(k==='sound'){const t=$('[data-set="sound"]',sb);if(t)t.checked=settings.sound;}
    if(k==='musicVol'){const r=$('.mvol-range',sb);if(r){r.value=settings.musicVol;r.style.setProperty('--val',r.value+'%');}}});
  render();
  return{onClose:off,remount(p){if(p.section){section=p.section;render();}}};
}};