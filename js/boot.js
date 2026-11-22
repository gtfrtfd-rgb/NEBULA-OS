import {$} from './core/utils.js';
import {session} from './core/session.js';
import {settings,setSetting} from './core/settings.js';
import {bus} from './core/bus.js';
import {Audio} from './core/audio.js';
import {Music} from './core/music.js';
import {notify} from './core/notifications.js';
import {closeContext} from './core/context.js';
import {FS,isHandheld} from './core/fullscreen.js';
import {WM} from './wm.js';
import {closeStart,closePopover,tickClock} from './shell.js';

let bootTimers=[];

export function bootSequence(){
  session.loggedIn=false;document.body.classList.add('locked');document.body.classList.remove('entered');
  $('#shutdownScreen').classList.remove('on');$('#lockScreen').classList.remove('on');
  const bs=$('#bootScreen');bs.classList.remove('hide');bs.style.display='';
  $('#bootBar').style.width='0%';$('#bootLog').innerHTML='';
  bootTimers.forEach(clearTimeout);bootTimers=[];
  const lines=['NEBULA BIOS 6.2 — инициализация…','Проверка памяти: 8192 МБ <span class="ok">OK</span>','Монтирование /dev/stardust… <span class="ok">OK</span>','Загрузка ядра nebula-6.2.0… <span class="ok">OK</span>','Драйвер авроры: <span class="ok">активен</span>','Калибровка гравитации: 9.81 м/с²','Синхронизация звёздного времени… <span class="ok">OK</span>','Запуск NebulaShell…'];
  lines.forEach((l,i)=>{bootTimers.push(setTimeout(()=>{
    const d=document.createElement('div');d.innerHTML='▸ '+l;$('#bootLog').appendChild(d);
    while($('#bootLog').children.length>6)$('#bootLog').firstElementChild.remove();
    $('#bootBar').style.width=Math.round((i+1)/lines.length*100)+'%';},220+i*290));});
  bootTimers.push(setTimeout(showLock,220+lines.length*290+350));
}
export function showLock(){
  bootTimers.forEach(clearTimeout);bootTimers=[];
  $('#bootBar').style.width='100%';
  $('#bootScreen').classList.add('hide');
  setTimeout(()=>{$('#bootScreen').style.display='none';},520);
  $('#lockScreen').classList.add('on');
  FS.applyMetrics();
  tickClock();setTimeout(()=>$('#loginBtn').focus(),300);
}
export function login(){
  if(session.loggedIn)return;
  Audio.init();Audio.resume();
  /* жест пользователя ещё активен — входим в полный экран сразу */
  if(settings.fsAuto&&isHandheld()&&!FS.active())FS.enter({silent:true});
  session.loggedIn=true;session.bootTime=Date.now();
  document.body.classList.remove('locked');document.body.classList.add('entered');
  $('#lockScreen').classList.remove('on');
  Audio.sfx('chime');
  if(!session.welcomed){session.welcomed=true;
    setTimeout(()=>notify('info',`Добро пожаловать, ${settings.username}!`,'NEBULA OS готова к полёту. В Справке — горячие клавиши и секреты.',{label:'Открыть справку',fn:()=>WM.open('help')},7000),900);
    if(isHandheld()&&!settings.fsHint&&!FS.active()){
      setTimeout(()=>{setSetting('fsHint',true);
        notify('info','Полный экран','Уберите адресную строку браузера — NEBULA займёт весь экран телефона.',{label:'Включить',fn:()=>FS.enter()},9000);},4200);
    }
    setTimeout(()=>notify('success','Совет пилоту','Правый клик по рабочему столу — контекстное меню. Бросьте окно к краю экрана — оно прилипнет.',null,8000),9500);}
}
export function lockScreen(){
  closeStart();closePopover();closeContext();
  session.loggedIn=false;document.body.classList.add('locked');
  $('#lockScreen').classList.add('on');tickClock();
  setTimeout(()=>$('#loginBtn').focus(),200);
}
export function powerAction(kind){
  closeStart();closePopover();closeContext();
  Music.stop();WM.closeAll();$('#toasts').innerHTML='';
  session.loggedIn=false;document.body.classList.add('locked');document.body.classList.remove('entered');
  $('#lockScreen').classList.remove('on');
  if(kind==='restart')bootSequence();
  else{$('#bootScreen').style.display='none';$('#shutdownScreen').classList.add('on');}
}
bus.on('power',kind=>powerAction(kind));