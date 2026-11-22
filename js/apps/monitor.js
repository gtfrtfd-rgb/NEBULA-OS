import {$,esc,clamp,hexRgb,fmtUp} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {bus} from '../core/bus.js';
import {WM} from '../wm.js';
import {Music} from '../core/music.js';
import {Wall} from '../core/wallpaper.js';
import {session} from '../core/session.js';
import {Apps} from './index.js';

export default {name:'Монитор',icon:'activity',g:['#22d3ee','#4f8dff'],w:640,h:540,minW:440,minH:380,single:true,
mount(body,win){
  body.innerHTML=`<div class="mon">
    <div class="mon-top">
      <div class="mon-card"><div class="mc-l"><span>Процессор</span><span class="mc-fps"></span></div><div class="mc-v mon-cpu">0%</div><canvas class="mon-spark"></canvas></div>
      <div class="mon-card"><div class="mc-l"><span>Память</span><span>8192 МБ</span></div><div class="mc-v mon-ram">0 МБ</div><div class="mon-bar"><i></i></div>
        <div class="mon-meta"><span>Аптайм <b class="mon-up"></b></span><span>Окна <b class="mon-wins"></b></span></div></div>
    </div>
    <div class="mon-list"></div></div>`;
  const spark=$('.mon-spark',body),sx=spark.getContext('2d');
  const cpuHist=Array(60).fill(4);const proc=new Map();
  let acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#7c6bff';
  let accRgb=hexRgb(acc),sparkW=0,sparkH=0;
  const offSet=bus.on('settings',()=>{acc=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()||'#7c6bff';accRgb=hexRgb(acc);});

  function stats(id,app){
    if(!proc.has(id))proc.set(id,{cpu:2+Math.random()*5,ram:{explorer:120,terminal:64,editor:88,calc:42,paint:210,music:150,game:96,monitor:74,settings:66,viewer:130,help:52}[app]||80});
    const p=proc.get(id);
    let target=3+Math.random()*6;
    if(app==='music'&&Music.playing)target=11+Math.random()*6;
    if(app==='paint')target=4+Math.random()*10;
    if(app==='game')target=2+Math.random()*5;
    p.cpu=clamp(p.cpu+(target-p.cpu)*.3+(Math.random()-.5)*2,.3,32);
    p.ram=Math.max(30,p.ram+(Math.random()-.5)*4);
    return p;
  }
  function draw(){
    const r=spark.getBoundingClientRect();
    const d=Math.min(devicePixelRatio||1,1.5),w=Math.round(r.width),h=40;
    if(!w)return;
    if(w!==sparkW||h!==sparkH){spark.width=w*d;spark.height=h*d;sx.setTransform(d,0,0,d,0,0);sparkW=w;sparkH=h;}
    sx.clearRect(0,0,w,h);
    sx.beginPath();
    for(let i=0;i<cpuHist.length;i++){const x=i/(cpuHist.length-1)*w,y=h-2-(cpuHist[i]/40)*(h-6);i===0?sx.moveTo(x,y):sx.lineTo(x,y);}
    sx.strokeStyle=acc;sx.lineWidth=1.8;sx.stroke();
    sx.lineTo(w,h);sx.lineTo(0,h);sx.closePath();
    const g=sx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,`rgba(${accRgb[0]},${accRgb[1]},${accRgb[2]},.3)`);g.addColorStop(1,'rgba(0,0,0,0)');
    sx.fillStyle=g;sx.fill();
  }
  function tick(){
    if(win.minimized||win.closing||document.hidden)return;
    const rows=[];let total=6+Math.random()*3,ram=1240;
    const sysCpu=clamp(100/Math.max(30,Wall.fps)*4+Math.random()*2,2,14);
    total+=sysCpu;ram+=96;
    rows.push({sys:true,icon:'logo',g:['#7c6bff','#22d3ee'],name:'Аврора-рендер',sub:`ядро · ${Wall.fps} FPS`,cpu:sysCpu,ram:96});
    rows.push({sys:true,icon:'hdd',g:['#8a93c9','#4a5382'],name:'NebulaShell',sub:'оболочка · система',cpu:2+Math.random()*3,ram:180});
    const alive=new Set();
    [...WM.wins.values()].filter(w=>!w.closing).forEach(w=>{alive.add(w.id);const p=stats(w.id,w.app);total+=p.cpu;ram+=p.ram;
      rows.push({id:w.id,app:w.app,name:w.title||Apps[w.app].name,sub:Apps[w.app].name+(w.minimized?' · свёрнуто':''),cpu:p.cpu,ram:p.ram});});
    [...proc.keys()].forEach(k=>{if(!alive.has(k))proc.delete(k);});
    total=clamp(total,2,98);cpuHist.push(total);cpuHist.shift();
    $('.mon-cpu',body).textContent=Math.round(total)+'%';
    $('.mc-fps',body).textContent=Wall.fps+' FPS';
    $('.mon-ram',body).textContent=Math.round(ram)+' МБ';
    $('.mon-bar i',body).style.width=(ram/8192*100)+'%';
    $('.mon-up',body).textContent=fmtUp((Date.now()-session.bootTime)/1000);
    $('.mon-wins',body).textContent=WM.wins.size;
    rows.sort((a,b)=>(a.sys?1:0)-(b.sys?1:0)||b.cpu-a.cpu);
    $('.mon-list',body).innerHTML=rows.map(r=>{
      const col=r.cpu>18?'var(--red)':r.cpu>9?'var(--amber)':'var(--green)';
      const g0=r.g?r.g[0]:Apps[r.app].g[0],g1=r.g?r.g[1]:Apps[r.app].g[1];
      return`<div class="mon-row" data-id="${r.id||''}">
        <span class="tile" style="background:linear-gradient(135deg,${g0},${g1})">${icon(r.icon||Apps[r.app].icon,15)}</span>
        <div class="mr-n"><b>${esc(r.name)}</b><span>${esc(r.sub)}</span></div>
        <div class="mr-cpu"><div class="v" style="color:${col}">${r.cpu.toFixed(1)}%</div><div class="cpu-bar"><i style="width:${clamp(r.cpu*3,3,100)}%;background:${col}"></i></div></div>
        <div class="mr-ram">${Math.round(r.ram)} МБ</div>
        ${r.sys?`<button class="ibtn" disabled title="Системный процесс">${icon('lock',13)}</button>`:`<button class="ibtn mon-kill" data-id="${r.id}" title="Снять задачу">${icon('x',14)}</button>`}
      </div>`;}).join('');
    draw();
  }
  $('.mon-list',body).addEventListener('click',e=>{
    const kill=e.target.closest('.mon-kill');
    if(kill){const w=WM.wins.get(kill.dataset.id);if(w)WM.close(w);return;}
    const row=e.target.closest('.mon-row');
    if(row&&row.dataset.id){const w=WM.wins.get(row.dataset.id);if(w){if(w.minimized)WM.restore(w);WM.focus(w);}}});
  tick();
  const iv=setInterval(tick,1000);
  return{onClose(){clearInterval(iv);offSet();},onResize(){sparkW=0;draw();}};
}};