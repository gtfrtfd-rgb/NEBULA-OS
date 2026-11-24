import {$,$$,esc,el,fmtBytes,relTime,isCoarse} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {settings,setSetting} from '../core/settings.js';
import {bus} from '../core/bus.js';
import {notify} from '../core/notifications.js';
import {openContext} from '../core/context.js';
import {openFileNode} from '../core/launch.js';
import {normPath,parentPath,baseName,nodeAt,nodeSize,addNode,removeNode,restoreNode,renameNode,findPathById,recentFiles,mkDir,mkText} from '../core/vfs.js';

/* кэш уменьшенных превью: большие PNG не декодируются на каждый рендер */
const thumbCache=new Map();
const thumbPending=new Set();

export default {name:'Файлы',icon:'folder',g:['#ffb454','#ff6a3d'],w:780,h:520,minW:420,minH:300,
mount(body,win,params){
  let path=params.path&&nodeAt(params.path)?params.path:'/';
  let view=settings.explorerView,sort=settings.explorerSort,asc=settings.explorerAsc,query='',recent=path==='@recent';
  if(recent)path='/';
  let sel=new Set(),pending=false,vfsTimer=null;
  body.innerHTML=`
  <div class="toolbar">
    <button class="ibtn nav-up" title="Вверх">${icon('up',16)}</button>
    <div class="crumbs"></div>
    <button class="ibtn new-dir" title="Новая папка">${icon('folderplus',16)}</button>
    <button class="ibtn new-file" title="Новый файл">${icon('fileplus',16)}</button>
    <button class="ibtn ren" title="Переименовать (F2)" disabled>${icon('edit',15)}</button>
    <button class="ibtn del" title="Удалить (Delete)" disabled>${icon('trash',15)}</button>
    <select class="sel sort-sel" title="Сортировка"><option value="name">Имя</option><option value="mtime">Дата</option><option value="type">Тип</option></select>
    <button class="ibtn asc-btn" title="Порядок">${icon('sort',15)}</button>
    <div class="seg view-seg"><button data-v="grid" title="Плитка">${icon('grid',14)}</button><button data-v="list" title="Список">${icon('list',14)}</button></div>
    <input class="inp exp-search" placeholder="Поиск…" style="width:110px">
  </div>
  <div class="exp">
    <div class="exp-side"></div>
    <div class="exp-main"><div class="exp-items"></div>
      <div class="statusbar"><span class="st-count"></span><span class="grow"></span><span class="st-sel"></span></div>
    </div>
  </div>`;
  const items=$('.exp-items',body),crumbs=$('.crumbs',body),side=$('.exp-side',body);
  $('.sort-sel',body).value=sort;
  const NAV=[['/','home','Обзор'],['/Документы','file','Документы'],['/Изображения','image','Изображения'],['/Музыка','music','Музыка'],['/Система','hdd','Система'],['@recent','clock','Недавние']];

  const nameOf=n=>(n&&typeof n.name==='string'&&n.name.trim())?n.name:'Без имени';

  function thumbSrc(n){
    const key=n.id+':'+n.mtime;
    if(thumbCache.has(key))return thumbCache.get(key);
    if(!thumbPending.has(key)){
      thumbPending.add(key);
      const im=new Image();
      im.onload=()=>{
        thumbPending.delete(key);
        try{
          const tw=128,th=Math.max(1,Math.round(im.height/im.width*tw));
          const c=document.createElement('canvas');c.width=tw;c.height=th;
          c.getContext('2d').drawImage(im,0,0,tw,th);
          const url=c.toDataURL('image/png');
          if(thumbCache.size>80)thumbCache.delete(thumbCache.keys().next().value);
          thumbCache.set(key,url);
          $$(`img[data-thumb="${key}"]`,items).forEach(el2=>{el2.src=url;});
        }catch(e){}
      };
      im.onerror=()=>thumbPending.delete(key);
      im.src=n.content;
    }
    return n.content;
  }
  function renderSide(){side.innerHTML=NAV.map(([p,i,n])=>`<button class="exp-nav ${(recent?p==='@recent':(!recent&&path===p))?'on':''}" data-p="${esc(p)}">${icon(i,15)}<span>${n}</span></button>`).join('');}
  side.addEventListener('click',e=>{const b=e.target.closest('.exp-nav');if(!b)return;const p=b.dataset.p;
    if(p==='@recent'){recent=true;}else{recent=false;path=nodeAt(p)?p:'/';}sel.clear();render();});
  function currentItems(){
    let list;
    if(recent)list=recentFiles(14).map(x=>x.node);
    else{const dir=nodeAt(path);if(!dir||dir.type!=='dir'){path='/';return currentItems();}list=[...dir.children];}
    if(query)list=list.filter(n=>nameOf(n).toLowerCase().includes(query.toLowerCase()));
    list.sort((a,b)=>{const da=a.type==='dir'?0:1,db=b.type==='dir'?0:1;if(da!==db)return da-db;
      let r=0;if(sort==='name')r=nameOf(a).localeCompare(nameOf(b),'ru');else if(sort==='mtime')r=a.mtime-b.mtime;else r=(a.type===b.type?nameOf(a).localeCompare(nameOf(b),'ru'):a.type.localeCompare(b.type));
      return asc?r:-r;});
    return list;}
  function fileIcon(n){
    if(n.type==='dir')return`<span class="fi" style="background:linear-gradient(135deg,#ffb454,#ff6a3d)">${icon('folder',22)}</span>`;
    if(n.type==='image'){const key=n.id+':'+n.mtime;
      return`<span class="fi thumb"><img data-thumb="${key}" src="${thumbSrc(n)}" alt="${esc(nameOf(n))}" loading="lazy" decoding="async"></span>`;}
    return`<span class="fi" style="background:linear-gradient(135deg,#4f8dff,#7c6bff)">${icon('file',20)}</span>`;}
  function render(){
    pending=false;
    renderSide();
    crumbs.innerHTML='';
    if(recent){crumbs.appendChild(el(`<button class="crumb">${icon('clock',12)} Недавние</button>`));}
    else{const parts=path.split('/').filter(Boolean);let acc='';
      const root=el(`<button class="crumb">nebula</button>`);root.onclick=()=>{path='/';sel.clear();render();};crumbs.appendChild(root);
      parts.forEach(p=>{acc+='/'+p;const pp=acc;crumbs.appendChild(el(`<span class="crumb-sep">›</span>`));
        const b=el(`<button class="crumb">${esc(p)}</button>`);b.onclick=()=>{path=pp;sel.clear();render();};crumbs.appendChild(b);});}
    $('.nav-up',body).disabled=recent||path==='/';
    $('.new-dir',body).disabled=recent;$('.new-file',body).disabled=recent;
    $$('.view-seg button',body).forEach(b=>b.classList.toggle('on',b.dataset.v===view));
    items.className='exp-items '+view;
    const list=currentItems();
    items.innerHTML='';
    if(!list.length){items.appendChild(el(`<div class="exp-empty"><span class="big">${query?'🔭':'🌌'}</span><b>${query?'Ничего не найдено':'Здесь пока пусто'}</b><span>${query?'Попробуйте другой запрос — туманность большая.':'Создайте папку или файл кнопками на панели сверху. Или через терминал: touch идея.txt'}</span></div>`));}
    const frag=document.createDocumentFragment();
    list.forEach(n=>{
      const nm=nameOf(n);
      frag.appendChild(el(`<div class="fitem ${sel.has(n.id)?'sel':''}" data-id="${n.id}" tabindex="0" title="${esc(nm)}">
        ${fileIcon(n)}<span class="fname">${esc(nm)}</span>
        ${view==='list'?`<span class="fmeta">${n.type==='dir'?n.children.length+' эл.':fmtBytes(nodeSize(n))} · ${relTime(n.mtime)}</span>`:''}</div>`));});
    items.appendChild(frag);
    const cnt=list.length;
    $('.st-count',body).textContent=`${cnt} объект${cnt%10===1&&cnt%100!==11?'':cnt%10>=2&&cnt%10<=4&&(cnt%100<10||cnt%100>=20)?'а':'ов'}`;
    $('.st-sel',body).textContent=sel.size?`выбрано: ${sel.size}`:'';
    $('.ren',body).disabled=sel.size!==1;$('.del',body).disabled=sel.size===0;
    win.setTitle(recent?'Файлы — Недавние':(path==='/'?'Файлы':'Файлы — '+baseName(path)));
  }
  function pathOf(n){return recent?findPathById(n.id):normPath(path+'/'+n.name);}
  function openNode(n){const p=pathOf(n);if(p)openFileNode(n,p);}
  function startRename(it,n){
    const nameEl=$('.fname',it);
    if(!nameEl)return;
    const inp=el(`<input class="rename-inp" value="${esc(nameOf(n))}" spellcheck="false">`);
    nameEl.replaceWith(inp);inp.focus();
    const dot=n.name.lastIndexOf('.');inp.setSelectionRange(0,dot>0?dot:n.name.length);
    let done=false;
    const commit=()=>{if(done)return;done=true;const p=pathOf(n);if(inp.value.trim()&&inp.value!==n.name&&p)renameNode(p,inp.value);render();};
    inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')commit();if(e.key==='Escape'){done=true;render();}});
    inp.addEventListener('blur',commit);inp.addEventListener('pointerdown',e=>e.stopPropagation());inp.addEventListener('click',e=>e.stopPropagation());inp.addEventListener('dblclick',e=>e.stopPropagation());
  }
  items.addEventListener('click',e=>{
    const it=e.target.closest('.fitem');if(!it)return;
    const n=currentItems().find(x=>x.id===it.dataset.id);if(!n)return;
    if(e.ctrlKey||e.metaKey){sel.has(n.id)?sel.delete(n.id):sel.add(n.id);render();return;}
    sel=new Set([n.id]);
    if((isCoarse&&e.detail===1)||e.detail===0){openNode(n);return;}
    render();});
  items.addEventListener('dblclick',e=>{const it=e.target.closest('.fitem');if(!it)return;const n=currentItems().find(x=>x.id===it.dataset.id);if(n)openNode(n);});
  items.addEventListener('contextmenu',e=>{
    const it=e.target.closest('.fitem');
    if(!it){openContext(e.clientX,e.clientY,[
      {icon:'folderplus',label:'Новая папка',dis:recent,fn:createDir},
      {icon:'fileplus',label:'Новый файл',dis:recent,fn:createFile},'sep',
      {icon:'restart',label:'Обновить',fn:render}]);return;}
    const n=currentItems().find(x=>x.id===it.dataset.id);if(!n)return;
    if(!sel.has(n.id)){sel=new Set([n.id]);render();}
    openContext(e.clientX,e.clientY,[
      {icon:n.type==='dir'?'folder':'eye',label:'Открыть',fn:()=>openNode(n)},
      {icon:'edit',label:'Переименовать',kbd:'F2',dis:sel.size!==1,fn:()=>{const el2=$(`.fitem[data-id="${n.id}"]`,items);if(el2)startRename(el2,n);}},
      {icon:'download',label:'Скачать',dis:n.type==='dir',fn:()=>downloadNode(n)},'sep',
      {icon:'trash',label:sel.size>1?`Удалить (${sel.size})`:'Удалить',kbd:'Del',danger:true,fn:deleteSel}]);
  });
  function downloadNode(n){const a=document.createElement('a');
    if(n.type==='image'){a.href=n.content;}else{a.href=URL.createObjectURL(new Blob([n.content],{type:'text/plain;charset=utf-8'}));}
    a.download=nameOf(n);a.click();notify('success','Скачивание',`«${nameOf(n)}» отправлен в загрузки браузера.`);}
  function deleteSel(){
    const recs=[];sel.forEach(id=>{const n=currentItems().find(x=>x.id===id);if(!n)return;const p=pathOf(n);if(p){const r=removeNode(p);if(r)recs.push(r);}});
    if(!recs.length)return;sel.clear();render();
    notify('warn',recs.length>1?`Удалено объектов: ${recs.length}`:'Удалено',`«${nameOf(recs[0].node)}»${recs.length>1?' и ещё '+(recs.length-1):''} перемещён в пустоту.`,
      {label:'Отменить',fn:()=>{recs.forEach(restoreNode);notify('success','Восстановлено','Файлы вернулись на свои места.');}},7000);}
  function createDir(){const n=addNode(path,mkDir('Новая папка'));if(!n)return;render();
    const it=$(`.fitem[data-id="${n.id}"]`,items);if(it)startRename(it,n);}
  function createFile(){const n=addNode(path,mkText('новый файл.txt',''));if(!n)return;render();
    const it=$(`.fitem[data-id="${n.id}"]`,items);if(it)startRename(it,n);}
  $('.nav-up',body).addEventListener('click',()=>{if(!recent&&path!=='/'){path=parentPath(path);sel.clear();render();}});
  $('.new-dir',body).addEventListener('click',createDir);
  $('.new-file',body).addEventListener('click',createFile);
  $('.ren',body).addEventListener('click',()=>{if(sel.size!==1)return;const n=currentItems().find(x=>sel.has(x.id));const it=$(`.fitem[data-id="${n.id}"]`,items);if(n&&it)startRename(it,n);});
  $('.del',body).addEventListener('click',deleteSel);
  $('.sort-sel',body).addEventListener('change',e=>{sort=e.target.value;setSetting('explorerSort',sort);render();});
  $('.asc-btn',body).addEventListener('click',()=>{asc=!asc;setSetting('explorerAsc',asc);$('.asc-btn',body).style.transform=asc?'':'scaleY(-1)';render();});
  $('.asc-btn',body).style.transform=asc?'':'scaleY(-1)';
  $$('.view-seg button',body).forEach(b=>b.addEventListener('click',()=>{view=b.dataset.v;setSetting('explorerView',view);render();}));
  $('.exp-search',body).addEventListener('input',e=>{query=e.target.value;render();});
  win.keyHandler=e=>{
    if(e.target.matches('input,textarea'))return;
    if(e.key==='Delete'&&sel.size){e.preventDefault();deleteSel();}
    else if(e.key==='F2'&&sel.size===1){e.preventDefault();$('.ren',body).click();}
    else if(e.key==='Enter'&&sel.size===1){e.preventDefault();const n=currentItems().find(x=>sel.has(x.id));if(n)openNode(n);}
    else if(e.key==='Backspace'){e.preventDefault();$('.nav-up',body).click();}};

  const offVfs=bus.on('vfs',()=>{
    if(win.minimized){pending=true;return;}
    clearTimeout(vfsTimer);
    vfsTimer=setTimeout(()=>{
      if(win.closing)return;
      if(win.minimized){pending=true;return;}
      if(!recent&&!nodeAt(path))path='/';
      sel=new Set([...sel].filter(id=>findPathById(id)));
      render();
    },70);
  });
  const offWins=bus.on('wins',()=>{if(pending&&!win.minimized&&!win.closing){pending=false;render();}});
  render();
  return{onClose(){offVfs();offWins();clearTimeout(vfsTimer);},
    remount(p){if(p.path){recent=false;path=nodeAt(p.path)?p.path:'/';sel.clear();render();}}};
}};