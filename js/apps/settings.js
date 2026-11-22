import {$,$$,esc,fmtBytes,fmtUp,clamp} from '../core/utils.js';
import {icon,tileHtml} from '../core/icons.js';
import {settings,setSetting,ACCENTS,WALL_NAMES} from '../core/settings.js';
import {bus} from '../core/bus.js';
import {store} from '../core/store.js';
import {session} from '../core/session.js';
import {Audio} from '../core/audio.js';
import {notify} from '../core/notifications.js';
import {confirmDlg} from '../core/dialogs.js';
import {storageInfo,requestPersist,wipeVfs} from '../core/vfs.js';
import {paintScene,Wall} from '../core/wallpaper.js';
import {WM} from '../wm.js';
import {BUILD_LINE,KERNEL} from '../core/version.js';

export default {name:'Настройки',icon:'sliders',g:['#8a93c9','#4a5382'],w:730,h:560,minW:480,minH:400,single:true,
mount(body,win,params){
  let section=params.section||'look',stTimer=null;
  body.innerHTML=`<div class="set"><div class="set-nav"></div><div class="set-body"></div></div>`;
  const nav=$('.set-nav',body),sb=$('.set-body',body);
  const SECTIONS=[['look','brush','Оформление'],['sound','vol','Звук'],['system','cpu','Система'],['about','info','О системе']];
  function renderNav(){nav.innerHTML=SECTIONS.map(([id,i,n])=>`<button data-s="${id}" class="${id===section?'on':''}">${icon(i,16)}<span>${n}</span></button>`).join('');}
  nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b){section=b.dataset.s;render();}});

  function paintStorage(s){
    if(!$('.st-used',sb))return;
    const used=s.usage||s.treeSize;
    $('.st-used',sb).textContent=fmtBytes(used);
    $('.st-mode',sb).textContent=s.mode==='indexeddb'?'IndexedDB':'память';
    $('.st-bar',sb).style.width=(s.quota?clamp(used/s.quota*100,1,100):1)+'%';
    $('.st-meta',sb).innerHTML=
      `<span>Квота <b>${s.quota?fmtBytes(s.quota):'—'}</b></span>`+
      `<span>Файлы <b>${fmtBytes(s.treeSize)}</b></span>`+
      `<span>Узлов <b>${s.nodes}</b></span>`+
      `<span>Постоянное <b style="color:${s.persisted?'var(--green)':'var(--amber)'}">${s.persisted?'да':'нет'}</b></span>`;
    const pb=$('.st-persist',sb);
    pb.disabled=s.persisted||s.mode!=='indexeddb';
    pb.innerHTML=s.persisted?icon('check',13)+' Хранилище постоянно':icon('lock',13)+' Сделать постоянным';
  }
  function refreshStorage(){
    storageInfo().then(s=>{if(sb.isConnected&&!win.closing)paintStorage(s);}).catch(()=>{});
  }
  function queueStorage(){clearTimeout(stTimer);stTimer=setTimeout(()=>{if(!win.closing&&!win.minimized)refreshStorage();},400);}

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
      sb.innerHTML=`<div class="set-h">Система</div><div class="set-sub">Ресурсы, качество и обслуживание.</div>
      <div class="set-row"><div class="sr-t"><b>Имя пользователя</b><span>Отображается на экране входа и в терминале</span></div>
        <input class="inp user-inp" value="${esc(settings.username)}" maxlength="24" style="width:170px"></div>
      <div class="set-row"><div class="sr-t"><b>Качество рендера</b><span>Экономный режим: 30 FPS, меньше звёзд, без стекла</span></div>
        <select class="sel q-sel"><option value="high">Высокое</option><option value="med">Среднее</option><option value="eco">Экономное</option></select></div>
      <div class="mon-card" style="margin:14px 0">
        <div class="mc-l"><span>Хранилище nebulaFS</span><span class="st-mode">…</span></div>
        <div class="mc-v st-used">…</div>
        <div class="storage-bar"><i class="st-bar" style="width:1%"></i></div>
        <div class="mon-meta st-meta"><span>запрос к IndexedDB…</span></div>
        <div style="display:flex;gap:8px;margin-top:11px;flex-wrap:wrap">
          <button class="btn sm st-refresh">${icon('restart',13)} Обновить</button>
          <button class="btn sm st-persist">${icon('lock',13)} Сделать постоянным</button>
        </div>
        <p style="font-size:11px;color:var(--faint);margin-top:10px;line-height:1.55">Файлы хранятся в IndexedDB — квота зависит от свободного места на диске (обычно десятки гигабайт). Постоянное хранилище запрещает браузеру вытеснять данные при нехватке места.</p>
      </div>
      <div style="padding:4px 0 16px;display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn open-mon">${icon('activity',14)} Монитор системы</button>
        <button class="btn danger reset-os">${icon('alert',14)} Сбросить NEBULA OS</button></div>`;
      $('.q-sel',sb).value=settings.quality;
      $('.q-sel',sb).addEventListener('change',e=>setSetting('quality',e.target.value));
      $('.user-inp',sb).addEventListener('change',e=>{const v=e.target.value.trim()||'Космонавт';setSetting('username',v);notify('success','Имя обновлено',`Теперь вы — ${v}.`);});
      $('.open-mon',sb).addEventListener('click',()=>WM.open('monitor'));
      $('.st-refresh',sb).addEventListener('click',refreshStorage);
      $('.st-persist',sb).addEventListener('click',async e=>{
        const b=e.currentTarget;b.disabled=true;b.innerHTML=`<span class="spin">${icon('restart',13)}</span> Запрос…`;
        const ok=await requestPersist();
        notify(ok?'success':'warn','Постоянное хранилище',ok?'Браузер больше не вытеснит файлы NEBULA OS.':'Браузер отклонил запрос. Данные всё равно сохранятся, но могут быть вытеснены при нехватке места.');
        refreshStorage();});
      $('.reset-os',sb).addEventListener('click',async()=>{
        const yes=await confirmDlg({title:'Сбросить систему?',msg:'Все файлы, рисунки, настройки и рекорды будут удалены безвозвратно. База IndexedDB будет очищена, NEBULA перезагрузится с заводским содержимым.',ok:'Стереть всё',danger:true});
        if(yes){try{await wipeVfs();}catch(e){}
          store.del('nebula.settings.v1');store.del('nebula.best.v1');location.reload();}});
      refreshStorage();
    }
    else{
      sb.innerHTML=`<div class="set-h">О системе</div><div class="set-sub">Паспорт космического аппарата.</div>
      <div class="about-logo">${tileHtml({icon:'logo',g:['#7c6bff','#22d3ee']},58)}<div><b>NEBULA OS</b><span>${BUILD_LINE}</span></div></div>
      <dl class="about-grid">
        <dt>Ядро</dt><dd>${KERNEL}</dd>
        <dt>Оболочка</dt><dd>NebulaShell 1.0</dd>
        <dt>Движок</dt><dd>Vanilla JS · Canvas 2D · Web Audio</dd>
        <dt>Файловая система</dt><dd>nebulaFS (IndexedDB)</dd>
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
  const offVfs=bus.on('vfs',()=>{if(section==='system')queueStorage();});
  render();
  return{onClose(){off();offVfs();clearTimeout(stTimer);},remount(p){if(p.section){section=p.section;render();}}};
}};