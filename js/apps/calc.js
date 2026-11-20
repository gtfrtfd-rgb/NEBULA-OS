import {$,esc} from '../core/utils.js';
import {Audio} from '../core/audio.js';

export default {name:'Калькулятор',icon:'calc',g:['#34e0a1','#22d3ee'],w:330,h:540,minW:290,minH:460,single:true,center:true,
mount(body,win){
  let acc=null,op=null,cur='0',fresh=true,error=false;const hist=[];
  body.innerHTML=`<div class="calc">
    <div class="calc-disp"><div class="calc-expr"></div><div class="calc-main">0</div></div>
    <div class="calc-hist"></div>
    <div class="calc-keys">
      <button class="ckey clear" data-k="C">C</button><button class="ckey op" data-k="±">±</button><button class="ckey op" data-k="%">%</button><button class="ckey op" data-k="/">÷</button>
      <button class="ckey" data-k="7">7</button><button class="ckey" data-k="8">8</button><button class="ckey" data-k="9">9</button><button class="ckey op" data-k="*">×</button>
      <button class="ckey" data-k="4">4</button><button class="ckey" data-k="5">5</button><button class="ckey" data-k="6">6</button><button class="ckey op" data-k="-">−</button>
      <button class="ckey" data-k="1">1</button><button class="ckey" data-k="2">2</button><button class="ckey" data-k="3">3</button><button class="ckey op" data-k="+">+</button>
      <button class="ckey wide" data-k="0">0</button><button class="ckey" data-k=".">,</button><button class="ckey eq" data-k="=">=</button>
    </div></div>`;
  const main=$('.calc-main',body),expr=$('.calc-expr',body),histEl=$('.calc-hist',body);
  const sym={'+':'+','-':'−','*':'×','/':'÷'};
  const fmt=n=>{if(!isFinite(n))return'Ошибка';let s=parseFloat(n.toPrecision(12)).toString();if(s.length>14)s=n.toExponential(6);return s;};
  function render(){main.textContent=cur.replace('.',',');main.classList.toggle('small',cur.length>10);main.classList.toggle('error',error);
    expr.textContent=op?`${fmt(acc).replace('.',',')} ${sym[op]}${fresh?'':' '+cur.replace('.',',')}`:'';}
  function apply(a,b,o){switch(o){case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':return b===0?NaN:a/b;}}
  function press(k){
    if(error&&k!=='C'){cur='0';error=false;fresh=true;}
    if(/[0-9]/.test(k)){cur=fresh?k:(cur==='0'?k:cur+k);if(cur.replace(/[-.]/g,'').length>14)return render();fresh=false;}
    else if(k==='.'){if(fresh){cur='0.';fresh=false;}else if(!cur.includes('.'))cur+='.';}
    else if(k==='C'){acc=null;op=null;cur='0';fresh=true;error=false;}
    else if(k==='±'){if(cur!=='0')cur=cur.startsWith('-')?cur.slice(1):'-'+cur;}
    else if(k==='%'){const v=parseFloat(cur);cur=fmt(op&&acc!==null?acc*v/100:v/100);fresh=true;}
    else if(k==='back'){if(!fresh&&cur.length>1)cur=cur.slice(0,-1);else{cur='0';fresh=true;}}
    else if(['+','-','*','/'].includes(k)){
      if(op&&!fresh){const r=apply(acc,parseFloat(cur),op);if(!isFinite(r)){error=true;cur='Ошибка';acc=null;op=null;fresh=true;Audio.sfx('error');return render();}acc=r;cur=fmt(r);}
      else acc=parseFloat(cur);
      op=k;fresh=true;}
    else if(k==='='){
      if(op){const b=parseFloat(cur);const r=apply(acc,b,op);
        const line=`${fmt(acc).replace('.',',')} ${sym[op]} ${fmt(b).replace('.',',')}`;
        if(!isFinite(r)){error=true;cur='Ошибка';Audio.sfx('error');}
        else{cur=fmt(r);hist.unshift({line,res:cur});if(hist.length>7)hist.pop();renderHist();}
        acc=null;op=null;fresh=true;}}
    render();}
  function renderHist(){histEl.innerHTML=hist.map((h,i)=>`<button class="ch-row" data-i="${i}"><span>${esc(h.line)} =</span><b>${esc(h.res.replace('.',','))}</b></button>`).join('');}
  histEl.addEventListener('click',e=>{const b=e.target.closest('.ch-row');if(!b)return;cur=hist[+b.dataset.i].res;fresh=true;render();});
  $('.calc-keys',body).addEventListener('click',e=>{const b=e.target.closest('.ckey');if(b)press(b.dataset.k);});
  win.keyHandler=e=>{
    if(e.target.matches('input,textarea'))return;
    const k=e.key;
    if(/^[0-9]$/.test(k)||['+','-','*','/','.','%'].includes(k)){e.preventDefault();press(k);}
    else if(k==='Enter'||k==='='){e.preventDefault();press('=');}
    else if(k==='Backspace'){e.preventDefault();press('back');}
    else if(k==='Escape'||k==='Delete'){e.preventDefault();press('C');}
    else if(k===','){e.preventDefault();press('.');}};
  render();
  return{};
}};