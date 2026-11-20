import {store} from './store.js';
import {uid} from './utils.js';
import {bus} from './bus.js';
import {notify} from './notifications.js';
import {paintScene,makeBlobs} from './wallpaper.js';

export const VFS_KEY='nebula.vfs.v1';
let vfs=null;

export const mkDir=(name,children=[])=>({id:uid(),name,type:'dir',children,ctime:Date.now(),mtime:Date.now()});
export const mkText=(name,content)=>({id:uid(),name,type:'text',content,ctime:Date.now(),mtime:Date.now()});
export const mkImg=(name,content)=>({id:uid(),name,type:'image',content,ctime:Date.now(),mtime:Date.now()});

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
  return mkDir('',[
    mkDir('Документы',[
      mkText('readme.md',`# Добро пожаловать в NEBULA OS\n\nЭто полноценная операционная система, живущая в вашей вкладке браузера.\n\n## Что внутри\n- **Файлы** — проводник с папками, поиском и сортировкой\n- **Терминал** — настоящая оболочка: \`ls\`, \`cd\`, \`cat\`, \`echo … > файл\`\n- **Графика** — рисование с кистями, фигурами и экспортом PNG\n- **Волна FM** — генеративная музыка, синтезируется прямо сейчас\n- **Сапёр** — классика с рекордами\n\n## Полезное\n> Все файлы сохраняются в localStorage — перезагрузка страницы ничего не сотрёт.\n\nПеретащите окно к краю экрана, чтобы оно прилипло. Правый клик по рабочему столу откроет контекстное меню.\n\n---\nСделано с любовью к космосу ✦`),
      mkText('заметки.txt','Идеи для сегодняшнего вечера:\n\n1. Послушать «Пульсар» на Волне FM — бас отличный.\n2. Нарисовать свою туманность в Графике.\n3. В терминале набрать neofetch и похвастаться другом.\n4. Пройти Сапёра на «Любителе» быстрее 90 секунд.\n\nP.S. Команда sudo в терминале не сработает. Но попробовать стоит.'),
      mkText('список дел.md','# Список дел\n\n- [x] Запустить NEBULA OS\n- [x] Осмотреть рабочий стол\n- [ ] Создать файл через терминал: echo привет > файл.txt\n- [ ] Сохранить рисунок в Изображения\n- [ ] Победить Сапёра\n- [ ] Сменить акцент на Магенту\n\n> Отмечайте пункты прямо здесь — Блокнот сохранит всё автоматически по Ctrl+S.'),
    ]),
    mkDir('Изображения',[mkImg('аврора.png',imgs.aurora),mkImg('кольца.png',imgs.planet)]),
    mkDir('Музыка',[mkText('плейлист.txt','ВОЛНА FM — генеративный эфир\n\nАврора  — медленные пады, ре-минор, 62 BPM\nДрейф   — невесомость, фа-лидийский, 50 BPM\nПульсар — ритмичный бас, ля-минор, 96 BPM\nИон     — колокольчики, ре-мажор, 76 BPM\n\nМузыка не повторяется: каждая нота синтезируется\nWeb Audio прямо во время прослушивания.\n\nВ терминале: music play / music stop / music next')]),
    mkDir('Система',[
      mkText('ядро.txt','NEBULA KERNEL 6.2.0-pulsar\nСборка: 2026.11.19\nПланировщик: rAF-fair\nДрайверы: aurora-gpu, webaudio-synth, canvas2d\nФайловая система: nebulaFS (localStorage, ~5 МБ)\nГравитация: 9.81 м/с² (калибруется при загрузке)'),
      mkText('лицензия.txt','ЛИЦЕНЗИЯ ЗВЁЗДНОГО СОВЕТА v1.0\n\nРазрешается: пользоваться, изучать, модифицировать,\nпоказывать друзьям и говорить «вау».\n\nЗапрещается: удалять туманности без резервных копий.\n\nПрограмма поставляется «как есть», с блёстками\nи без гарантий межгалактического масштаба.')]),
  ]);
}
export function loadVfs(){const d=store.get(VFS_KEY,null);if(d&&d.v===1&&d.root&&d.root.type==='dir'){vfs=d.root;}else{vfs=seedVfs();saveVfs();}}
export function saveVfs(){const ok=store.set(VFS_KEY,{v:1,root:vfs});if(!ok)notify('error','Хранилище заполнено','Не удалось сохранить файлы — память браузера переполнена. Удалите лишнее.');return ok;}
export function nodeAt(path){let n=vfs;for(const p of String(path).split('/').filter(Boolean)){if(n.type!=='dir')return null;n=n.children.find(c=>c.name===p);if(!n)return null;}return n;}
export function parentPath(p){const parts=p.split('/').filter(Boolean);parts.pop();return'/'+parts.join('/');}
export function baseName(p){const parts=p.split('/').filter(Boolean);return parts[parts.length-1]||'';}
export function joinPath(a,b){if(b.startsWith('/'))return normPath(b);return normPath(a+'/'+b);}
export function normPath(p){const out=[];for(const s of p.split('/')){if(!s||s==='.')continue;if(s==='..'){out.pop();continue;}if(s==='~')continue;out.push(s);}return'/'+out.join('/');}
export function uniqueName(dir,name){if(!dir.children.some(c=>c.name===name))return name;const m=name.match(/^(.*?)(\.[^.]+)?$/);const base=m[1],ext=m[2]||'';let i=2;while(dir.children.some(c=>c.name===`${base} (${i})${ext}`))i++;return`${base} (${i})${ext}`;}
export function addNode(dirPath,node){const dir=nodeAt(dirPath);if(!dir||dir.type!=='dir')return null;node.name=uniqueName(dir,node.name);dir.children.push(node);dir.mtime=Date.now();saveVfs();bus.emit('vfs');return node;}
export function removeNode(path){const par=nodeAt(parentPath(path));if(!par)return null;const i=par.children.findIndex(c=>c.name===baseName(path));if(i<0)return null;const[node]=par.children.splice(i,1);par.mtime=Date.now();saveVfs();bus.emit('vfs');return{node,parentPath:parentPath(path),index:i};}
export function restoreNode(rec){let par=nodeAt(rec.parentPath);if(!par||par.type!=='dir'){par=vfs;rec.parentPath='/';}rec.node.name=uniqueName(par,rec.node.name);par.children.splice(Math.min(rec.index,par.children.length),0,rec.node);saveVfs();bus.emit('vfs');}
export function renameNode(path,newName){newName=newName.trim();if(!newName||newName.includes('/'))return false;const node=nodeAt(path),par=nodeAt(parentPath(path));if(!node||!par)return false;if(newName!==node.name&&par.children.some(c=>c.name===newName)){notify('warn','Имя занято',`«${newName}» уже существует в этой папке.`);return false;}node.name=newName;node.mtime=Date.now();saveVfs();bus.emit('vfs');return true;}
export function findPathById(id,node=vfs,path='/'){if(node.id===id)return path;if(node.type==='dir'){for(const c of node.children){const r=findPathById(id,c,normPath(path+'/'+c.name));if(r)return r;}}return null;}
export function walk(node,path,cb){cb(node,path);if(node.type==='dir')node.children.forEach(c=>walk(c,normPath(path+'/'+c.name),cb));}
export function recentFiles(n=8){const out=[];walk(vfs,'/',(node,p)=>{if(node.type!=='dir')out.push({node,path:p});});return out.sort((a,b)=>b.node.mtime-a.node.mtime).slice(0,n);}
export function searchFiles(q){q=q.toLowerCase();const out=[];walk(vfs,'/',(node,p)=>{if(node.type!=='dir'&&node.name.toLowerCase().includes(q))out.push({node,path:p});});return out.slice(0,8);}
export function nodeSize(n){return n.type==='text'?new Blob([n.content]).size:n.type==='image'?Math.round(n.content.length*.75):0;}