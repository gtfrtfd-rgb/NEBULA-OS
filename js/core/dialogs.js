import {$,$$,el,esc} from './utils.js';

let dlgResolve=null;
export function dialogOpen(){return $('#dialogLayer').classList.contains('open');}
export function cancelDialog(){if(dlgResolve)dlgResolve(null);}

function dialogBase(html){
  const layer=$('#dialogLayer');layer.innerHTML='';layer.classList.add('open');const d=el(html);layer.appendChild(d);
  return new Promise(res=>{dlgResolve=v=>{layer.classList.remove('open');layer.innerHTML='';layer.onpointerdown=null;dlgResolve=null;res(v);};
    layer.onpointerdown=e=>{if(e.target===layer)dlgResolve(null);};
    $('.dlg-cancel',d)?.addEventListener('click',()=>dlgResolve(null));});
}
export function confirmDlg({title,msg,ok='Подтвердить',danger=false}){
  const p=dialogBase(`<div class="dialog"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="dlg-actions"><button class="btn dlg-cancel">Отмена</button><button class="btn ${danger?'danger':'primary'} dlg-ok">${esc(ok)}</button></div></div>`);
  setTimeout(()=>{const b=$('.dlg-ok');b?.addEventListener('click',()=>dlgResolve(true));b?.focus();},0);return p;
}
export function promptDlg({title,label='',value='',ok='Сохранить'}){
  const p=dialogBase(`<div class="dialog"><h3>${esc(title)}</h3>${label?`<p>${esc(label)}</p>`:''}<input class="dlg-inp" value="${esc(value)}" spellcheck="false"><div class="dlg-actions"><button class="btn dlg-cancel">Отмена</button><button class="btn primary dlg-ok">${esc(ok)}</button></div></div>`);
  setTimeout(()=>{const i=$('.dlg-inp'),b=$('.dlg-ok');const submit=()=>dlgResolve(i.value.trim()||null);
    b?.addEventListener('click',submit);i?.addEventListener('keydown',e=>{if(e.key==='Enter')submit();e.stopPropagation();});i?.focus();i?.select();},0);return p;
}
export function choiceDlg({title,msg,choices}){
  const p=dialogBase(`<div class="dialog"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="dlg-actions">${choices.map((c,i)=>`<button class="btn ${c.kind==='primary'?'primary':c.kind==='danger'?'danger':''} ${c.value===null?'dlg-cancel':''}" data-i="${i}">${esc(c.label)}</button>`).join('')}</div></div>`);
  setTimeout(()=>{const btns=$$('.dlg-actions .btn');
    btns.forEach(b=>{if(b.classList.contains('dlg-cancel'))return;b.addEventListener('click',()=>dlgResolve(choices[+b.dataset.i].value));});
    btns[0]?.focus();},0);
  return p;
}