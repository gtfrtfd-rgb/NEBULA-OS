import {uid,esc,el,$} from './utils.js';
import {icon} from './icons.js';
import {Audio} from './audio.js';
import {bus} from './bus.js';

export const notifications=[];
let unread=0;

function syncBell(){$('#bellBadge').textContent=unread>0?(unread>9?'9+':unread):'';}
export function markNotificationsRead(){unread=0;syncBell();}

export function notify(type,title,body,action=null,dur=5200){
  const item={id:uid(),type,title,body,time:Date.now(),action,read:false};
  notifications.unshift(item);if(notifications.length>40)notifications.pop();
  unread++;syncBell();
  Audio.sfx(type==='error'?'error':'notify');
  showToast(item,dur);
  bus.emit('notifications');
  return item;
}
function showToast(item,dur){
  const box=$('#toasts');while(box.children.length>=4)box.firstElementChild.remove();
  const t=el(`<div class="toast ${item.type}">
    <span class="ni ${item.type}">${icon({info:'info',success:'check',warn:'alert',error:'x'}[item.type]||'info',16)}</span>
    <div class="tt"><b>${esc(item.title)}</b><p>${esc(item.body)}</p>${item.action?`<button class="t-act">${esc(item.action.label)}</button>`:''}</div>
    <button class="t-x" aria-label="Закрыть">${icon('x',13)}</button>
    <i class="t-bar" style="animation-duration:${dur}ms"></i></div>`);
  box.appendChild(t);
  let remaining=dur,start=Date.now(),timer=setTimeout(dismiss,dur);
  function dismiss(){clearTimeout(timer);t.classList.add('out');setTimeout(()=>t.remove(),230);}
  t.addEventListener('mouseenter',()=>{clearTimeout(timer);remaining-=Date.now()-start;$('.t-bar',t).style.animationPlayState='paused';});
  t.addEventListener('mouseleave',()=>{start=Date.now();timer=setTimeout(dismiss,Math.max(400,remaining));$('.t-bar',t).style.animationPlayState='running';});
  $('.t-x',t).addEventListener('click',dismiss);
  if(item.action)$('.t-act',t).addEventListener('click',()=>{try{item.action.fn();}catch(e){}item.action=null;bus.emit('notifications');dismiss();});
}