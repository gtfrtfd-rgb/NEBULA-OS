import {$,fmtSec} from '../core/utils.js';
import {icon} from '../core/icons.js';
import {bus} from '../core/bus.js';
import {Music} from '../core/music.js';
import {Audio} from '../core/audio.js';
import {settings,setSetting} from '../core/settings.js';

export default {name:'Волна FM',icon:'music',g:['#7c6bff','#ff4fa3'],w:470,h:600,minW:360,minH:480,single:true,
mount(body,win){
  body.innerHTML=`<div class="music">
    <div class="mviz"><canvas></canvas><div class="m-live"><i></i><span>не в эфире</span></div></div>
    <div class="m-body">
      <div class="m-track"><b class="mt-name"></b><span class="mt-desc"></span><div class="m-time">0:00 · генеративный эфир ∞</div></div>
      <div class="m-presets"></div>
      <div class="m-ctrl">
        <button class="ibtn m-stop" title="Остановить">${icon('stop',18)}</button>
        <button class="m-play" title="Играть / пауза"></button>
        <button class="ibtn m-next" title="Следующая станция">${icon('chevR',20)}</button>
      </div>
      <div class="m-vol">${icon('vol',16)}<input type="range" class="mv-range" min="0" max="100" value="${settings.musicVol}"><span class="mv-v">${settings.musicVol}%</span></div>
    </div></div>`;
  const cv=$('canvas',body),cx=cv.getContext('2d');
  let raf=0,frame=0,t=0,vw=0,vh=0,freq=null;
  let c1='#7c6bff',c2='#ff4fa3';
  function readColors(){const s=getComputedStyle(document.documentElement);c1=s.getPropertyValue('--acc').trim()||c1;c2=s.getPropertyValue('--acc-b').trim()||c2;}
  readColors();
  const offSet=bus.on('settings',readColors);

  function sync(){
    const p=Music.presets[Music.preset];
    $('.mt-name',body).textContent=p.name;$('.mt-desc',body).textContent=p.desc+' · '+p.bpm+' BPM';
    $('.m-play',body).innerHTML=icon(Music.playing?'pause':'play',26);
    const live=$('.m-live',body);live.classList.toggle('on',Music.playing);$('span',live).textContent=Music.playing?'в эфире':'не в эфире';
    $('.m-presets',body).innerHTML=Music.presets.map((pr,i)=>`<button class="m-pre ${i===Music.preset?'on':''}" data-i="${i}"><b>${pr.name}</b><span>${pr.desc}</span></button>`).join('');
  }
  $('.m-presets',body).addEventListener('click',e=>{const b=e.target.closest('.m-pre');if(!b)return;Music.setPreset(+b.dataset.i);if(!Music.playing)Music.play();});
  $('.m-play',body).addEventListener('click',()=>Music.toggle());
  $('.m-stop',body).addEventListener('click',()=>Music.stop());
  $('.m-next',body).addEventListener('click',()=>{Music.setPreset((Music.preset+1)%Music.presets.length);if(!Music.playing)Music.play();});
  const rng=$('.mv-range',body);
  const updR=()=>{rng.style.setProperty('--val',rng.value+'%');$('.mv-v',body).textContent=rng.value+'%';};
  rng.addEventListener('input',()=>{setSetting('musicVol',+rng.value);Audio.setMusicVol(+rng.value);updR();});updR();

  function resize(){
    const r=cv.parentElement.getBoundingClientRect();
    const d=Math.min(devicePixelRatio||1,1.5);
    vw=Math.max(1,Math.round(r.width));vh=Math.max(1,Math.round(r.height));
    cv.width=vw*d;cv.height=vh*d;cx.setTransform(d,0,0,d,0,0);
  }
  resize();

  function draw(){
    raf=requestAnimationFrame(draw);
    if(win.minimized||win.closing||document.hidden)return;
    t+=.016;frame++;
    cx.clearRect(0,0,vw,vh);
    if(Music.playing&&Audio.analyser){
      if(!freq||freq.length!==Audio.analyser.frequencyBinCount)freq=new Uint8Array(Audio.analyser.frequencyBinCount);
      Audio.analyser.getByteFrequencyData(freq);
      const N=44,bw=vw/N,step=Math.floor(freq.length/N*.72)||1;
      for(let i=0;i<N;i++){
        const v=freq[i*step]/255,bh=Math.max(3,v*vh*.86);
        const g=cx.createLinearGradient(0,vh,0,vh-bh);g.addColorStop(0,c1);g.addColorStop(1,c2);
        cx.fillStyle=g;cx.globalAlpha=.5+v*.5;
        const x=i*bw+2,bwi=bw-4;
        if(cx.roundRect){cx.beginPath();cx.roundRect(x,vh-bh,bwi,bh,3);cx.fill();}else cx.fillRect(x,vh-bh,bwi,bh);
      }
      cx.globalAlpha=1;
    }else{
      cx.strokeStyle=c1;cx.globalAlpha=.5;cx.lineWidth=2;cx.beginPath();
      for(let x=0;x<=vw;x+=4){const y=vh/2+Math.sin(x*.02+t*1.4)*8*Math.sin(t*.5+x*.004);x===0?cx.moveTo(x,y):cx.lineTo(x,y);}
      cx.stroke();cx.globalAlpha=1;
    }
    if(frame%20===0)$('.m-time',body).textContent=fmtSec(Music.elapsed())+' · генеративный эфир ∞';
  }
  draw();
  const off=Music.sub(sync);sync();
  return{onClose(){cancelAnimationFrame(raf);off();offSet();},onResize:resize};
}};