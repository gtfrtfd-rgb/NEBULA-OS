import {$} from './core/utils.js';
import {applySettings} from './core/settings.js';
import {loadVfs} from './core/vfs.js';
import {Wall} from './core/wallpaper.js';
import {notify} from './core/notifications.js';
import {initShell} from './shell.js';
import {bootSequence} from './boot.js';
import {SHORT_LINE,PAGE_TITLE} from './core/version.js';

/* Офлайн-кэш и установка на домашний экран — только на опубликованном сайте.
   На http://localhost разработка идёт мимо service worker, кэш не мешает. */
function registerServiceWorker(){
  if(!('serviceWorker' in navigator)||location.protocol!=='https:')return;
  navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
    reg.addEventListener('updatefound',()=>{
      const nw=reg.installing;
      if(!nw)return;
      nw.addEventListener('statechange',()=>{
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          notify('info','Обновление готово','Новая сборка NEBULA OS загружена в фоне.',
            {label:'Перезагрузить',fn:()=>location.reload()},10000);
        }
      });
    });
  }).catch(()=>{});
}

async function start(){
  applySettings();
  const sub=$('#bootSub');if(sub)sub.textContent=SHORT_LINE;
  document.title=PAGE_TITLE;
  await loadVfs();
  Wall.init();
  initShell();
  bootSequence();
  if(document.readyState==='complete')registerServiceWorker();
  else addEventListener('load',registerServiceWorker,{once:true});
}
start();