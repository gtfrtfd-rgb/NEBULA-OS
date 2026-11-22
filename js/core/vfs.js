import {store} from './store.js';
import {uid} from './utils.js';
import {bus} from './bus.js';
import {notify} from './notifications.js';
import {paintScene,makeBlobs} from './wallpaper.js';
import {KERNEL,BUILD} from './version.js';

/* ============================================================
   nebulaFS на IndexedDB
   - дерево в памяти: синхронный API для приложений
   - инкрементальная запись: только изменённые узлы
   - квота — десятки ГБ вместо ~5 МБ localStorage
   ============================================================ */
const DB_NAME='nebula-fs',DB_VER=1,STORE='nodes',ROOT_ID='root';
const LEGACY_KEY='nebula.vfs.v1';

let vfs=null,db=null,fsMode='memory';
const dirty=new Set(),deleted=new Set();
let flushTimer=null,flushPromise=null,warnedAt=0,failCount=0;

export const mkDir=(name,children=[])=>({id:uid(),name,type:'dir',children,ctime:Date.now(),mtime:Date.now()});
export const mkText=(name,content)=>({id:uid(),name,type:'text',content,ctime:Date.now(),mtime:Date.now()});
export const mkImg=(name,content)=>({id:uid(),name,type:'image',content,ctime:Date.now(),mtime:Date.now()});

/* ---------- IndexedDB ---------- */
function openDB(){
  return new Promise((res,rej)=>{
    if(!('indexedDB' in window))return rej(new Error('IndexedDB недоступен'));
    const req=indexedDB.open(DB_NAME,DB_VER);
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains(STORE)){
        const s=d.createObjectStore(STORE,{keyPath:'id'});
        s.createIndex('parent','parentId',{unique:false});
      }
    };
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>rej(req.error||new Error('open failed'));
    req.onblocked=()=>rej(new Error('база заблокирована другой вкладкой'));
  });
}
function txDone(tx){return new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('abort'));});}
function readAll(){
  return new Promise((res,rej)=>{
    const rq=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    rq.onsuccess=()=>res(rq.result||[]);rq.onerror=()=>rej(rq.error);
  });
}
function toRec(node,parentId){
  const r={id:node.id,parentId:parentId??null,name:node.name,type:node.type,ctime:node.ctime,mtime:node.mtime};
  if(node.type==='dir')r.children=node.children.map(c=>c.id);else r.content=node.content??'';
  return r;
}
function collectRecords(root){
  const out=[],parentOf=new Map([[root.id,null]]);
  const link=n=>{if(n.type==='dir')n.children.forEach(c=>{parentOf.set(c.id,n.id);link(c);});};
  link(root);
  const emit=n=>{out.push(toRec(n,parentOf.get(n.id)));if(n.type==='dir')n.children.forEach(emit);};
  emit(root);
  return out;
}
async function writeRecords(records){
  const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);
  records.forEach(r=>s.put(r));
  await txDone(tx);
}
function buildTree(records){
  const map=new Map(records.map(r=>[r.id,r]));
  const rootRec=map.get(ROOT_ID);if(!rootRec||rootRec.type!=='dir')return null;
  const seen=new Set();
  const build=r=>{
    if(seen.has(r.id))return null;seen.add(r.id);
    const n={id:r.id,name:r.name,type:r.type,ctime:r.ctime||Date.now(),mtime:r.mtime||Date.now()};
    if(r.type==='dir')n.children=(r.children||[]).map(id=>map.get(id)).filter(Boolean).map(build).filter(Boolean);
    else n.content=r.content??'';
    return n;
  };
  return build(rootRec);
}

/* ---------- очередь записи (без лишнего перезаписывания поддеревьев) ---------- */
function markNode(node){if(!node)return;dirty.add(node.id);deleted.delete(node.id);}
function markSubtree(node){if(!node)return;markNode(node);if(node.type==='dir')node.children.forEach(markSubtree);}
function markDeleted(node){const del=n=>{deleted.add(n.id);dirty.delete(n.id);if(n.type==='dir')n.children.forEach(del);};del(node);}
function scheduleFlush(delay){clearTimeout(flushTimer);flushTimer=setTimeout(()=>{flushVfs();},delay??60);}

export function saveVfs(node){
  if(fsMode!=='indexeddb')return true;
  if(node)markNode(node);else if(vfs)markSubtree(vfs);
  scheduleFlush();
  return true;
}
export function flushVfs(){
  if(fsMode!=='indexeddb'||!vfs)return Promise.resolve(true);
  if(flushPromise)return flushPromise;
  flushPromise=(async()=>{
    const ids=[...dirty],dels=[...deleted];
    dirty.clear();deleted.clear();
    if(!ids.length&&!dels.length)return true;
    /* один проход по дереву вместо поиска на каждый узел */
    const index=new Map();
    const scan=(n,pid)=>{index.set(n.id,[n,pid]);if(n.type==='dir')n.children.forEach(c=>scan(c,n.id));};
    scan(vfs,null);
    try{
      const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);
      dels.forEach(id=>s.delete(id));
      ids.forEach(id=>{const e=index.get(id);if(e)s.put(toRec(e[0],e[1]));});
      await txDone(tx);
      failCount=0;
      return true;
    }catch(e){
      ids.forEach(id=>dirty.add(id));
      failCount++;
      if(Date.now()-warnedAt>8000){warnedAt=Date.now();
        notify('error','Ошибка записи nebulaFS',e&&e.name==='QuotaExceededError'?'Хранилище браузера переполнено. Освободите место на диске.':'Не удалось записать файлы на диск. Изменения пока живут только в памяти.');}
      return false;
    }finally{
      /* экспоненциальная пауза вместо бесконечного ретрая */
      if((dirty.size||deleted.size)&&failCount<=3)scheduleFlush(failCount?600*Math.pow(2,failCount):60);
    }
  })().finally(()=>{flushPromise=null;});
  return flushPromise;
}

/* ---------- сид ---------- */
function seedImages(){
  const out={};
  const c=document.createElement('canvas');c.width=640;c.height=400;const x=c.getContext('2d');
  const stars=Array.from({length:130},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.4+.3,ph:Math.random()*7,sp:.4+Math.random()*1.6}));
  paintScene(x,640,400,'aurora',4.2,stars,makeBlobs());out.aurora=c.toDataURL('image/png');
  paintScene(x,640,400,'nebula',7.5,stars,makeBlobs());
  const g=x.createRadialGradient(430,190,10,450,210,120);g.addColorStop(0,'#ffd9a0');g.addColorStop(.45,'#c96a4a');g.addColorStop(1,'#3a1030');
  x.fillStyle=g;x.beginPath();x.arc(450,210,85,0,7);x.fill();
  x.save();x.translate(450,210);x.rotate(-.35);x.strokeStyle='rgba(255,214,160,.75)';x.lineWidth=7;x.beginPath();x.ellipse(0,0,150,38,0,0,7);x.stroke();
  x.strokeStyle='rgba(255,79,163,.4)';x.lineWidth=14;x.beginPath();x.ellipse(0,0,172,46,0,0,7);x.stroke();x.restore();
  out.planet=c.toDataURL('image/png');return out;
}
function seedVfs(){
  const imgs=seedImages();
  const root=mkDir('',[
    mkDir('Документы',[
      mkText('readme.md',`# Добро пожаловать в NEBULA OS\n\nЭто полноценная операционная система, живущая в вашей вкладке браузера.\n\n## Что внутри\n- **Файлы** — проводник с папками, поиском и сортировкой\n- **Терминал** — настоящая оболочка: \`ls\`, \`cd\`, \`cat\`, \`tree\`, \`echo … > файл\`\n- **Графика** — рисование с кистями, фигурами и экспортом PNG\n- **Волна FM** — генеративная музыка, синтезируется прямо сейчас\n- **Сапёр** — классика с рекордами\n\n## Хранилище\n> Файлы лежат в **IndexedDB** — это десятки гигабайт вместо прежних 5 МБ localStorage.\n> Наберите \`df\` в терминале, чтобы увидеть реальную квоту.\n\nПеретащите окно к краю экрана, чтобы оно прилипло. Правый клик по рабочему столу откроет контекстное меню.\n\n---\nСделано с любовью к космосу ✦`),
      mkText('заметки.txt','Идеи для сегодняшнего вечера:\n\n1. Послушать «Пульсар» на Волне FM — бас отличный.\n2. Нарисовать свою туманность в Графике.\n3. В терминале набрать neofetch и df — узнать, сколько места осталось.\n4. Пройти Сапёра на «Любителе» быстрее 90 секунд.\n\nP.S. Команда sudo в терминале не сработает. Но попробовать стоит.'),
      mkText('список дел.md','# Список дел\n\n- [x] Запустить NEBULA OS\n- [x] Осмотреть рабочий стол\n- [ ] Создать файл через терминал: echo привет > файл.txt\n- [ ] Сохранить рисунок в Изображения\n- [ ] Победить Сапёра\n- [ ] Сменить акцент на Магенту\n\n> Отмечайте пункты прямо здесь — Блокнот сохранит всё по Ctrl+S.'),
    ]),
    mkDir('Изображения',[mkImg('аврора.png',imgs.aurora),mkImg('кольца.png',imgs.planet)]),
    mkDir('Музыка',[mkText('плейлист.txt','ВОЛНА FM — генеративный эфир\n\nАврора  — медленные пады, ре-минор, 62 BPM\nДрейф   — невесомость, фа-лидийский, 50 BPM\nПульсар — ритмичный бас, ля-минор, 96 BPM\nИон     — колокольчики, ре-мажор, 76 BPM\n\nМузыка не повторяется: каждая нота синтезируется\nWeb Audio прямо во время прослушивания.\n\nВ терминале: music play / music stop / music next')]),
    mkDir('Система',[
      mkText('ядро.txt',`NEBULA KERNEL ${KERNEL}\nСборка: ${BUILD}\nПланировщик: rAF-fair\nДрайверы: aurora-gpu, webaudio-synth, canvas2d\nФайловая система: nebulaFS (IndexedDB, объект «nodes»)\nГравитация: 9.81 м/с² (калибруется при загрузке)`),
      mkText('лицензия.txt','ЛИЦЕНЗИЯ ЗВЁЗДНОГО СОВЕТА v1.0\n\nРазрешается: пользоваться, изучать, модифицировать,\nпоказывать друзьям и говорить «вау».\n\nЗапрещается: удалять туманности без резервных копий.\n\nПрограмма поставляется «как есть», с блёстками\nи без гарантий межгалактического масштаба.')]),
  ]);
  root.id=ROOT_ID;
  return root;
}

/* ---------- загрузка / миграция / сброс ---------- */
export async function loadVfs(){
  try{
    db=await openDB();
    db.onversionchange=()=>{try{db.close();}catch(e){}};
    fsMode='indexeddb';
    const records=await readAll();
    if(!records.length){
      const legacy=store.get(LEGACY_KEY,null);
      if(legacy&&legacy.v===1&&legacy.root&&legacy.root.type==='dir'){
        legacy.root.id=ROOT_ID;
        vfs=legacy.root;
        await writeRecords(collectRecords(vfs));
      }else{
        vfs=seedVfs();
        await writeRecords(collectRecords(vfs));
      }
      store.del(LEGACY_KEY);
    }else{
      vfs=buildTree(records);
      if(!vfs){vfs=seedVfs();await writeRecords(collectRecords(vfs));}
      store.del(LEGACY_KEY);
    }
  }catch(e){
    console.warn('IndexedDB недоступен, работаем в памяти',e);
    fsMode='memory';
    const legacy=store.get(LEGACY_KEY,null);
    vfs=legacy&&legacy.v===1&&legacy.root?legacy.root:seedVfs();
    vfs.id=ROOT_ID;
    notify('warn','Хранилище недоступно','IndexedDB не открылась — файлы будут жить только до перезагрузки страницы.');
  }
  addEventListener('pagehide',()=>{flushVfs();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushVfs();});
  bus.emit('vfs');
}
export async function wipeVfs(){
  store.del(LEGACY_KEY);
  if(flushPromise){try{await flushPromise;}catch(e){}}
  dirty.clear();deleted.clear();clearTimeout(flushTimer);
  if(fsMode!=='indexeddb'||!db)return;
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).clear();
  await txDone(tx);
}
export async function storageInfo(){
  let usage=0,quota=0,persisted=false;
  try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();usage=e.usage||0;quota=e.quota||0;}}catch(e){}
  try{if(navigator.storage?.persisted)persisted=await navigator.storage.persisted();}catch(e){}
  let nodes=0;walk(vfs,'/',()=>{nodes++;});
  return {mode:fsMode,usage,quota,persisted,treeSize:vfsSize(),nodes};
}
export async function requestPersist(){
  try{return !!(navigator.storage?.persist&&await navigator.storage.persist());}catch(e){return false;}
}

/* ---------- пути и операции (синхронный API) ---------- */
export function nodeAt(path){let n=vfs;for(const p of String(path).split('/').filter(Boolean)){if(!n||n.type!=='dir')return null;n=n.children.find(c=>c.name===p);if(!n)return null;}return n;}
export function parentPath(p){const parts=String(p).split('/').filter(Boolean);parts.pop();return'/'+parts.join('/');}
export function baseName(p){const parts=String(p).split('/').filter(Boolean);return parts[parts.length-1]||'';}
export function joinPath(a,b){if(b.startsWith('/'))return normPath(b);return normPath(a+'/'+b);}
export function normPath(p){const out=[];for(const s of String(p).split('/')){if(!s||s==='.')continue;if(s==='..'){out.pop();continue;}if(s==='~')continue;out.push(s);}return'/'+out.join('/');}
export function uniqueName(dir,name){if(!dir.children.some(c=>c.name===name))return name;const m=name.match(/^(.*?)(\.[^.]+)?$/);const base=m[1],ext=m[2]||'';let i=2;while(dir.children.some(c=>c.name===`${base} (${i})${ext}`))i++;return`${base} (${i})${ext}`;}
export function addNode(dirPath,node){
  const dir=nodeAt(dirPath);if(!dir||dir.type!=='dir')return null;
  node.name=uniqueName(dir,node.name);dir.children.push(node);dir.mtime=Date.now();
  if(fsMode==='indexeddb'){markSubtree(node);markNode(dir);scheduleFlush();}
  bus.emit('vfs');return node;
}
export function removeNode(path){
  const par=nodeAt(parentPath(path));if(!par)return null;
  const i=par.children.findIndex(c=>c.name===baseName(path));if(i<0)return null;
  const[node]=par.children.splice(i,1);par.mtime=Date.now();
  if(fsMode==='indexeddb'){markDeleted(node);markNode(par);scheduleFlush();}
  bus.emit('vfs');
  return{node,parentPath:parentPath(path),index:i};
}
export function restoreNode(rec){
  let par=nodeAt(rec.parentPath);
  if(!par||par.type!=='dir'){par=vfs;rec.parentPath='/';}
  rec.node.name=uniqueName(par,rec.node.name);
  par.children.splice(Math.min(rec.index,par.children.length),0,rec.node);par.mtime=Date.now();
  if(fsMode==='indexeddb'){markSubtree(rec.node);markNode(par);scheduleFlush();}
  bus.emit('vfs');
}
export function renameNode(path,newName){
  newName=newName.trim();
  if(!newName||newName.includes('/'))return false;
  const node=nodeAt(path),par=nodeAt(parentPath(path));
  if(!node||!par)return false;
  if(newName!==node.name&&par.children.some(c=>c.name===newName)){notify('warn','Имя занято',`«${newName}» уже существует в этой папке.`);return false;}
  node.name=newName;node.mtime=Date.now();
  if(fsMode==='indexeddb'){markNode(node);scheduleFlush();}
  bus.emit('vfs');return true;
}
export function findPathById(id,node=vfs,path='/'){if(!node)return null;if(node.id===id)return path;if(node.type==='dir'){for(const c of node.children){const r=findPathById(id,c,normPath(path+'/'+c.name));if(r)return r;}}return null;}
export function walk(node,path,cb){if(!node)return;cb(node,path);if(node.type==='dir')node.children.forEach(c=>walk(c,normPath(path+'/'+c.name),cb));}
export function recentFiles(n=8){const out=[];walk(vfs,'/',(node,p)=>{if(node.type!=='dir')out.push({node,path:p});});return out.sort((a,b)=>b.node.mtime-a.node.mtime).slice(0,n);}
export function searchFiles(q){q=q.toLowerCase();const out=[];walk(vfs,'/',(node,p)=>{if(node.type!=='dir'&&node.name.toLowerCase().includes(q))out.push({node,path:p});});return out.slice(0,8);}
export function nodeSize(n){return n.type==='text'?new Blob([n.content||'']).size:n.type==='image'?Math.round((n.content||'').length*.75):0;}
export function vfsSize(){let n=0;walk(vfs,'/',node=>{if(node.type!=='dir')n+=nodeSize(node);});return n;}