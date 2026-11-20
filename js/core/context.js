import {$,el,esc,clamp} from './utils.js';
import {icon} from './icons.js';

export function openContext(x,y,items){
  const m=$('#contextMenu');m.innerHTML='';
  items.forEach(it=>{if(it==='sep'){m.appendChild(el('<div class="ctx-sep"></div>'));return;}
    const b=el(`<button class="ctx-item ${it.danger?'danger':''} ${it.dis?'dis':''}">${icon(it.icon||'chevR',15)}<span>${esc(it.label)}</span>${it.kbd?`<kbd>${esc(it.kbd)}</kbd>`:''}</button>`);
    b.addEventListener('click',()=>{closeContext();it.fn&&it.fn();});m.appendChild(b);});
  m.classList.add('open');
  const r=m.getBoundingClientRect();
  m.style.left=clamp(x,6,innerWidth-r.width-6)+'px';
  m.style.top=clamp(y,6,innerHeight-r.height-6)+'px';
}
export function closeContext(){$('#contextMenu').classList.remove('open');}