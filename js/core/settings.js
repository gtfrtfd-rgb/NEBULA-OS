import {bus} from './bus.js';
import {store} from './store.js';
import {hexRgb,lum,mix,isMobile} from './utils.js';

export const ACCENTS={
  violet:{c:'#7c6bff',b:'#ff4fa3',name:'Виолет'},
  cyan:{c:'#22d3ee',b:'#7c6bff',name:'Циан'},
  magenta:{c:'#ff4fa3',b:'#ffb454',name:'Магента'},
  amber:{c:'#ffb454',b:'#ff4fa3',name:'Янтарь'},
  lime:{c:'#a3e635',b:'#22d3ee',name:'Лайм'},
  azure:{c:'#4f8dff',b:'#22d3ee',name:'Лазурь'}
};
export const WALL_NAMES={aurora:'Аврора',nebula:'Туманность',pulsar:'Пульсар',sunset:'Закат'};

export let settings=Object.assign({
  accent:'violet',wallpaper:'aurora',theme:'dark',quality:'high',
  animations:!matchMedia('(prefers-reduced-motion: reduce)').matches,
  sound:true,volume:70,uiSounds:true,musicVol:80,username:'Космонавт',
  explorerView:'grid',explorerSort:'name',explorerAsc:true,
  fsAuto:false,fsHint:false
},store.get('nebula.settings.v1',{}));
if(!ACCENTS[settings.accent])settings.accent='violet';
if(!WALL_NAMES[settings.wallpaper])settings.wallpaper='aurora';

export function saveSettings(){store.set('nebula.settings.v1',settings);}
export function setSetting(k,v){settings[k]=v;saveSettings();applySettings();bus.emit('settings',k);}

export function applySettings(){
  const root=document.documentElement,a=ACCENTS[settings.accent],[r,g,b]=hexRgb(a.c);
  root.style.setProperty('--acc',a.c);root.style.setProperty('--acc-b',a.b);
  root.style.setProperty('--acc-12',`rgba(${r},${g},${b},.12)`);
  root.style.setProperty('--acc-20',`rgba(${r},${g},${b},.2)`);
  root.style.setProperty('--acc-35',`rgba(${r},${g},${b},.35)`);
  root.style.setProperty('--acc-contrast',lum(a.c)>.5?'#0b0d1f':'#ffffff');
  root.style.setProperty('--acc-text',settings.theme==='light'?mix(a.c,'#000000',.28):mix(a.c,'#ffffff',.22));
  root.classList.toggle('light',settings.theme==='light');
  root.classList.toggle('dark',settings.theme!=='light');
  root.classList.toggle('eco',settings.quality==='eco');
  root.classList.toggle('noanim',!settings.animations);
  root.classList.toggle('mobile',isMobile());
}