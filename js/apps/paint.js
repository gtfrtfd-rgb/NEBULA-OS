import {$,$$} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {Audio} from '../core/audio.js';
import {notify} from '../core/notifications.js';
import {addNode,mkImg,mkDir,nodeAt} from '../core/vfs.js';
import {WM} from '../wm.js';

export default {name:'Графика',icon:'brush',g:['#ff4fa3','#ffb454'],w:960,h:640,minW:560,minH:440,
mount(body,win,params){
  const W=900,H=540;
  let tool='brush',color='#7c6bff',size=9,alpha=1,undoStack=[],drawing=false,last=null,startPt=null,sprayTimer=null,name='без имени';
  const SW=['#1b1e3c','#ffffff','#ff5470','#ffb454','#a3e635','#34e0a1','#22d3ee','#4f8dff','#7c6bff','#ff4fa3'];
  body.innerHTML=`
  <div class="paint-tools">
    <div class="seg pt-tools">
      <button data-t="brush" class="on" title="Кисть">${icon('brush',15)}</button>
      <button data-t="eraser" title="Ластик">${icon('eraser',15)}</button>
      <button data-t="spray" title="Распылитель">${icon('spray',15)}</button>
      <button data-t="line" title="Линия">${icon('line',15)}</button>
      <button data-t="rect" title="Прямоугольник">${icon('rect',15)}</button>
      <button data-t="ellipse" title="Эллипс">${icon('circle',15)}</button>
    </div>
    <div class="pt-group"><span class="pt-label">Цвет</span><input type="color" class="pt-color" value="${color}" title="Свой цвет"><div class="swatches">${SW.map(c=>`<button class="swatch ${c===color?'on':''}" data-c="${c}" style="background:${c}" title="${c}" aria-label="Цвет ${c}"></button>`).join('')}</div></div>
    <div class="pt-group"><span class="pt-label">Размер</span><input type="range" class="pt-range pt-size" min="2" max="64" value="${size}"><span class="pt-val sz-v">${size}</span></div>
    <div class="pt-group"><span class="pt-label">Непрозр.</span><input type="range" class="pt-range pt-alpha" min="10" max="100" value="100"><span class="pt-val al-v">100</span></div>
    <button class="ibtn pt-undo" title="Отменить (Ctrl+Z)">${icon('undo',16)}</button>
    <button class="ibtn pt-clear" title="Очистить холст">${icon('trash',16)}</button>
    <span class="grow"></span>
    <button class="btn sm pt-save">${icon('save',14)} В файлы</button>
    <button class="btn sm pt-dl">${icon('download',14)} PNG</button>
  </div>
  <div class="paint-stage"><div class="paint-wrap"><canvas class="base" width="${W}" height="${H}"></canvas><canvas class="top" width="${W}" height="${H}"></canvas></div></div>
  <div class="statusbar"><span class="pt-name">холст 900×540 · без имени</span><span class="grow"></span><span class="pt-pos"></span></div>`;
  const wrap=$('.paint-wrap',body),base=$('canvas.base',body),top=$('canvas.top',body);
  const bx=base.getContext('2d'),tx=top.getContext('2d');
  bx.fillStyle='#ffffff';bx.fillRect(0,0,W,H);
  bx.lineCap=bx.lineJoin='round';tx.lineCap=tx.lineJoin='round';
  if(params.image){const im=new Image();im.onload=()=>{const s=Math.min(W/im.width,H/im.height);const w=im.width*s,h=im.height*s;bx.drawImage(im,(W-w)/2,(H-h)/2,w,h);pushUndo();};im.src=params.image;name=params.name||'импорт';}
  function pt(e){const r=base.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
  function pushUndo(){undoStack.push(bx.getImageData(0,0,W,H));if(undoStack.length>12)undoStack.shift();$('.pt-undo',body).disabled=false;}
  function undo(){const s=undoStack.pop();if(s){bx.putImageData(s,0,0);Audio.sfx('tick');}$('.pt-undo',body).disabled=!undoStack.length;}
  $('.pt-undo',body).disabled=true;
  function strokeStyle(ctx){ctx.strokeStyle=tool==='eraser'?'#000':color;ctx.fillStyle=color;ctx.lineWidth=size;}
  function drawShape(p){tx.clearRect(0,0,W,H);strokeStyle(tx);tx.beginPath();
    if(tool==='line'){tx.moveTo(startPt.x,startPt.y);tx.lineTo(p.x,p.y);}
    else if(tool==='rect'){tx.rect(Math.min(startPt.x,p.x),Math.min(startPt.y,p.y),Math.abs(p.x-startPt.x),Math.abs(p.y-startPt.y));}
    else{tx.ellipse((startPt.x+p.x)/2,(startPt.y+p.y)/2,Math.abs(p.x-startPt.x)/2,Math.abs(p.y-startPt.y)/2,0,0,7);}
    tx.stroke();}
  function sprayAt(p){tx.fillStyle=color;for(let i=0;i<size*1.4;i++){const a=Math.random()*7,r=Math.random()*size;tx.globalAlpha=.25+Math.random()*.5;tx.beginPath();tx.arc(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,.8+Math.random(),0,7);tx.fill();}tx.globalAlpha=1;}
  function commit(){bx.globalAlpha=tool==='eraser'?1:alpha;bx.drawImage(top,0,0);bx.globalAlpha=1;tx.clearRect(0,0,W,H);}
  wrap.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();wrap.setPointerCapture(e.pointerId);
    pushUndo();drawing=true;const p=pt(e);last=p;startPt=p;
    tx.clearRect(0,0,W,H);strokeStyle(tx);
    if(tool==='brush'){tx.beginPath();tx.moveTo(p.x,p.y);tx.lineTo(p.x+.01,p.y+.01);tx.stroke();}
    else if(tool==='eraser'){bx.save();bx.globalCompositeOperation='destination-out';bx.beginPath();bx.moveTo(p.x,p.y);bx.lineTo(p.x+.01,p.y+.01);bx.lineWidth=size;bx.stroke();bx.restore();}
    else if(tool==='spray'){sprayAt(p);sprayTimer=setInterval(()=>sprayAt(last),40);}
    else drawShape(p);});
  wrap.addEventListener('pointermove',e=>{
    const p=pt(e);$('.pt-pos',body).textContent=`${Math.round(p.x)}, ${Math.round(p.y)}`;
    if(!drawing){tx.clearRect(0,0,W,H);tx.strokeStyle='rgba(120,130,200,.65)';tx.lineWidth=1.2;tx.beginPath();tx.arc(p.x,p.y,size/2,0,7);tx.stroke();return;}
    if(tool==='brush'){const mid={x:(last.x+p.x)/2,y:(last.y+p.y)/2};tx.beginPath();tx.moveTo(last.x,last.y);tx.quadraticCurveTo(last.x,last.y,mid.x,mid.y);tx.lineTo(p.x,p.y);tx.stroke();last=p;}
    else if(tool==='eraser'){bx.save();bx.globalCompositeOperation='destination-out';bx.lineWidth=size;bx.beginPath();bx.moveTo(last.x,last.y);bx.lineTo(p.x,p.y);bx.stroke();bx.restore();last=p;}
    else if(tool==='spray'){last=p;}
    else drawShape(p);});
  const finish=()=>{if(!drawing)return;drawing=false;clearInterval(sprayTimer);
    if(tool==='eraser'){bx.save();bx.globalCompositeOperation='destination-over';bx.fillStyle='#fff';bx.fillRect(0,0,W,H);bx.restore();}
    else commit();};
  wrap.addEventListener('pointerup',finish);wrap.addEventListener('pointercancel',finish);
  wrap.addEventListener('pointerleave',()=>{if(!drawing)tx.clearRect(0,0,W,H);});
  $$('.pt-tools button',body).forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.t;$$('.pt-tools button',body).forEach(x=>x.classList.toggle('on',x===b));}));
  function setColor(c){color=c;$('.pt-color',body).value=c;$$('.swatch',body).forEach(s=>s.classList.toggle('on',s.dataset.c===c));}
  $$('.swatch',body).forEach(s=>s.addEventListener('click',()=>setColor(s.dataset.c)));
  $('.pt-color',body).addEventListener('input',e=>setColor(e.target.value));
  const bindRange=(inp,fn)=>{const upd=()=>{inp.style.setProperty('--val',(inp.value-inp.min)/(inp.max-inp.min)*100+'%');fn(+inp.value);};inp.addEventListener('input',upd);upd();};
  bindRange($('.pt-size',body),v=>{size=v;$('.sz-v',body).textContent=v;});
  bindRange($('.pt-alpha',body),v=>{alpha=v/100;$('.al-v',body).textContent=v;});
  $('.pt-undo',body).addEventListener('click',undo);
  $('.pt-clear',body).addEventListener('click',()=>{pushUndo();bx.fillStyle='#fff';bx.fillRect(0,0,W,H);tx.clearRect(0,0,W,H);Audio.sfx('close');});
  function fileName(){const dir=nodeAt('/Изображения')||addNode('/',mkDir('Изображения'));let i=1;while(dir.children.some(c=>c.name===`рисунок-${i}.png`))i++;return`рисунок-${i}.png`;}
  $('.pt-save',body).addEventListener('click',()=>{
    const fname=fileName();const n=addNode('/Изображения',mkImg(fname,base.toDataURL('image/png')));
    if(!n)return;name=fname;$('.pt-name',body).textContent=`холст 900×540 · ${name}`;win.setTitle('Графика — '+name);
    notify('success','Сохранено в файлы',`«${name}» лежит в /Изображения.`,{label:'Открыть',fn:()=>WM.open('viewer',{id:n.id})});});
  $('.pt-dl',body).addEventListener('click',()=>{const a=document.createElement('a');a.href=base.toDataURL('image/png');a.download=(name==='без имени'?'nebula-art':name.replace(/\.png$/,''))+'.png';a.click();notify('success','PNG экспортирован','Файл отправлен в загрузки браузера.');});
  win.keyHandler=e=>{if(e.ctrlKey&&e.code==='KeyZ'){e.preventDefault();undo();}};
  return{onClose(){clearInterval(sprayTimer);}};
}};