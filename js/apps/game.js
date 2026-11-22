import {$,el,fmtSec,clamp,isMobile} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {store} from '../core/store.js';
import {notify} from '../core/notifications.js';
import {Audio} from '../core/audio.js';
import {WM} from '../wm.js';

export default {name:'Сапёр',icon:'bomb',g:['#ff5470','#ff9f43'],w:400,h:560,minW:330,minH:420,single:true,center:true,
mount(body,win){
  const DIFFS={novice:{name:'Новичок',cols:9,rows:9,mines:10},amateur:{name:'Любитель',cols:16,rows:16,mines:40},expert:{name:'Эксперт',cols:20,rows:14,mines:55}};
  let diff='novice',cells=[],started=false,over=false,flags=0,revealed=0,time=0,timer=null,flagMode=false,timeouts=[],cellPx=30;
  let best=store.get('nebula.best.v1',{});
  body.innerHTML=`<div class="game">
    <div class="g-head">
      <span class="g-stat g-mines">${icon('bomb',15)}<b>10</b></span>
      <button class="g-face" title="Новая игра">🙂</button>
      <span class="g-stat g-time">${icon('clock',15)}<b>0:00</b></span>
    </div>
    <div class="g-board-wrap"><div class="g-board"></div></div>
    <div class="g-foot">
      <select class="sel g-diff"><option value="novice">Новичок · 9×9</option><option value="amateur">Любитель · 16×16</option><option value="expert">Эксперт · 20×14</option></select>
      <button class="g-flagbtn">${icon('flag',13)} Флажки</button>
      <span class="grow"></span><span class="g-best"></span>
    </div></div>`;
  const board=$('.g-board',body),wrap=$('.g-board-wrap',body);
  function fitCell(){
    const d=DIFFS[diff];
    const availW=wrap.clientWidth-28,availH=wrap.clientHeight-28;
    cellPx=clamp(Math.floor(Math.min((availW-(d.cols-1)*2.5)/d.cols,(availH-(d.rows-1)*2.5)/d.rows)),17,36);
    board.style.setProperty('--cell',cellPx+'px');
    board.style.setProperty('--cols',d.cols);
  }
  function reset(){
    timeouts.forEach(clearTimeout);timeouts=[];clearInterval(timer);timer=null;
    started=false;over=false;flags=0;revealed=0;time=0;
    const d=DIFFS[diff];
    cells=Array.from({length:d.cols*d.rows},()=>({mine:false,rev:false,flag:false,n:0}));
    board.innerHTML=cells.map((_,i)=>`<button class="cell" data-i="${i}" data-snd-skip aria-label="клетка"></button>`).join('');
    $('.g-face',body).textContent='🙂';$('.g-time b',body).textContent='0:00';
    $('.g-mines b',body).textContent=d.mines;
    $('.g-best',body).textContent=best[diff]?`рекорд: ${fmtSec(best[diff])}`:'рекорда пока нет';
    $('.g-over',wrap)?.remove();
    requestAnimationFrame(fitCell);
  }
  function neighbors(i){const d=DIFFS[diff],x=i%d.cols,y=Math.floor(i/d.cols),out=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
      if(nx>=0&&nx<d.cols&&ny>=0&&ny<d.rows)out.push(ny*d.cols+nx);}return out;}
  function plant(safe){const d=DIFFS[diff];const banned=new Set([safe,...neighbors(safe)]);
    const pool=cells.map((_,i)=>i).filter(i=>!banned.has(i));
    for(let m=0;m<d.mines;m++){const j=Math.floor(Math.random()*pool.length);cells[pool.splice(j,1)[0]].mine=true;}
    cells.forEach((c,i)=>{c.n=neighbors(i).filter(n=>cells[n].mine).length;});}
  function cellEl(i){return board.children[i];}
  /* размер иконки берётся из кэша — никаких чтений layout на каждую клетку */
  function paintCell(i){
    const c=cells[i],e=cellEl(i);if(!e)return;
    e.className='cell'+(c.rev?' rev':'')+(c.flag?' flag':'')+(c.rev&&c.n&&!c.mine?' n'+c.n:'');
    const s=Math.round(cellPx*.5)||14;
    e.innerHTML=c.flag?icon('flag',s):c.rev?(c.mine?icon('bomb',Math.round(cellPx*.55)||15):(c.n||'')):'';
    if(c.rev&&c.mine)e.classList.add('mine');
  }
  function reveal(i){const stack=[i];
    while(stack.length){const j=stack.pop();const c=cells[j];
      if(c.rev||c.flag)continue;c.rev=true;revealed++;paintCell(j);
      if(c.n===0&&!c.mine)neighbors(j).forEach(n=>{if(!cells[n].rev&&!cells[n].flag)stack.push(n);});}}
  function tick(){time=Math.min(999,time+1);$('.g-time b',body).textContent=fmtSec(time);}
  function checkWin(){const d=DIFFS[diff];
    if(revealed===d.cols*d.rows-d.mines){over=true;clearInterval(timer);
      cells.forEach((c,i)=>{if(c.mine&&!c.flag){c.flag=true;flags++;paintCell(i);}});
      $('.g-mines b',body).textContent=0;$('.g-face',body).textContent='😎';Audio.sfx('win');
      let rec='';if(!best[diff]||time<best[diff]){best[diff]=time;store.set('nebula.best.v1',best);rec=' Новый рекорд!';$('.g-best',body).textContent=`рекорд: ${fmtSec(time)}`;}
      showOver('🏆','Победа!',`Поле очищено за ${fmtSec(time)}.${rec}`);
      notify('success','Сапёр: победа!',`${DIFFS[diff].name} — ${fmtSec(time)}.${rec}`);}}
  function lose(boomIdx){over=true;clearInterval(timer);$('.g-face',body).textContent='😵';Audio.sfx('boom');
    cells[boomIdx].rev=true;paintCell(boomIdx);cellEl(boomIdx)?.classList.add('boom');
    let k=0;cells.forEach((c,i)=>{if(i===boomIdx)return;
      if(c.mine&&!c.flag){timeouts.push(setTimeout(()=>{if(!cells[i])return;c.rev=true;paintCell(i);},80+k*22));k++;}
      else if(c.flag&&!c.mine){timeouts.push(setTimeout(()=>{cellEl(i)?.classList.add('wrong');},80+k*22));}});
    timeouts.push(setTimeout(()=>showOver('💥','Взрыв!','Мина оказалась ближе, чем казалось. Попробуйте ещё раз.'),400+k*22));}
  function showOver(emoji,title,text){if($('.g-over',wrap))return;
    const o=el(`<div class="g-over"><div class="g-over-card"><div class="big">${emoji}</div><h3>${title}</h3><p>${text}</p><button class="btn primary g-again">${icon('restart',14)} Ещё раз</button></div></div>`);
    wrap.appendChild(o);$('.g-again',o).addEventListener('click',reset);}
  function act(i,flag){
    if(over)return;const c=cells[i];if(!c)return;
    if(flag){if(c.rev)return;c.flag=!c.flag;flags+=c.flag?1:-1;
      $('.g-mines b',body).textContent=DIFFS[diff].mines-flags;paintCell(i);Audio.sfx('flag');return;}
    if(c.flag)return;
    if(!started){started=true;plant(i);timer=setInterval(tick,1000);}
    if(c.rev){
      if(c.n>0){const ns=neighbors(i);const fl=ns.filter(n=>cells[n].flag).length;
        if(fl===c.n){let boom=null;ns.forEach(n=>{if(!cells[n].flag&&!cells[n].rev){if(cells[n].mine)boom=n;else reveal(n);}});
          if(boom!==null)lose(boom);else{Audio.sfx('reveal');checkWin();}}}
      return;}
    if(c.mine){lose(i);return;}
    reveal(i);Audio.sfx('reveal');checkWin();}
  board.addEventListener('click',e=>{const b=e.target.closest('.cell');if(!b)return;act(+b.dataset.i,flagMode);});
  board.addEventListener('contextmenu',e=>{e.preventDefault();const b=e.target.closest('.cell');if(b)act(+b.dataset.i,true);});
  board.addEventListener('dblclick',e=>{const b=e.target.closest('.cell');if(!b)return;const i=+b.dataset.i;if(cells[i].rev)act(i,false);});
  board.addEventListener('pointerdown',e=>{if(!over&&e.target.closest('.cell'))$('.g-face',body).textContent='😮';});
  board.addEventListener('pointerup',()=>{if(!over)$('.g-face',body).textContent='🙂';});
  $('.g-face',body).addEventListener('click',reset);
  $('.g-diff',body).addEventListener('change',e=>{diff=e.target.value;reset();
    const sizes={novice:[400,560],amateur:[520,660],expert:[560,560]};
    if(!isMobile())WM.resizeTo(win,sizes[diff][0],sizes[diff][1]);});
  $('.g-flagbtn',body).addEventListener('click',()=>{flagMode=!flagMode;$('.g-flagbtn',body).classList.toggle('on',flagMode);});
  reset();
  return{onClose(){clearInterval(timer);timeouts.forEach(clearTimeout);},onResize:fitCell};
}};