import {$,$$,esc,fmtClock,fmtUp,isCoarse,clamp,relTime} from './core/utils.js';
import {icon,tileHtml,batteryIcon} from './core/icons.js';
import {settings,setSetting,WALL_NAMES} from './core/settings.js';
import {bus} from './core/bus.js';
import {session} from './core/session.js';
import {Audio} from './core/audio.js';
import {Music} from './core/music.js';
import {notifications,notify,markNotificationsRead} from './core/notifications.js';
import {openContext,closeContext} from './core/context.js';
import {dialogOpen,cancelDialog} from './core/dialogs.js';
import {openFileNode} from './core/launch.js';
import {nodeAt,addNode,mkText,recentFiles,searchFiles,parentPath} from './core/vfs.js';
import {WM} from './wm.js';
import {Apps} from './apps/index.js';
import {login,lockScreen,powerAction,showLock,bootSequence} from './boot.js';

const PINNED=['explorer','terminal','editor','calc','paint','music','game','settings'];
const DESKTOP_APPS=['explorer','terminal','editor','paint','game','music','help'];
let popState=null,calOffset=0,smKbd=-1,tickN=0;
let wifi={on:true,net:'Nebula-5G',connecting:null};
let battery={level:.86,charging:false,real:false};
let lastTap={app:null,t:0};

export function startOpen(){return $('#startMenu').classList.contains('open');}
function syncUser(){$('#smName').textContent=settings.username;$('#lockName').textContent=settings.username;}
function renderDock(){
  const box=$('#dockApps');const wins=[...WM.wins.values()].filter(w=>!w.closing);
  let html='';
  PINNED.forEach(a=>{const ws=wins.filter(w=>w.app===a);
    if(!ws.length)html+=`<button class="dock-app" data-app="${a}" title="${Apps[a].name}">${tileHtml(Apps[a],34)}</button>`;
    else ws.forEach(w=>{html+=`<button class="dock-app running ${WM.focusedId===w.id&&!w.minimized?'active':''} ${w.minimized?'minimized':''}" data-win="${w.id}" title="${esc(w.title||Apps[a].name)}">${tileHtml(Apps[a],34)}</button>`;});});
  const extra=wins.filter(w=>!PINNED.includes(w.app));
  if(extra.length){html+='<div class="tb-sep"></div>';extra.forEach(w=>{html+=`<button class="dock-app running ${WM.focusedId===w.id&&!w.minimized?'active':''} ${w.minimized?'minimized':''}" data-win="${w.id}" title="${esc(w.title||Apps[w.app].name)}">${tileHtml(Apps[w.app],34)}</button>`;});}
  box.innerHTML=html;
}
function renderDesktop(){
  $('#desktopIcons').innerHTML=DESKTOP_APPS.map((a,i)=>
    `<button class="dicon" data-app="${a}" title="${Apps[a].name} — двойной клик" style="--i:${i}">${tileHtml(Apps[a],54)}<span>${Apps[a].name}</span></button>`).join('');
}
function launchFromIcon(btn,app){
  const t=$('.tile',btn);
  if(t){t.classList.remove('launching');void t.offsetWidth;t.classList.add('launching');setTimeout(()=>t.classList.remove('launching'),460);}
  WM.open(app);
}
function activateIcon(btn,viaKeyboard){
  const app=btn.dataset.app;if(!Apps[app])return;
  $$('.dicon').forEach(x=>x.classList.toggle('sel',x===btn));
  const now=performance.now();
  const doubled=lastTap.app===app&&now-lastTap.t<500;
  lastTap={app,t:now};
  if(viaKeyboard||isCoarse||doubled){lastTap={app:null,t:0};launchFromIcon(btn,app);}
}
function refreshDesktopAnim(){document.body.classList.remove('entered');void document.body.offsetWidth;document.body.classList.add('entered');Audio.sfx('tick');}
function syncSoundUI(){
  const on=settings.sound;
  const w=$('#wSound');w.innerHTML=icon(on?'vol':'volx',13)+`<span>Звук ${on?'вкл':'выкл'}</span>`;w.classList.toggle('muted',!on);w.title=on?'Отключить весь звук':'Включить звук';
  syncQuickIcon();
}
function syncQuickIcon(){$('#trayQuick').innerHTML=icon(wifi.on?'wifi':'wifioff',17)+batteryIcon(battery.level,battery.charging)+icon(settings.sound?'vol':'volx',17);}
function syncWifiUI(){$('#wWifi').innerHTML=icon(wifi.on?'wifi':'wifioff',13)+`<span>${wifi.on?esc(wifi.net):'нет сети'}</span>`;syncQuickIcon();}
function syncTrayMusic(){
  const chip=$('#trayMusic');const active=Music.playing||Music.elapsed()>0;
  chip.classList.toggle('on',active);chip.classList.toggle('playing',Music.playing);
  $('.tm-name',chip).textContent=Music.presets[Music.preset].name;
  $('#tmPlay').innerHTML=icon(Music.playing?'pause':'play',14);
  $('#tmStop').innerHTML=icon('x',13);
}
function toggleSound(){setSetting('sound',!settings.sound);Audio.init();Audio.resume();if(settings.sound)Audio.sfx('tick');}

function openStart(focus=false){
  closePopover();closeContext();
  $('#startMenu').classList.add('open');$('#startBtn').classList.add('on');
  $('#smSearch').value='';renderStart('');smKbd=-1;
  if(focus)setTimeout(()=>$('#smSearch').focus(),120);
}
export function closeStart(){$('#startMenu').classList.remove('open');$('#startBtn').classList.remove('on');}
function renderStart(q){
  const body=$('#smBody');q=q.trim().toLowerCase();
  if(!q){
    const rec=recentFiles(4);
    body.innerHTML=`<div class="sm-label">Приложения</div>
    <div class="sm-grid">${Object.entries(Apps).map(([id,a])=>`<button class="sm-tile" data-app="${id}">${tileHtml(a,50)}<span>${a.name}</span></button>`).join('')}</div>
    <div class="sm-label">Недавние файлы</div>
    ${rec.length?rec.map(r=>`<button class="sm-file" data-path="${esc(r.path)}">
      <span class="fi" style="background:linear-gradient(135deg,${r.node.type==='image'?'#a3e635,#22d3ee':'#4f8dff,#7c6bff'})">${icon(r.node.type==='image'?'image':'file',16)}</span>
      <span class="ft"><b>${esc(r.node.name)}</b><span>${esc(parentPath(r.path)||'/')}</span></span><time>${relTime(r.node.mtime)}</time></button>`).join(''):'<div class="sm-empty">Пока пусто — создайте что-нибудь ✦</div>'}`;
  }else{
    const apps=Object.entries(Apps).filter(([id,a])=>a.name.toLowerCase().includes(q));
    const files=searchFiles(q);
    body.innerHTML=(apps.length?`<div class="sm-label">Приложения</div><div class="sm-grid">${apps.map(([id,a])=>`<button class="sm-tile" data-app="${id}">${tileHtml(a,50)}<span>${a.name}</span></button>`).join('')}</div>`:'')
    +(files.length?`<div class="sm-label">Файлы</div>${files.map(r=>`<button class="sm-file" data-path="${esc(r.path)}"><span class="fi" style="background:linear-gradient(135deg,#4f8dff,#7c6bff)">${icon(r.node.type==='image'?'image':'file',16)}</span><span class="ft"><b>${esc(r.node.name)}</b><span>${esc(parentPath(r.path)||'/')}</span></span></button>`).join('')}`:'')
    ||'<div class="sm-empty">🔭 Ничего не найдено в этой галактике</div>';
  }
}
function smItems(){return $$('#smBody .sm-tile, #smBody .sm-file');}

function openPopover(type){
  if(popState===type){closePopover();return;}
  closeStart();closeContext();popState=type;
  if(type==='notif')markNotificationsRead();
  renderPopover();$('#popover').classList.add('open');
}
export function closePopover(){popState=null;$('#popover').classList.remove('open');}
function renderPopover(){
  const p=$('#popover');if(!popState)return;
  if(popState==='quick'){
    p.innerHTML=`<div class="pop-title"><span>Быстрые настройки</span><button class="ibtn q-theme" title="Сменить тему">${icon(settings.theme==='dark'?'sun':'moon',15)}</button></div>
    <div class="qrow"><span class="qi">${icon(wifi.on?'wifi':'wifioff',17)}</span><div class="qt"><b>Wi-Fi</b><span>${wifi.on?esc(wifi.net):'отключено'}</span></div>
      <label class="tgl"><input type="checkbox" class="q-wifi" ${wifi.on?'checked':''}><i></i></label></div>
    ${wifi.on?`<div style="padding:2px 4px 8px">${['Nebula-5G','Stardust_2.4','ORBITAL-GUEST'].map(n=>`<button class="net-item ${wifi.net===n?'cur':''}" data-net="${n}">${wifi.net===n?icon('check',14):icon('wifi',14)}<span>${n}</span>${n!=='Nebula-5G'?`<span class="lock">${icon('lock',12)}</span>`:''}</button>`).join('')}</div>`:''}
    <div class="qrow"><button class="qi q-mute" style="border:0;cursor:pointer" title="Звук вкл/выкл">${icon(settings.sound?'vol':'volx',17)}</button>
      <div class="qt"><b>Громкость</b><input type="range" class="q-vol" min="0" max="100" value="${settings.volume}" style="width:100%;margin-top:4px"></div>
      <span style="font-size:11px;font-weight:800;color:var(--dim);width:34px;text-align:right">${settings.volume}%</span></div>
    <div class="qrow"><span class="qi">${batteryIcon(battery.level,battery.charging)}</span><div class="qt"><b>Батарея — ${Math.round(battery.level*100)}%</b><span>${battery.charging?'заряжается':battery.real?'от батареи':'симметрия космоса · разряд идёт'}</span></div></div>
    <div style="padding-top:8px;border-top:1px solid var(--border);margin-top:6px"><button class="btn q-all" style="width:100%">${icon('sliders',14)} Все настройки</button></div>`;
    $('.q-theme',p).addEventListener('click',()=>{setSetting('theme',settings.theme==='dark'?'light':'dark');renderPopover();});
    $('.q-wifi',p).addEventListener('change',e=>{wifi.on=e.target.checked;if(!wifi.on)wifi.net='Nebula-5G';syncWifiUI();renderPopover();notify(wifi.on?'success':'warn','Wi-Fi',wifi.on?`Подключено к ${wifi.net}.`:'Беспроводная связь отключена. Космос молчит.');});
    $$('.net-item',p).forEach(b=>b.addEventListener('click',()=>{
      if(wifi.connecting===b.dataset.net||wifi.net===b.dataset.net)return;
      wifi.connecting=b.dataset.net;b.innerHTML=`<span class="spin">${icon('restart',14)}</span><span>${b.dataset.net}</span><span class="lock">подключение…</span>`;
      setTimeout(()=>{wifi.net=b.dataset.net;wifi.connecting=null;syncWifiUI();if(popState==='quick')renderPopover();notify('success','Wi-Fi',`Подключено к ${wifi.net}. Скорость: сверхсветовая.`);},1200);}));
    const qv=$('.q-vol',p);qv.style.setProperty('--val',qv.value+'%');
    qv.addEventListener('input',()=>{setSetting('volume',+qv.value);qv.style.setProperty('--val',qv.value+'%');qv.closest('.qrow').lastElementChild.textContent=qv.value+'%';});
    $('.q-mute',p).addEventListener('click',()=>{toggleSound();renderPopover();});
    $('.q-all',p).addEventListener('click',()=>{closePopover();WM.open('settings');});
  }
  else if(popState==='calendar'){
    const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()+calOffset,1);
    const first=(d.getDay()+6)%7,days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),prevDays=new Date(d.getFullYear(),d.getMonth(),0).getDate();
    let cellsHtml='';
    for(let i=0;i<42;i++){const dayNum=i-first+1;
      let cls='cal-day',n;
      if(dayNum<1){cls+=' out';n=prevDays+dayNum;}
      else if(dayNum>days){cls+=' out';n=dayNum-days;}
      else{n=dayNum;if(calOffset===0&&dayNum===now.getDate())cls+=' today';}
      cellsHtml+=`<span class="${cls}">${n}</span>`;}
    p.innerHTML=`<div class="pop-title"><span>Календарь</span></div>
    <div class="cal-head"><b>${d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'})}</b>
      <button class="ibtn cal-today" title="Сегодня">${icon('clock',14)}</button>
      <button class="ibtn cal-prev">${icon('chevL',15)}</button><button class="ibtn cal-next">${icon('chevR',15)}</button></div>
    <div class="cal-grid">${['пн','вт','ср','чт','пт','сб','вс'].map(x=>`<span class="cal-dow">${x}</span>`).join('')}${cellsHtml}</div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:12px;color:var(--dim);font-weight:600">${now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · звёздное время синхронизировано</div>`;
    $('.cal-prev',p).addEventListener('click',()=>{calOffset--;renderPopover();});
    $('.cal-next',p).addEventListener('click',()=>{calOffset++;renderPopover();});
    $('.cal-today',p).addEventListener('click',()=>{calOffset=0;renderPopover();});
  }
  else if(popState==='notif'){
    p.innerHTML=`<div class="pop-title"><span>Центр уведомлений</span>${notifications.length?'<button class="ibtn n-clear" title="Очистить всё">'+icon('trash',14)+'</button>':''}</div>
    ${notifications.length?notifications.map(n=>`<div class="notif-item">
      <span class="ni ${n.type}">${icon({info:'info',success:'check',warn:'alert',error:'x'}[n.type]||'info',15)}</span>
      <div class="nt"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><time>${relTime(n.time)}</time>
      ${n.action?`<div><button class="notif-act" data-id="${n.id}">${esc(n.action.label)}</button></div>`:''}</div></div>`).join('')
    :'<div class="sm-empty">✨ Тишина в эфире.<br>Уведомления появятся здесь.</div>'}`;
    $('.n-clear',p)?.addEventListener('click',()=>{notifications.length=0;renderPopover();});
    $$('.notif-act',p).forEach(b=>b.addEventListener('click',()=>{const n=notifications.find(x=>x.id===b.dataset.id);
      if(n&&n.action){try{n.action.fn();}catch(e){}n.action=null;renderPopover();}}));
  }
}

export function tickClock(){
  const now=new Date();
  const t=fmtClock(now);
  $('#tbTime').textContent=t;
  $('#tbDate').textContent=now.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
  $('#wTime').textContent=t;
  $('#wDate').textContent=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
  $('#wUptime').innerHTML=icon('zap',12)+`<span>${fmtUp((Date.now()-session.bootTime)/1000)}</span>`;
  if(!session.loggedIn){$('#lockTime').textContent=t;$('#lockDate').textContent=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});}
  tickN++;
  if(!battery.real&&tickN%45===0){battery.level=Math.max(.05,battery.level-.001);syncQuickIcon();if(popState==='quick')renderPopover();}
}

export function initShell(){
  $('#startBtn').innerHTML=icon('logo',24);
  $('#searchPill').innerHTML=icon('search',14)+'<span>Поиск приложений…</span>';
  $('#smSettings').innerHTML=icon('sliders',16);
  $('#smSearchIcon').innerHTML=icon('search',15);
  $('#smLock').innerHTML=icon('lock',14)+'<span>Блокировка</span>';
  $('#smRestart').innerHTML=icon('restart',14)+'<span>Перезагрузка</span>';
  $('#smShutdown').innerHTML=icon('power',14)+'<span>Выключение</span>';
  $('#lockRestart').innerHTML=icon('restart',17);
  $('#lockShutdown').innerHTML=icon('power',17);
  $('#powerOn').innerHTML=icon('power',34);
  $('#loginBtn').innerHTML='Войти в систему '+icon('chevR',16);
  $('#trayBell').insertAdjacentHTML('afterbegin',icon('bell',17));
  renderDesktop();renderDock();syncUser();syncSoundUI();syncWifiUI();syncTrayMusic();tickClock();
  setInterval(tickClock,1000);
  if(navigator.getBattery){navigator.getBattery().then(b=>{battery.real=true;
    const upd=()=>{battery.level=b.level;battery.charging=b.charging;syncQuickIcon();if(popState==='quick')renderPopover();};
    upd();b.addEventListener('levelchange',upd);b.addEventListener('chargingchange',upd);}).catch(()=>{});}

  /* иконки рабочего стола: клик — выбор, двойной клик / Enter / тап — запуск */
  $('#desktopIcons').addEventListener('click',e=>{
    const b=e.target.closest('.dicon');if(!b)return;
    activateIcon(b,e.detail===0);});
  $('#desktopIcons').addEventListener('keydown',e=>{
    const b=e.target.closest('.dicon');if(!b)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();lastTap={app:null,t:0};launchFromIcon(b,b.dataset.app);}});
  $('#desktop').addEventListener('pointerdown',e=>{
    if(!e.target.closest('.dicon,.wchip')){$$('.dicon').forEach(x=>x.classList.remove('sel'));lastTap={app:null,t:0};}});
  $('#desktop').addEventListener('contextmenu',e=>{
    if(e.target.closest('.wchip'))return;
    const onIcon=e.target.closest('.dicon');
    if(onIcon){
      const a=onIcon.dataset.app;
      openContext(e.clientX,e.clientY,[
        {icon:Apps[a].icon,label:'Открыть '+Apps[a].name,fn:()=>launchFromIcon(onIcon,a)},
        {icon:'square',label:'Открыть развёрнутым',fn:()=>{const w=WM.open(a);if(w&&!isMobileNow())WM.setState(w,'max');}},'sep',
        {icon:'restart',label:'Обновить рабочий стол',fn:refreshDesktopAnim}]);
      return;}
    openContext(e.clientX,e.clientY,[
      {icon:'fileplus',label:'Новая заметка',fn:()=>WM.open('editor')},
      {icon:'image',label:'Сменить обои',fn:()=>{const keys=Object.keys(WALL_NAMES);const next=keys[(keys.indexOf(settings.wallpaper)+1)%keys.length];setSetting('wallpaper',next);notify('info','Обои',`Теперь: ${WALL_NAMES[next]}.`);}},
      {icon:'restart',label:'Обновить',fn:refreshDesktopAnim},'sep',
      {icon:'terminal',label:'Открыть терминал',kbd:'Ctrl+Alt+T',fn:()=>WM.open('terminal')},
      {icon:'activity',label:'Монитор системы',fn:()=>WM.open('monitor')},
      {icon:'sliders',label:'Параметры экрана',fn:()=>WM.open('settings',{section:'look'})},'sep',
      {icon:'help',label:'О системе',fn:()=>WM.open('help')}]);});
  $('#wSound').addEventListener('click',toggleSound);

  $('#startBtn').addEventListener('click',()=>startOpen()?closeStart():openStart(true));
  $('#searchPill').addEventListener('click',()=>openStart(true));
  $('#dockApps').addEventListener('click',e=>{
    const b=e.target.closest('.dock-app');if(!b)return;
    if(b.dataset.win){const w=WM.wins.get(b.dataset.win);if(!w)return;
      if(w.minimized)WM.restore(w);
      else if(WM.focusedId===w.id)WM.minimize(w);
      else WM.focus(w);}
    else WM.open(b.dataset.app);});
  $('#dockApps').addEventListener('contextmenu',e=>{
    const b=e.target.closest('.dock-app');if(!b)return;e.preventDefault();
    if(b.dataset.win){const w=WM.wins.get(b.dataset.win);if(!w)return;
      openContext(e.clientX,e.clientY,[
        {icon:w.minimized?'restore':'eye',label:w.minimized?'Развернуть':'Показать',fn:()=>{if(w.minimized)WM.restore(w);WM.focus(w);}},
        {icon:'minus',label:'Свернуть',dis:w.minimized,fn:()=>WM.minimize(w)},
        {icon:w.state==='normal'?'square':'restore',label:w.state==='normal'?'Развернуть на весь экран':'Восстановить размер',fn:()=>WM.toggleMax(w)},'sep',
        {icon:'x',label:'Закрыть',danger:true,fn:()=>WM.close(w)}]);}
    else openContext(e.clientX,e.clientY,[{icon:Apps[b.dataset.app].icon,label:'Открыть '+Apps[b.dataset.app].name,fn:()=>WM.open(b.dataset.app)}]);});
  $('#taskbar').addEventListener('contextmenu',e=>{
    if(e.target.closest('.dock-app,.tray-btn,#startBtn'))return;
    openContext(e.clientX,e.clientY,[
      {icon:'minus',label:'Показать рабочий стол',fn:()=>$('#showDesktop').click()},
      {icon:'activity',label:'Монитор системы',fn:()=>WM.open('monitor')}]);});
  $('#trayQuick').addEventListener('click',()=>openPopover('quick'));
  $('#trayBell').addEventListener('click',()=>openPopover('notif'));
  $('#trayClock').addEventListener('click',()=>{calOffset=0;openPopover('calendar');});
  $('#showDesktop').addEventListener('click',()=>{
    const ws=[...WM.wins.values()].filter(w=>!w.closing);
    const anyVisible=ws.some(w=>!w.minimized);
    ws.forEach(w=>anyVisible?WM.minimize(w):WM.restore(w));});
  $('#tmPlay').addEventListener('click',()=>Music.toggle());
  $('#tmStop').addEventListener('click',()=>Music.stop());
  Music.sub(syncTrayMusic);

  $('#smSearch').addEventListener('input',e=>{renderStart(e.target.value);smKbd=-1;});
  $('#smSearch').addEventListener('keydown',e=>{
    const items=smItems();
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!items.length)return;
      smKbd=e.key==='ArrowDown'?(smKbd+1)%items.length:(smKbd-1+items.length)%items.length;
      items.forEach((x,i)=>x.classList.toggle('kbd',i===smKbd));items[smKbd].scrollIntoView({block:'nearest'});}
    else if(e.key==='Enter'){e.preventDefault();const it=items[smKbd>=0?smKbd:0];if(it)it.click();}});
  $('#smBody').addEventListener('click',e=>{
    const a=e.target.closest('[data-app]');
    if(a){closeStart();WM.open(a.dataset.app);return;}
    const f=e.target.closest('[data-path]');
    if(f){const p=f.dataset.path,n=nodeAt(p);closeStart();if(n)openFileNode(n,p);}});
  $('#smSettings').addEventListener('click',()=>{closeStart();WM.open('settings');});
  $('#smLock').addEventListener('click',lockScreen);
  $('#smRestart').addEventListener('click',()=>powerAction('restart'));
  $('#smShutdown').addEventListener('click',()=>powerAction('shutdown'));
  $('#loginBtn').addEventListener('click',login);
  $('#lockRestart').addEventListener('click',()=>powerAction('restart'));
  $('#lockShutdown').addEventListener('click',()=>powerAction('shutdown'));
  $('#powerOn').addEventListener('click',()=>{Audio.init();Audio.resume();bootSequence();});
  $('#bootSkip').addEventListener('click',showLock);

  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest('#contextMenu'))closeContext();
    if(!e.target.closest('#popover,[data-pop]'))closePopover();
    if(!e.target.closest('#startMenu,#startBtn,#searchPill'))closeStart();
  },true);
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest('button');
    if(b&&!b.closest('[data-snd-skip]')&&!b.classList.contains('cell'))Audio.sfx('tick');
  });
  document.addEventListener('contextmenu',e=>{if(!e.target.closest('input,textarea,[contenteditable]'))e.preventDefault();});
  addEventListener('wheel',()=>{closeContext();},{passive:true,capture:true});
  addEventListener('blur',()=>{closeContext();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(dialogOpen()){cancelDialog();return;}
      if($('#contextMenu').classList.contains('open')){closeContext();return;}
      if(popState){closePopover();return;}
      if(startOpen()){closeStart();return;}
      return;}
    if(!session.loggedIn){if(e.key==='Enter'&&$('#lockScreen').classList.contains('on'))login();return;}
    if(e.ctrlKey&&e.altKey){
      const map={KeyT:'terminal',KeyE:'explorer',KeyM:'music'};
      if(map[e.code]){e.preventDefault();WM.open(map[e.code]);return;}
      if(e.code==='KeyL'){e.preventDefault();lockScreen();return;}
      const dir={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.code];
      if(dir){const w=WM.focused();if(w&&w.state==='normal'&&!isMobileNow()){e.preventDefault();
        if(e.shiftKey){w.w=clamp(w.w+dir[0],Apps[w.app].minW||300,innerWidth-w.x-4);w.h=clamp(w.h+dir[1],Apps[w.app].minH||220,WM.workH()-w.y-2);}
        else{w.x=clamp(w.x+dir[0],-w.w+90,innerWidth-90);w.y=clamp(w.y+dir[1],0,WM.workH()-40);}
        WM.applyRect(w);w.prev={x:w.x,y:w.y,w:w.w,h:w.h};w.api?.onResize?.();}return;}
      return;}
    const w=WM.focused();
    if(w&&w.keyHandler&&(w.el.contains(e.target)||e.target===document.body))w.keyHandler(e);
  });
  addEventListener('resize',()=>{clearTimeout(initShell._rt);initShell._rt=setTimeout(()=>WM.onViewport(),140);});
  bus.on('wins',renderDock);
  bus.on('settings',k=>{syncSoundUI();syncWifiUI();if(k==='username')syncUser();if(k==='theme'&&popState==='quick')renderPopover();});
  bus.on('vfs',()=>{if(startOpen()&&!$('#smSearch').value)renderStart('');});
  bus.on('notifications',()=>{if(popState==='notif')renderPopover();});
}
function isMobileNow(){return innerWidth<=720;}