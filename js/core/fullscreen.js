import {bus} from './bus.js';
import {notify} from './notifications.js';
import {isCoarse,$} from './utils.js';

/* ============================================================
   Полноэкранный режим
   - нативный Fullscreen API (Android / desktop)
   - компактный псевдо-режим там, где API нет (iOS Safari)
   - определение запуска с домашнего экрана (PWA)
   - учёт безопасных зон (вырез, home-indicator) в метриках оболочки
   ============================================================ */

const root=document.documentElement;
let probe=null,pseudo=false;

export const isHandheld=()=>isCoarse&&Math.min(innerWidth,innerHeight)<=900;
const nativeEl=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
const supported=()=>!!(root.requestFullscreen||root.webkitRequestFullscreen);
export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;

function measure(){
  if(!probe){
    probe=document.createElement('div');
    probe.setAttribute('aria-hidden','true');
    probe.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;'+
      'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);'+
      'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
    document.body.appendChild(probe);
  }
  const cs=getComputedStyle(probe);
  return{t:parseFloat(cs.paddingTop)||0,r:parseFloat(cs.paddingRight)||0,b:parseFloat(cs.paddingBottom)||0,l:parseFloat(cs.paddingLeft)||0};
}

/* единственное место, где --work-bottom превращается в число для менеджера окон */
export function applyMetrics(){
  const sa=measure();
  root.style.setProperty('--sa-t',sa.t+'px');
  root.style.setProperty('--sa-r',sa.r+'px');
  root.style.setProperty('--sa-b',sa.b+'px');
  root.style.setProperty('--sa-l',sa.l+'px');
  const mobile=innerWidth<=720;
  const base=mobile?(pseudo?64:70):76;
  root.style.setProperty('--work-bottom',(base+sa.b)+'px');
}

function sync(){bus.emit('fullscreen',{active:FS.active(),native:!!nativeEl(),pseudo,standalone:isStandalone()});}

export const FS={
  active(){return !!nativeEl()||pseudo||isStandalone();},
  native(){return !!nativeEl();},
  isPseudo(){return pseudo;},
  standalone:isStandalone,
  supported,
  statusText(){
    if(isStandalone())return 'Запуск с домашнего экрана — уже во весь экран';
    if(nativeEl())return 'Нативный полный экран включён';
    if(pseudo)return 'Компактный режим: браузер не отдаёт полный экран';
    if(supported())return 'Скрыть адресную строку и панели браузера';
    return 'Нет Fullscreen API — доступен компактный режим';
  },
  async enter(opts={}){
    if(isStandalone()){
      if(!opts.silent)notify('info','Полный экран','NEBULA уже запущена с домашнего экрана — браузерной панели нет.');
      return true;
    }
    if(nativeEl())return true;
    if(!supported()){
      pseudo=true;root.classList.add('pseudo-fs');applyMetrics();sync();
      if(!opts.silent)notify('warn','Компактный режим','Этот браузер не отдаёт странице полный экран. Добавьте NEBULA на экран «Домой» и запускайте оттуда — там он настоящий.',null,9000);
      return true;
    }
    try{
      if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});
      else root.webkitRequestFullscreen();
      root.classList.add('native-fs');
      applyMetrics();sync();
      if(!opts.silent)notify('success','Полный экран','NEBULA заняла весь экран. Выход — та же кнопка или системный жест «назад».');
      return true;
    }catch(e){
      pseudo=true;root.classList.add('pseudo-fs');applyMetrics();sync();
      if(!opts.silent)notify('warn','Полный экран недоступен','Браузер отклонил запрос — включён компактный режим вместо него.');
      return false;
    }
  },
  async exit(){
    if(pseudo){pseudo=false;root.classList.remove('pseudo-fs');applyMetrics();sync();return;}
    try{
      if(document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
    }catch(e){}
    root.classList.remove('native-fs');
    applyMetrics();sync();
  },
  set(on){return on?this.enter():this.exit();},
  toggle(){return this.active()&&!isStandalone()?this.exit():this.enter();},
  applyMetrics
};

/* иконка для «На экран Домой» — рисуется один раз, iOS читает актуальный href */
function makeTouchIcon(){
  try{
    const c=document.createElement('canvas');c.width=c.height=180;const x=c.getContext('2d');
    const bg=x.createRadialGradient(66,58,6,90,90,140);
    bg.addColorStop(0,'#1a1140');bg.addColorStop(.55,'#0a0a1e');bg.addColorStop(1,'#05060f');
    x.fillStyle=bg;x.fillRect(0,0,180,180);
    x.fillStyle='#dfe6ff';
    [[34,38,1.1],[146,46,.9],[45,142,1],[142,138,1.2],[116,30,.8]].forEach(([sx,sy,r])=>{x.globalAlpha=.6;x.beginPath();x.arc(sx,sy,r,0,7);x.fill();});
    x.globalAlpha=1;x.lineCap='round';
    x.strokeStyle='#22d3ee';x.lineWidth=7;x.beginPath();x.arc(90,90,40,-Math.PI/2,Math.PI*1.35);x.stroke();
    x.strokeStyle='#ff4fa3';x.lineWidth=5.5;x.beginPath();x.arc(90,90,26,Math.PI*.5,Math.PI*2.3);x.stroke();
    const core=x.createRadialGradient(84,84,2,90,90,14);
    core.addColorStop(0,'#c9bcff');core.addColorStop(.6,'#7c6bff');core.addColorStop(1,'#4b34c8');
    x.fillStyle=core;x.beginPath();x.arc(90,90,12,0,7);x.fill();
    x.fillStyle='#22d3ee';x.beginPath();x.arc(90,50,4.5,0,7);x.fill();
    x.fillStyle='#ffb454';x.beginPath();x.arc(52,52,2.6,0,7);x.fill();
    const link=$('#appleIcon');
    if(link)link.href=c.toDataURL('image/png');
  }catch(e){}
}

['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,()=>{
  root.classList.toggle('native-fs',!!nativeEl());
  if(!nativeEl()&&!pseudo)root.classList.remove('native-fs');
  applyMetrics();sync();
}));
addEventListener('orientationchange',()=>setTimeout(()=>{applyMetrics();sync();},260));
document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyMetrics();sync();}});

if(isStandalone())root.classList.add('standalone');
applyMetrics();
makeTouchIcon();