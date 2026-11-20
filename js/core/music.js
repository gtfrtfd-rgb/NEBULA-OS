import {Audio} from './audio.js';

export const Music={playing:false,preset:0,base:0,startedAt:0,sched:null,nextBeat:0,beat:0,pads:[],subs:new Set(),
presets:[
 {name:'Аврора',desc:'медленные пады · ре-минор',root:146.83,scale:[0,3,5,7,10],prog:[[0,3,7,12],[-4,0,3,8],[-9,-5,-2,3],[-2,2,5,10]],bpm:62,wave:'triangle',arpP:.55,decay:.9,bass:false},
 {name:'Дрейф',desc:'невесомость · фа-лидийский',root:174.61,scale:[0,2,4,6,7,9,11],prog:[[0,4,7,11],[2,6,9,13],[-3,0,4,7],[5,9,12,16]],bpm:50,wave:'sine',arpP:.4,decay:1.5,bass:false},
 {name:'Пульсар',desc:'ритмичный бас · ля-минор',root:110,scale:[0,2,3,5,7,8,10],prog:[[0,3,7,10],[0,3,7,12],[-4,0,3,7],[-2,2,5,8]],bpm:96,wave:'triangle',arpP:.85,decay:.45,bass:true},
 {name:'Ион',desc:'колокольчики · ре-мажор',root:146.83,scale:[0,2,4,7,9],prog:[[0,4,7,9],[5,9,12,14],[-3,0,4,7],[2,5,9,12]],bpm:76,wave:'sine',arpP:.7,decay:1.9,bass:false}],
sub(f){this.subs.add(f);return()=>this.subs.delete(f);},
notify(){this.subs.forEach(f=>{try{f();}catch(e){}});},
freq(st){return this.presets[this.preset].root*Math.pow(2,st/12);},
scheduleBeat(b,t){const p=this.presets[this.preset],bar=60/p.bpm*4;
  if(b%8===0){const chord=p.prog[(b/8)%p.prog.length];
    chord.forEach(st=>{const o=Audio.ctx.createOscillator(),g=Audio.ctx.createGain();o.type='sine';o.frequency.value=this.freq(st);o.detune.value=(Math.random()-.5)*9;
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.042,t+1.3);g.gain.setValueAtTime(.042,t+bar*.8);g.gain.linearRampToValueAtTime(0,t+bar+1.6);
      o.connect(g);g.connect(Audio.music);o.start(t);o.stop(t+bar+1.8);this.pads.push({o,g,end:t+bar+1.8});});
    if(p.bass){const o=Audio.ctx.createOscillator(),g=Audio.ctx.createGain();o.type='sine';o.frequency.value=this.freq(chord[0]-12);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+bar*.9);
      o.connect(g);g.connect(Audio.music);o.start(t);o.stop(t+bar);}}
  this.pads=this.pads.filter(x=>x.end>Audio.ctx.currentTime-.1);
  if(Math.random()<p.arpP){const chord=p.prog[Math.floor(b/8)%p.prog.length];
    const st=chord[Math.floor(Math.random()*chord.length)]+12*(Math.random()<.35?2:1);
    const o=Audio.ctx.createOscillator(),g=Audio.ctx.createGain();o.type=p.wave;o.frequency.value=this.freq(st);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+p.decay);
    o.connect(g);g.connect(Audio.music);g.connect(Audio.delay);o.start(t);o.stop(t+p.decay+.1);}},
play(){Audio.init();Audio.resume();if(!Audio.ctx||this.playing)return;this.playing=true;this.startedAt=Audio.ctx.currentTime;
  this.nextBeat=Audio.ctx.currentTime+.08;this.beat=0;
  this.sched=setInterval(()=>{if(!this.playing)return;while(this.nextBeat<Audio.ctx.currentTime+1.3){this.scheduleBeat(this.beat,this.nextBeat);this.nextBeat+=60/this.presets[this.preset].bpm/2;this.beat++;}},200);
  while(this.nextBeat<Audio.ctx.currentTime+.4){this.scheduleBeat(this.beat,this.nextBeat);this.nextBeat+=60/this.presets[this.preset].bpm/2;this.beat++;}
  this.notify();},
killPads(){if(!Audio.ctx)return;const t=Audio.ctx.currentTime;this.pads.forEach(({o,g})=>{try{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(0,t,.08);o.stop(t+.4);}catch(e){}});this.pads=[];},
pause(){if(!this.playing)return;this.base+=Audio.ctx.currentTime-this.startedAt;this.playing=false;clearInterval(this.sched);this.killPads();this.notify();},
stop(){this.pause();this.base=0;this.notify();},
toggle(){this.playing?this.pause():this.play();},
setPreset(i){this.preset=i;if(this.playing){this.killPads();this.beat=0;this.nextBeat=Audio.ctx.currentTime+.1;}this.notify();},
elapsed(){return this.playing?this.base+(Audio.ctx.currentTime-this.startedAt):this.base;}};