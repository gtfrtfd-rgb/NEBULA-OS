import {$,esc} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {Audio} from '../core/audio.js';
import {bus} from '../core/bus.js';
import {notify} from '../core/notifications.js';
import {promptDlg,choiceDlg} from '../core/dialogs.js';
import {nodeAt,findPathById,addNode,mkText,parentPath,baseName,saveVfs,uniqueName} from '../core/vfs.js';

export default {name:'Блокнот',icon:'edit',g:['#4f8dff','#7c6bff'],w:640,h:490,minW:380,minH:280,perFile:true,
findExisting(params,wins){
  if(params.id)return null;
  return wins.find(w=>w.api?.isPristine?.())||null;
},
mount(body,win,params){
  let fileId=params.id||null;
  let node=fileId?nodeAt(findPathById(fileId)):null;
  if(fileId&&!node){notify('warn','Файл не найден','Документ больше не существует — открыт новый черновик.');fileId=null;}
  let orphan=false,dirty=false,preview=false,savedAt=node?node.mtime:0;

  body.innerHTML=`
  <div class="toolbar">
    <button class="btn primary sm ed-save">${icon('save',14)} Сохранить <kbd style="margin-left:2px">Ctrl+S</kbd></button>
    <button class="btn sm ed-saveas">${icon('fileplus',14)} Сохранить как…</button>
    <button class="btn sm ed-prev">${icon('eye',14)} Просмотр</button>
    <span class="grow"></span><span class="dirty-dot" style="display:none"></span><span class="ed-name" style="font-size:11.5px;color:var(--faint);font-weight:700;max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
  </div>
  <textarea class="ed-area selectable" spellcheck="false" placeholder="Начните писать…"></textarea>
  <div class="ed-preview selectable" style="display:none"></div>
  <div class="statusbar"><span class="ed-stats"></span><span class="grow"></span><span class="ed-state"></span></div>`;
  const ta=$('.ed-area',body),pv=$('.ed-preview',body);
  ta.value=node?(node.content||''):'';

  function docName(){return node?node.name:(orphan?'(удалён)':'Без имени');}
  function title(){
    win.setTitle(`Блокнот — ${docName()}${dirty?' •':''}`);
    $('.ed-name',body).textContent=fileId?(findPathById(fileId)||'файл удалён'):'черновик';
  }
  function stats(){
    const t=ta.value;
    $('.ed-stats',body).textContent=`${t.length} симв · ${t.trim()?t.trim().split(/\s+/).length:0} слов · ${t.split('\n').length} строк`;
    $('.dirty-dot',body).style.display=dirty?'':'none';
    let s;
    if(orphan)s='<span style="color:var(--red)">файл удалён — «Сохранить как…»</span>';
    else if(dirty)s='<span style="color:var(--amber)">не сохранено</span>';
    else if(!fileId)s='<span style="color:var(--faint)">черновик · Ctrl+S создаст файл</span>';
    else s=`сохранено ${new Date(savedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;
    $('.ed-state',body).innerHTML=s;
  }
  function md(src){
    const lines=esc(src).split('\n');let html='',inCode=false,inList=false;
    const inline=s=>s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>');
    for(const l of lines){
      if(l.startsWith('```')){if(inCode){html+='</pre>';inCode=false;}else{if(inList){html+='</ul>';inList=false;}html+='<pre>';inCode=true;}continue;}
      if(inCode){html+=l+'\n';continue;}
      const li=l.match(/^\s*[-*]\s+(.*)/);
      if(li){if(!inList){html+='<ul>';inList=true;}
        const txt=li[1].replace(/^\[x\]\s*/i,'☑ ').replace(/^\[ \]\s*/,'☐ ');
        html+='<li>'+inline(txt)+'</li>';continue;}
      if(inList){html+='</ul>';inList=false;}
      if(/^###\s/.test(l))html+='<h3>'+inline(l.slice(4))+'</h3>';
      else if(/^##\s/.test(l))html+='<h2>'+inline(l.slice(3))+'</h2>';
      else if(/^#\s/.test(l))html+='<h1>'+inline(l.slice(2))+'</h1>';
      else if(/^---\s*$/.test(l))html+='<hr>';
      else if(/^&gt;\s?/.test(l))html+='<blockquote>'+inline(l.replace(/^&gt;\s?/,''))+'</blockquote>';
      else if(l.trim())html+='<p>'+inline(l)+'</p>';}
    if(inCode)html+='</pre>';if(inList)html+='</ul>';return html;
  }
  function renderPreview(){pv.innerHTML=md(ta.value);}
  function suggestPath(){
    const dirPath=nodeAt('/Документы')?'/Документы':'/';
    const dir=nodeAt(dirPath);
    return (dirPath==='/'?'':dirPath)+'/'+uniqueName(dir,'заметка.txt');
  }
  async function saveAs(){
    const start=fileId?(findPathById(fileId)||suggestPath()):suggestPath();
    const p=await promptDlg({title:'Сохранить документ',label:'Путь внутри NEBULA — папка должна существовать:',value:start,ok:'Сохранить'});
    if(!p)return false;
    const dirPath=parentPath(p),dir=nodeAt(dirPath),nm=baseName(p);
    if(!dir||dir.type!=='dir'){notify('error','Папка не найдена',`«${dirPath||'/'}» не существует.`);return false;}
    if(!nm){notify('error','Некорректное имя','Укажите имя файла.');return false;}
    const ex=dir.children.find(c=>c.name===nm);
    if(ex&&ex.type!=='text'){notify('error','Имя занято',`«${nm}» — не текстовый файл.`);return false;}
    if(ex){ex.content=ta.value;ex.mtime=Date.now();node=ex;fileId=ex.id;saveVfs(ex);bus.emit('vfs');}
    else{node=addNode(dirPath,mkText(nm,ta.value));if(!node)return false;fileId=node.id;}
    api.fileId=fileId;
    savedAt=Date.now();dirty=false;orphan=false;
    title();stats();
    notify('success','Документ сохранён',`«${node.name}» → ${dirPath||'/'}`);
    return true;
  }
  async function save(){
    const alive=fileId?nodeAt(findPathById(fileId)):null;
    if(!alive)return await saveAs();
    node=alive;node.content=ta.value;node.mtime=Date.now();
    savedAt=node.mtime;dirty=false;orphan=false;
    saveVfs(node);bus.emit('vfs');Audio.sfx('tick');
    title();stats();return true;
  }
  async function beforeClose(){
    if(!dirty)return true;
    const r=await choiceDlg({
      title:'Несохранённые изменения',
      msg:`«${docName()}» изменён. Сохранить документ перед закрытием?`,
      choices:[{label:'Сохранить',value:'save',kind:'primary'},{label:'Не сохранять',value:'discard',kind:'danger'},{label:'Отмена',value:null}]
    });
    if(r==='save'){await save();return !dirty;}
    return r==='discard';
  }

  ta.addEventListener('input',()=>{dirty=true;stats();title();if(preview)renderPreview();});
  $('.ed-save',body).addEventListener('click',()=>{save();});
  $('.ed-saveas',body).addEventListener('click',()=>{saveAs();});
  $('.ed-prev',body).addEventListener('click',()=>{preview=!preview;
    $('.ed-prev',body).classList.toggle('on',preview);
    ta.style.display=preview?'none':'';pv.style.display=preview?'':'none';
    if(preview)renderPreview();else ta.focus();});
  win.keyHandler=e=>{if(e.ctrlKey&&e.code==='KeyS'){e.preventDefault();save();}};

  const off=bus.on('vfs',()=>{
    if(!fileId)return;
    const alive=nodeAt(findPathById(fileId));
    if(alive){node=alive;orphan=false;}
    else if(node){node=null;orphan=true;}
    title();stats();
  });

  const api={fileId,isPristine:()=>!fileId&&!dirty&&ta.value==='',beforeClose,onClose:off};
  title();stats();setTimeout(()=>ta.focus(),80);
  return api;
}};