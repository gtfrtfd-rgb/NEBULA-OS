import {$,esc} from './utils.js';
import {icon} from './icons.js';
import {settings,setSetting} from './settings.js';
import {bus} from './bus.js';
import {VERSION,BUILD,CODENAME,CHANNEL_LABEL,CHANNEL_SHORT,IN_DEV,RUNNING_BUILD,REPO} from './version.js';

/* Метка канала разработки: живёт в панели задач, на экранах загрузки и входа,
   в меню Пуск и в «О системе». Показывает, что это предварительная сборка,
   и что именно меняется в 1.1 — без ложных обещаний. */

const COMMIT=RUNNING_BUILD.indexOf('__')===0?'':RUNNING_BUILD;

const ROADMAP=[
  {s:'done',t:'Проводник: фиксированные ячейки и полные имена в подсказке'},
  {s:'done',t:'Терминал: подсказки опечаток по префиксу, клик подставляет команду'},
  {s:'done',t:'Обновления: честное сравнение своей сборки с серверной'},
  {s:'wip',t:'Перетаскивание файлов между папками'},
  {s:'wip',t:'Блокнот с вкладками и автосохранением черновиков'},
  {s:'plan',t:'Импорт файлов с компьютера'},
  {s:'plan',t:'Синхронизация файловой системы между вкладками'},
];
const STATUS={done:{l:'готово',c:'ok'},wip:{l:'в работе',c:'wip'},plan:{l:'в планах',c:'plan'}};

function paintStatic(){
  const b=$('#bootDev');
  if(b){b.hidden=!IN_DEV;b.innerHTML=`<i></i><span>${esc(CHANNEL_LABEL)}</span>`;}
  const l=$('#lockDev');
  if(l){l.hidden=!IN_DEV;l.innerHTML=`<i></i><span>Версия ${esc(VERSION)} ${esc(CHANNEL_LABEL)}</span>`;}
  const s=$('#smDev');
  if(s){s.hidden=!IN_DEV;s.innerHTML=`<i></i><span>${esc(CHANNEL_SHORT)} · ${esc(CHANNEL_LABEL)}</span>`;}
}
function syncChip(){
  const c=$('#devChip');
  if(!c)return;
  c.hidden=!(IN_DEV&&settings.devBadge!==false);
  c.innerHTML=`<i class="dev-dot"></i><span class="dev-txt">${esc(VERSION)}</span><span class="dev-tag">${esc(CHANNEL_SHORT)}</span>`;
  c.title=`Версия ${VERSION} ${CHANNEL_LABEL} — что меняется`;
  c.setAttribute('aria-label',c.title);
}
function badgeRow(){
  return `<label class="dev-hide"><span>Метка «${esc(CHANNEL_SHORT)}» в панели задач</span>
    <span class="tgl"><input type="checkbox" class="dev-badge-tgl" ${settings.devBadge!==false?'checked':''}><i></i></span></label>`;
}
function wireBadge(root){
  const t=$('.dev-badge-tgl',root);
  if(t)t.addEventListener('change',e=>setSetting('devBadge',e.target.checked));
}

export const DevBuild={
  init(){paintStatic();syncChip();},
  syncChip,
  notice(){
    return{
      title:`Версия ${VERSION} ${CHANNEL_LABEL}`,
      body:'Это предварительная сборка большого обновления. Возможности ещё меняются, а схема хранилища может обновиться.',
      action:{label:'Что меняется',fn:()=>bus.emit('dev:open')}
    };
  },
  bannerHtml(){
    if(!IN_DEV)return '';
    return `<div class="dev-banner">
      <span class="db-ico">${icon('alert',18)}</span>
      <div class="db-txt">
        <b>Версия ${esc(VERSION)} ${esc(CHANNEL_LABEL)}</b>
        <p>Предварительная сборка большого обновления. Часть возможностей ещё меняется, схема хранилища может обновиться — держите важные файлы в резервной копии.</p>
        ${badgeRow()}
      </div>
    </div>`;
  },
  wireBanner:wireBadge,
  renderPanel(p){
    const rows=ROADMAP.map(r=>{
      const st=STATUS[r.s];
      return `<div class="dev-item ${st.c}"><i></i><span class="di-t">${esc(r.t)}</span><span class="di-s">${st.l}</span></div>`;
    }).join('');
    p.innerHTML=`<div class="pop-title"><span>Версия в разработке</span><span class="dev-tag solid">${esc(CHANNEL_SHORT)}</span></div>
      <div class="dev-hero">
        <div class="dev-ver">${esc(VERSION)}</div>
        <div class="dev-meta"><b>«${esc(CODENAME)}»</b><span>сборка ${esc(BUILD)}</span><span>${COMMIT?'коммит '+esc(COMMIT):'локальная сборка'}</span></div>
      </div>
      <p class="dev-note">Идёт работа над крупным обновлением. Ниже — что уже landed и что ещё в пути. Данные хранятся локально; при смене схемы хранилища возможен сброс.</p>
      <div class="dev-legend"><span class="ok">готово</span><span class="wip">в работе</span><span class="plan">в планах</span></div>
      <div class="dev-list">${rows}</div>
      <div class="dev-actions">
        <button class="btn sm dev-help">${icon('help',13)} Справка</button>
        <a class="btn sm dev-issue" href="${esc(REPO)}/issues/new" target="_blank" rel="noopener">${icon('zap',13)} Сообщить о проблеме</a>
      </div>
      ${badgeRow()}`;
    $('.dev-help',p).addEventListener('click',()=>bus.emit('dev:help'));
    wireBadge(p);
  }
};

bus.on('settings',k=>{if(k==='devBadge')syncChip();});