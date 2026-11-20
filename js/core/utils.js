export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const el=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild;};
export const pad=n=>String(n).padStart(2,'0');
export const fmtClock=d=>pad(d.getHours())+':'+pad(d.getMinutes());
export const fmtSec=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+pad(s%60);};
export const fmtUp=s=>{s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} ч ${m} мин`:`${m} мин ${s%60} с`;};
export const relTime=t=>{const d=(Date.now()-t)/1000;if(d<60)return'только что';if(d<3600)return Math.floor(d/60)+' мин назад';if(d<86400)return Math.floor(d/3600)+' ч назад';return new Date(t).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});};
export const fmtBytes=b=>b<1024?b+' Б':b<1048576?(b/1024).toFixed(1)+' КБ':(b/1048576).toFixed(2)+' МБ';
export const isCoarse=matchMedia('(pointer:coarse)').matches;
export const isMobile=()=>innerWidth<=720;
export function hexRgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
export function lum(h){const[r,g,b]=hexRgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;}
export function mix(h,h2,t){const a=hexRgb(h),b=hexRgb(h2);return'#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');}