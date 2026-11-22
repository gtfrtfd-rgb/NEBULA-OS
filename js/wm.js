import {$,$$,clamp,uid,el,esc,isMobile} from './core/utils.js';
import {icon,tileHtml} from './core/icons.js';
import {settings} from './core/settings.js';
import {Audio} from './core/audio.js';
import {bus} from './core/bus.js';
import {Apps} from './apps/index.js';

/* кэш высоты рабочей области: без getComputedStyle на каждый кадр перетаскивания */
let _wb=0,_wbW=-1,_wbT=0;

export const WM={wins:new Map(),z:10,focusedId:null,cascade:0,
workH(){
  const now=performance.now();
  if(_wbW!==innerWidth||now-_wbT>1000){
    _wb=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--work-bottom'))||76;
    _wbW=innerWidth;_wbT=now;
  }
  return innerHeight-_wb;
},
open(appId,params={}){
  const app=Apps[appId];if(!app)return null;
  if(app.single){const ex=[...this.wins.values()].find(w=>w.app===appId&&!w.closing);
    if(ex){if(ex.minimized)this.restore(ex);this.focus(ex);if(params&&Object.keys(params).length&&ex.api?.remount)ex.api.remount(params);return ex;}}
  if(app.perFile&&params.id){const ex=[...this.wins.values()].find(w=>w.app===appId&&w.api?.fileId===params.id&&!w.closing);
    if(ex){if(ex.minimized)this.restore(ex);this.focus(ex);return ex;}}
  if(app.findExisting){const ex=app.findExisting(params,[...this.wins.values()].filter(w=>w.app===appId&&!w.closing));
    if(ex){if(ex.minimized)this.restore(ex);this.focus(ex);return ex;}}
  const id=uid();
  const vw=innerWidth,vh=this.workH();
  let w=Math.min(app.w,vw-20),h=Math.min(app.h,vh-16);
  const c=this.cascade++%6;
  let x=clamp(70+c*32,8,Math.max(8,vw-w-8)),y=clamp(34+c*26,8,Math.max(8,vh-h-8));
  if(app.center){x=Math.round((vw-w)/2);y=Math.round((vh-h)/2.4);}
  const win={id,app:appId,params,x,y,w,h,prev:{x,y,w,h},state:'normal',minimized:false,closing:false,api:null,timers:{}};
  const node=el(`<section class="window" role="dialog" aria-label="${esc(app.name)}">
    <header class="titlebar">
      ${tileHtml(app,22,'tile t-icon')}
      <span class="w-title">${esc(app.name)}</span>
      <div class="w-ctrl">
        <button class="w-btn min" title="Свернуть" aria-label="Свернуть">${icon('minus',14)}</button>
        <button class="w-btn max" title="Развернуть" aria-label="Развернуть">${icon('square',12)}</button>
        <button class="w-btn close" title="Закрыть" aria-label="Закрыть">${icon('x',14)}</button>
      </div>
    </header>
    <div class="win-body"></div>
    <div class="rz rz-e"></div><div class="rz rz-s"></div><div class="rz rz-se"></div>
  </section>`);
  win.el=node;win.body=$('.win-body',node);win.titleEl=$('.w-title',node);
  win.setTitle=t=>{if(win.title===t)return;win.title=t;win.titleEl.textContent=t;node.setAttribute('aria-label',t);bus.emit('wins');};
  win.title=app.name;
  $('#windows').appendChild(node);
  this.wins.set(id,win);
  this.applyRect(win);
  if(isMobile())this.setState(win,'max',true);
  node.addEventListener('pointerdown',()=>this.focus(win),true);
  $('.w-btn.min',node).addEventListener('click',e=>{e.stopPropagation();this.minimize(win);});
  $('.w-btn.max',node).addEventListener('click',e=>{e.stopPropagation();this.toggleMax(win);});
  $('.w-btn.close',node).addEventListener('click',e=>{e.stopPropagation();this.close(win);});
  const tb=$('.titlebar',node);
  tb.addEventListener('dblclick',e=>{if(!e.target.closest('.w-btn')&&!isMobile())this.toggleMax(win);});
  this.bindDrag(win,tb);this.bindResize(win);
  try{win.api=app.mount(win.body,win,params)||{};}catch(err){console.error(err);win.body.innerHTML=`<div style="padding:24px;color:var(--red)">Ошибка запуска приложения</div>`;}
  this.focus(win);Audio.sfx('open');bus.emit('wins');
  return win;
},
applyRect(win){const s=win.el.style;s.left=win.x+'px';s.top=win.y+'px';s.width=win.w+'px';s.height=win.h+'px';},
rectFor(state){const vw=innerWidth,vh=this.workH(),g=isMobile()?6:8;
  if(state==='max')return{x:g,y:g,w:vw-g*2,h:vh-g};
  if(state==='left')return{x:g,y:g,w:Math.round(vw/2)-g*1.5,h:vh-g};
  if(state==='right')return{x:Math.round(vw/2)+g*.5,y:g,w:Math.round(vw/2)-g*1.5,h:vh-g};
  return null;},
setState(win,state,instant=false){
  if(state!=='normal'&&win.state==='normal')win.prev={x:win.x,y:win.y,w:win.w,h:win.h};
  const r=state==='normal'?win.prev:this.rectFor(state);if(!r)return;
  win.state=state;
  win.el.classList.toggle('state-max',state==='max');win.el.classList.toggle('state-left',state==='left');win.el.classList.toggle('state-right',state==='right');
  $('.w-btn.max',win.el).innerHTML=icon(state==='normal'?'square':'restore',12);
  $('.w-btn.max',win.el).title=state==='normal'?'Развернуть':'Восстановить';
  if(!instant&&settings.animations){win.el.classList.add('rect-anim');clearTimeout(win.timers.rect);win.timers.rect=setTimeout(()=>win.el.classList.remove('rect-anim'),250);}
  Object.assign(win,r);this.applyRect(win);
  win.api?.onResize?.();},
toggleMax(win){this.setState(win,win.state==='normal'?'max':'normal');Audio.sfx('tick');},
bindDrag(win,tb){
  tb.addEventListener('pointerdown',e=>{
    if(e.target.closest('.w-btn')||isMobile()||e.button!==0)return;
    e.preventDefault();tb.setPointerCapture(e.pointerId);
    let sx=e.clientX,sy=e.clientY,bx=win.x,by=win.y,moved=false,snap=null;
    const preview=$('#snapPreview');
    const move=ev=>{
      const dx=ev.clientX-sx,dy=ev.clientY-sy;
      if(!moved&&Math.hypot(dx,dy)<5)return;
      if(!moved){moved=true;document.body.classList.add('dragging');win.el.classList.remove('rect-anim');
        if(win.state!=='normal'){const ratio=(sx-win.x)/win.w;const pw=win.prev.w,ph=win.prev.h;
          win.state='normal';win.el.classList.remove('state-max','state-left','state-right');
          $('.w-btn.max',win.el).innerHTML=icon('square',12);
          win.w=pw;win.h=ph;bx=ev.clientX-pw*clamp(ratio,.1,.9);by=ev.clientY-18;sx=ev.clientX;sy=ev.clientY;
          win.x=bx;win.y=by;this.applyRect(win);win.api?.onResize?.();}}
      const vh=this.workH();
      win.x=clamp(bx+(ev.clientX-sx),-win.w+90,innerWidth-90);
      win.y=clamp(by+(ev.clientY-sy),0,vh-40);
      this.applyRect(win);
      let ns=null;
      if(ev.clientY<=6)ns='max';else if(ev.clientX<=6)ns='left';else if(ev.clientX>=innerWidth-6)ns='right';
      if(ns!==snap){snap=ns;
        if(snap){const r=this.rectFor(snap);Object.assign(preview.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});preview.classList.add('on');}
        else preview.classList.remove('on');}
    };
    const up=()=>{
      tb.removeEventListener('pointermove',move);tb.removeEventListener('pointerup',up);tb.removeEventListener('pointercancel',up);
      document.body.classList.remove('dragging');preview.classList.remove('on');
      if(snap)this.setState(win,snap);
      else if(moved)win.prev={x:win.x,y:win.y,w:win.w,h:win.h};
    };
    tb.addEventListener('pointermove',move);tb.addEventListener('pointerup',up);tb.addEventListener('pointercancel',up);
  });
},
bindResize(win){
  $$('.rz',win.el).forEach(h=>{
    h.addEventListener('pointerdown',e=>{
      if(win.state!=='normal'||isMobile())return;
      e.preventDefault();e.stopPropagation();h.setPointerCapture(e.pointerId);
      const sx=e.clientX,sy=e.clientY,bw=win.w,bh=win.h;
      const dirE=h.classList.contains('rz-e')||h.classList.contains('rz-se');
      const dirS=h.classList.contains('rz-s')||h.classList.contains('rz-se');
      const app=Apps[win.app];
      const move=ev=>{
        const vh=this.workH();
        if(dirE)win.w=clamp(bw+ev.clientX-sx,app.minW||300,innerWidth-win.x-4);
        if(dirS)win.h=clamp(bh+ev.clientY-sy,app.minH||220,vh-win.y-2);
        this.applyRect(win);win.api?.onResize?.();};
      const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);win.prev={x:win.x,y:win.y,w:win.w,h:win.h};};
      h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
    });
  });
},
focus(win){if(win.closing)return;
  if(this.z>3000){const sorted=[...this.wins.values()].sort((a,b)=>(+a.el.style.zIndex||0)-(+b.el.style.zIndex||0));sorted.forEach((w,i)=>{w.el.style.zIndex=10+i;});this.z=10+sorted.length;}
  win.el.style.zIndex=++this.z;
  if(this.focusedId!==win.id||!win.el.classList.contains('focused')){
    this.wins.forEach(w=>w.el.classList.toggle('focused',w===win));
    this.focusedId=win.id;bus.emit('wins');}
},
focused(){return this.wins.get(this.focusedId);},
minimize(win){if(win.minimized||win.closing)return;
  Audio.sfx('min');win.minimized=true;
  win.el.classList.add('min-anim');requestAnimationFrame(()=>win.el.classList.add('min-pose'));
  clearTimeout(win.timers.min);win.timers.min=setTimeout(()=>{win.el.style.display='none';win.el.classList.remove('min-anim','min-pose');},230);
  if(this.focusedId===win.id){this.focusedId=null;const next=[...this.wins.values()].filter(w=>w!==win&&!w.minimized&&!w.closing).sort((a,b)=>(+b.el.style.zIndex)-(+a.el.style.zIndex))[0];if(next)this.focus(next);else{this.wins.forEach(w=>w.el.classList.remove('focused'));}}
  bus.emit('wins');},
restore(win){if(!win.minimized)return;clearTimeout(win.timers.min);
  win.minimized=false;win.el.style.display='';
  win.el.classList.add('min-anim','min-pose');void win.el.offsetWidth;
  requestAnimationFrame(()=>win.el.classList.remove('min-pose'));
  clearTimeout(win.timers.min);win.timers.min=setTimeout(()=>win.el.classList.remove('min-anim'),250);
  this.focus(win);bus.emit('wins');},
close(win,instant=false){
  if(win.closing)return;
  if(!instant&&!win._closeOk&&typeof win.api?.beforeClose==='function'){
    if(win._asking)return;
    win._asking=true;this.focus(win);
    let r;try{r=win.api.beforeClose();}catch(e){r=true;}
    Promise.resolve(r).then(allow=>{
      win._asking=false;
      if(allow===false)return;
      win._closeOk=true;this.close(win,instant);
    },()=>{win._asking=false;win._closeOk=true;this.close(win,instant);});
    return;
  }
  win.closing=true;
  try{win.api?.onClose?.();}catch(e){console.warn(e);}
  Object.values(win.timers).forEach(clearTimeout);
  if(!instant)Audio.sfx('close');
  const done=()=>{win.el.remove();this.wins.delete(win.id);
    if(this.focusedId===win.id){this.focusedId=null;const next=[...this.wins.values()].filter(w=>!w.minimized&&!w.closing).sort((a,b)=>(+b.el.style.zIndex)-(+a.el.style.zIndex))[0];if(next)this.focus(next);}
    bus.emit('wins');};
  if(instant||!settings.animations)done();else{win.el.classList.add('closing');setTimeout(done,190);}
},
closeAll(){[...this.wins.values()].forEach(w=>this.close(w,true));},
resizeTo(win,w,h){if(win.state!=='normal')return;const app=Apps[win.app];
  win.w=clamp(w,app.minW||300,innerWidth-16);win.h=clamp(h,app.minH||220,this.workH()-12);
  win.x=clamp(win.x,4,innerWidth-win.w-4);win.y=clamp(win.y,4,this.workH()-win.h-4);
  win.prev={x:win.x,y:win.y,w:win.w,h:win.h};this.setState(win,'normal');},
onViewport(){_wbT=0;const vw=innerWidth,vh=this.workH();
  document.documentElement.classList.toggle('mobile',isMobile());
  this.wins.forEach(win=>{
    if(isMobile()){if(win.state!=='max')this.setState(win,'max',true);}
    else if(win.state!=='normal'){this.setState(win,win.state,true);}
    else{win.w=Math.min(win.w,vw-12);win.h=Math.min(win.h,vh-8);win.x=clamp(win.x,-win.w+90,vw-90);win.y=clamp(win.y,0,vh-40);this.applyRect(win);win.api?.onResize?.();}
  });}
};