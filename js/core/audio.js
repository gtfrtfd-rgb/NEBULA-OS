import {settings} from './settings.js';
import {bus} from './bus.js';

export const Audio={ctx:null,master:null,ui:null,music:null,analyser:null,noise:null,
init(){if(this.ctx)return;try{
  const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();
  this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
  this.ui=this.ctx.createGain();this.ui.gain.value=.9;this.ui.connect(this.master);
  this.music=this.ctx.createGain();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;this.analyser.smoothingTimeConstant=.82;
  this.music.connect(this.analyser);this.analyser.connect(this.master);
  this.delay=this.ctx.createDelay(1);this.delay.delayTime.value=.31;
  this.fb=this.ctx.createGain();this.fb.gain.value=.36;this.dFilt=this.ctx.createBiquadFilter();this.dFilt.type='lowpass';this.dFilt.frequency.value=2400;
  this.delay.connect(this.dFilt);this.dFilt.connect(this.fb);this.fb.connect(this.delay);this.dFilt.connect(this.music);
  const len=this.ctx.sampleRate;this.noise=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
  const d=this.noise.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  this.setVolume(settings.volume);this.setMuted(!settings.sound);this.setMusicVol(settings.musicVol);
}catch(e){console.warn('Audio недоступен',e);}},
resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();},
setVolume(v){if(!this.ctx)return;if(settings.sound)this.master.gain.setTargetAtTime(Math.pow(v/100,1.6),this.ctx.currentTime,.05);},
setMuted(m){if(!this.ctx)return;this.master.gain.setTargetAtTime(m?0:Math.pow(settings.volume/100,1.6),this.ctx.currentTime,.04);},
setMusicVol(v){if(!this.ctx)return;this.music.gain.setTargetAtTime(Math.pow(v/100,1.4)*.9,this.ctx.currentTime,.05);},
tone(f,dur,type='sine',vol=.06,when=0,slide=null,dest=null){if(!this.ctx||!settings.sound)return;const t=this.ctx.currentTime+when;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(dest||this.ui);o.start(t);o.stop(t+dur+.05);},
burst(dur=.3,freq=500,vol=.15){if(!this.ctx||!settings.sound)return;const t=this.ctx.currentTime;
  const s=this.ctx.createBufferSource();s.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(80,t+dur);
  const g=this.ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(this.ui);s.start(t);s.stop(t+dur);},
sfx(name){if(!this.ctx||!settings.sound)return;switch(name){
  case'tick':if(settings.uiSounds)this.tone(1500,.045,'sine',.03);break;
  case'open':if(settings.uiSounds){this.tone(300,.14,'sine',.05,0,540);this.tone(600,.12,'triangle',.03,.03,900);}break;
  case'close':if(settings.uiSounds)this.tone(520,.13,'sine',.045,0,290);break;
  case'min':if(settings.uiSounds)this.tone(430,.12,'sine',.04,0,230);break;
  case'notify':this.tone(660,.16,'sine',.06);this.tone(880,.22,'sine',.055,.09);break;
  case'error':this.tone(165,.2,'square',.05);this.tone(120,.22,'square',.04,.06);break;
  case'reveal':if(settings.uiSounds)this.tone(1150+Math.random()*250,.035,'sine',.025);break;
  case'flag':if(settings.uiSounds)this.tone(520,.07,'triangle',.05,0,700);break;
  case'boom':this.burst(.5,900,.22);this.tone(72,.4,'sine',.16,0,40);break;
  case'win':[523,659,784,1046].forEach((f,i)=>this.tone(f,.24,'triangle',.07,i*.09));break;
  case'chime':[261.63,329.63,392,523.25].forEach((f,i)=>{this.tone(f,2.1,'sine',.05,i*.07);this.tone(f*2,1.4,'triangle',.014,i*.07);});break;
}}};

bus.on('settings',k=>{
  if(!Audio.ctx)return;
  if(k==='volume'||k==='sound'){Audio.setVolume(settings.volume);Audio.setMuted(!settings.sound);}
  if(k==='musicVol')Audio.setMusicVol(settings.musicVol);
});