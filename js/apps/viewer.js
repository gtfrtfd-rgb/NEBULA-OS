import {$,el,icon,clamp} from '../core/utils.js';
import {nodeAt,findPathById} from '../core/vfs.js';
import {bus} from '../core/bus.js';
import {WM} from '../wm.js';

export default {name:'Просмотр',icon:'image',g:['#a3e635','#22d3ee'],w:740,h:560,minW:420,minH:340,single:true,
mount(body,win,params){
  let fileId=params.id||null,zoom=1,fitZoom=1,panX=0,panY=0,natW=0,natH=0;
  body.innerHTML=`
  <div class="toolbar">
    <button class="ibtn v-out" title="Уменьшить">${icon('zoomout',16)}</button>
    <input type="range" class="v-zoom" min="10" max="400" value="100" style="width:130px">
    <button class="ibtn v-in" title="Увеличить">${icon('zoomin',16)}</button>
    <button class="btn sm v-fit">${icon('fit',13)} Вписать</button>
    <button class="btn sm v-100">1:1</button>
    <span class="grow"></span>
    <button class="btn sm v-paint">${icon('brush',13)} В Графику</button>
    <button class="btn sm v-dl">${icon('download',13)} Скачать</button>
  </div>
  <div class="view-stage"><img alt=""></div>
  <div class="statusbar"><span class="v-name"></span><span class="grow"></span><span class="v-info"></span></div>`;
  const stage=$('.view-stage',body),img=$('img',body);
  function node(){return fileId?nodeAt(findPathById(fileId)):null;}
  function apply(){img.style.transform=`translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
    $('.v-zoom',body).value=Math.round(zoom*100);$('.v-zoom',body).style.setProperty('--val',clamp((zoom*100-10)/390*100,0,100)+'%');
    $('.v-info',body).textContent=`${natW}×${natH} · ${Math.round(zoom*100)}%`;}
  function fit(){const r=stage.getBoundingClientRect();if(!natW)return;
    fitZoom=Math.min((r.width-40)/natW,(r.height-40)/natH,1.5);zoom=fitZoom;panX=panY=0;apply();}
  function load(){const n=node();
    $('.view-missing',stage)?.remove();
    if(!n){img.style.display='none';stage.appendChild(el(`<div class="view-missing">${icon('alert',30)}<b>Файл удалён</b><span style="font-size:12px">Изображение больше не существует в nebulaFS.</span></div>`));win.setTitle('Просмотр');$('.v-name',body).textContent='—';return;}
    win.setTitle('Просмотр — '+n.name);$('.v-name',body).textContent=findPathById(fileId);
    img.style.display='';img.onload=()=>{natW=img.naturalWidth;natH=img.naturalHeight;fit();};img.src=n.content;}
  $('.v-zoom',body).addEventListener('input',e=>{zoom=+e.target.value/100;apply();});
  $('.v-in',body).addEventListener('click',()=>{zoom=clamp(zoom*1.25,.1,4);apply();});
  $('.v-out',body).addEventListener('click',()=>{zoom=clamp(zoom/1.25,.1,4);apply();});
  $('.v-fit',body).addEventListener('click',fit);
  $('.v-100',body).addEventListener('click',()=>{zoom=1;panX=panY=0;apply();});
  $('.v-dl',body).addEventListener('click',()=>{const n=node();if(!n)return;const a=document.createElement('a');a.href=n.content;a.download=n.name;a.click();});
  $('.v-paint',body).addEventListener('click',()=>{const n=node();if(n)WM.open('paint',{image:n.content,name:n.name});});
  stage.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY<0?1.12:.9),.1,4);apply();},{passive:false});
  stage.addEventListener('pointerdown',e=>{stage.setPointerCapture(e.pointerId);const sx=e.clientX-panX,sy=e.clientY-panY;
    const mv=ev=>{panX=ev.clientX-sx;panY=ev.clientY-sy;apply();};
    const up=()=>{stage.removeEventListener('pointermove',mv);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);};
    stage.addEventListener('pointermove',mv);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);});
  const off=bus.on('vfs',()=>{if(fileId&&!node())load();});
  load();
  return{onClose:off,onResize:fit,remount(p){if(p.id){fileId=p.id;load();}}};
}};