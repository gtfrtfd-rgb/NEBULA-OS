import {$,esc,icon} from '../core/utils.js';
import {Audio} from '../core/audio.js';
import {bus} from '../core/bus.js';
import {notify} from '../core/notifications.js';
import {promptDlg} from '../core/dialogs.js';
import {nodeAt,findPathById,addNode,mkText,parentPath,baseName,saveVfs} from '../core/vfs.js';

export default {name:'Блокнот',icon:'edit',g:['#4f8dff','#7c6bff'],w:640,h:490,minW:380,minH:280,perFile:true,
mount(body,win,params){
  let fileId=params.id||null;
  let node=fileId?nodeAt(findPathById(fileId)):null;
  if(!node){node=addNode('/Документы',mkText('заметка.txt',''));fileId=node.id;}
  let dirty=false,preview=false,savedAt=node.mtime;
  body.innerHTML=`
  <div class="toolbar">
    <button class="btn primary sm ed-save">${icon('save',14)} Сохранить <kbd style="margin-left:2px">Ctrl+S</kbd></button>
    <button class="btn sm ed-saveas">${icon('fileplus',14)} Сохранить как…</button>
    <button class="btn sm ed-prev">${icon('eye',14)} Просмотр</button>
    <span class="grow"></span><span class="dirty-dot" style="display:none"></span><span class="ed-name" style="font-size:11.5px;color:var(--faint);font-weight:700"></span>
  </div>
  <textarea class="ed-area selectable" spellcheck="false" placeholder="Начните писать…"></textarea>
  <div class="ed-preview selectable" style="display:none"></div>
  <div class="statusbar"><span class="ed-stats"></span><span class="grow"></span><span class="ed-state"></span></div>`;
  const ta=$('.ed-area',body),pv=$('.ed-preview',body);
  ta.value=node.content||'';
  function title(){win.setTitle(`Блокнот — ${node?node.name:'?'}${dirty?' •':''}`);$('.ed-name',body).textContent=node?findPathById(fileId)||'(удалён)':'';}
  function stats(){const t=ta.value;$('.ed-stats',body).textContent=`${t.length} симв · ${t.trim()?t.trim().split(/\s+/).length:0} слов · ${t.split('\n').length} строк`;
    $('.dirty-dot',body).style.display=dirty?'':'none';
    $('.ed-state',body).innerHTML=dirty?'<span style="color:var(--amber)">не сохранено</span>':`сохранено ${new Date(savedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;}
  function md(src){
    const lines=esc(src).split('\n');let html='',inCode=false,inList=false;
    const inline=s=>s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>');
    for(const l of lines){
      if(l.startsWith('```')){if(inCode){html+='</pre>';inCode=false;}else{if(inList){html+='</ul>';inList=false;}html+='<pre>';inCode=true;}continue;}
      if(inCode){html+=l+'\n';continue;}
      const li=l.match(/^\s*[-*]\s+(.*)/);
      if(li){if(!inList){html+='<ul>';inList=true;}
        let txt=li[1].replace(/^\[x\]\s*/i,'☑ ').replace(/^\[ \]\s*/,'☐ ');
        html+='<li>'+inline(txt)+'</li>';continue;}
      if(inList){html+='</ul>';inList=false;}
      if(/^###\s/.test(l))html+='<h3>'+inline(l.slice(4))+'</h3>';
      else if(/^##\s/.test(l))html+='<h2>'+inline(l.slice(3))+'</h2>';
      else if(/^#\s/.test(l))html+='<h1>'+inline(l.slice(2))+'</h1>';
      else if(/^---\s*$/.test(l))html+='<hr>';
      else if(/^&gt;\s?/.test(l))html+='<blockquote>'+inline(l.replace(/^&gt;\s?/,''))+'</blockquote>';
      else if(l.trim())html+='<p>'+inline(l)+'</p>';}
    if(inCode)html+='</pre>';if(inList)html+='</ul>';return html;}
  function renderPreview(){pv.innerHTML=md(ta.value);}
  function save(){
    node=nodeAt(findPathById(fileId));
    if(!node){saveAs();return;}
    node.content=ta.value;node.mtime=Date.now();savedAt=node.mtime;dirty=false;
    if(saveVfs()){bus.emit('vfs');Audio.sfx('tick');}
    title();stats();}
  async function saveAs(){
    const cur=node?node.name:'заметка.txt';
    const p=await promptDlg({title:'Сохранить как…',label:'Путь внутри NEBULA (папка должна существовать):',value:node?findPathById(fileId)||'/Документы/'+cur:'/Документы/'+cur,ok:'Сохранить'});
    if(!p)return;const dir=nodeAt(parentPath(p));
    if(!dir||dir.type!=='dir'){notify('error','Папка не найдена',`«${parentPath(p)}» не существует.`);return;}
    const ex=dir.children.find(c=>c.name===baseName(p));
    if(ex&&ex.type==='text'){ex.content=ta.value;ex.mtime=Date.now();fileId=ex.id;node=ex;}
    else if(ex){notify('error','Имя занято',`«${baseName(p)}» — не текстовый файл.`);return;}
    else{node=addNode(parentPath(p),mkText(baseName(p),ta.value));fileId=node.id;}
    savedAt=Date.now();dirty=false;saveVfs();bus.emit('vfs');title();stats();
    notify('success','Сохранено',`Файл «${node.name}» записан в ${parentPath(p)||'/'}.`);}
  ta.addEventListener('input',()=>{dirty=true;stats();title();if(preview)renderPreview();});
  $('.ed-save',body).addEventListener('click',save);
  $('.ed-saveas',body).addEventListener('click',saveAs);
  $('.ed-prev',body).addEventListener('click',()=>{preview=!preview;
    $('.ed-prev',body).classList.toggle('on',preview);
    ta.style.display=preview?'none':'';pv.style.display=preview?'':'none';
    if(preview)renderPreview();else ta.focus();});
  win.keyHandler=e=>{if(e.ctrlKey&&e.code==='KeyS'){e.preventDefault();save();}};
  const off=bus.on('vfs',()=>{const alive=nodeAt(findPathById(fileId));
    if(!alive&&node){node=null;title();$('.ed-state',body).innerHTML='<span style="color:var(--red)">файл удалён — «Сохранить как…»</span>';}
    else if(alive){node=alive;title();}});
  title();stats();setTimeout(()=>ta.focus(),80);
  return{fileId,onClose:off};
}};