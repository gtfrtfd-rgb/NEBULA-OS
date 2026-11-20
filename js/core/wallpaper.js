import {hexRgb,clamp,$} from './utils.js';
import {settings} from './settings.js';
import {bus} from './bus.js';

export const WP_PAL={
 aurora:{bg:['#05060f','#0b0e26'],cols:['#7c6bff','#22d3ee','#ff4fa3','#4f8dff'],alph:.42},
 nebula:{bg:['#0a0514','#1a0b32'],cols:['#ff4fa3','#7c6bff','#ffb454','#ff5470'],alph:.4},
 pulsar:{bg:['#020409','#04121f'],cols:['#22d3ee','#4f8dff','#34e0a1','#7c6bff'],alph:.36},
 sunset:{bg:['#13060f','#2a1028'],cols:['#ffb454','#ff5470','#ff4fa3','#7c6bff'],alph:.42}};

export function makeBlobs(){return Array.from({length:4},()=>({nx:.15+.7*Math.random(),ny:.12+.6*Math.random(),r:.34+.3*Math.random(),s1:.05+.09*Math.random(),s2:.04+.08*Math.random(),p1:Math.random()*7,p2:Math.random()*7,amp:.09+.09*Math.random()}));}

export function paintScene(x,w,h,mode,t,stars,blobs){
  const P=WP_PAL[mode]||WP_PAL.aurora;
  const bg=x.createLinearGradient(0,0,w*.3,h);bg.addColorStop(0,P.bg[0]);bg.addColorStop(1,P.bg[1]);
  x.globalCompositeOperation='source-over';x.fillStyle=bg;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='lighter';
  blobs.forEach((b,i)=>{const cx=(b.nx+b.amp*Math.sin(t*b.s1+b.p1))*w,cy=(b.ny+b.amp*Math.cos(t*b.s2+b.p2))*h,r=b.r*Math.min(w,h)*1.35;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r);const col=P.cols[i%P.cols.length],[r1,g1,b1]=hexRgb(col);
    g.addColorStop(0,`rgba(${r1},${g1},${b1},${P.alph})`);g.addColorStop(.55,`rgba(${r1},${g1},${b1},${P.alph*.32})`);g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();});
  x.globalCompositeOperation='source-over';
  stars.forEach(s=>{const a=.2+.8*(.5+.5*Math.sin(t*s.sp+s.ph));x.globalAlpha=a;x.fillStyle='#dfe6ff';x.beginPath();x.arc(s.x*w,s.y*h,s.r,0,7);x.fill();});
  x.globalAlpha=1;
}

export const Wall={ready:false,canvas:null,ctx:null,w:0,h:0,stars:[],blobs:makeBlobs(),mode:'aurora',t:Math.random()*100,raf:0,last:0,fps:60,frames:0,fpsT:0,shoot:null,nextShoot:6,
init(){this.canvas=$('#wallpaper');this.ctx=this.canvas.getContext('2d');this.mode=settings.wallpaper;this.ready=true;this.resize();this.start();
  addEventListener('resize',()=>{clearTimeout(this._rt);this._rt=setTimeout(()=>this.resize(),120);});
  document.addEventListener('visibilitychange',()=>{document.hidden?this.stopLoop():this.start();});
  const g=document.createElement('canvas');g.width=g.height=128;const gx=g.getContext('2d');const im=gx.createImageData(128,128);
  for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}
  gx.putImageData(im,0,0);$('#grain').style.backgroundImage=`url(${g.toDataURL()})`;},
qFactor(){return settings.quality==='high'?1:settings.quality==='med'?.6:.35;},
resize(){const dpr=Math.min(devicePixelRatio||1,settings.quality==='high'?1.6:settings.quality==='med'?1:.7);
  this.w=innerWidth;this.h=innerHeight;this.canvas.width=this.w*dpr;this.canvas.height=this.h*dpr;
  this.ctx.setTransform(dpr,0,0,dpr,0,0);
  const n=Math.round(this.w*this.h/8500*this.qFactor());
  this.stars=Array.from({length:n},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.3+.3,ph:Math.random()*7,sp:.4+Math.random()*1.8}));},
setMode(m){if(this.mode===m)return;this.mode=m;this.blobs=makeBlobs();this.t=Math.random()*100;},
setQuality(){this.resize();},
start(){this.stopLoop();this.last=performance.now();this.fpsT=this.last;this.frames=0;
  const loop=now=>{this.raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-this.last)/1000);this.last=now;
    this.t+=dt*(settings.animations?1:.22);this.draw(dt);
    this.frames++;if(now-this.fpsT>600){this.fps=Math.round(this.frames*1000/(now-this.fpsT));this.frames=0;this.fpsT=now;}};
  this.raf=requestAnimationFrame(loop);},
stopLoop(){cancelAnimationFrame(this.raf);this.raf=0;},
draw(dt){paintScene(this.ctx,this.w,this.h,this.mode,this.t,this.stars,this.blobs);
  if(settings.animations){this.nextShoot-=dt;
    if(this.nextShoot<=0&&!this.shoot){this.shoot={x:Math.random()*this.w*.7+this.w*.15,y:Math.random()*this.h*.3,vx:(Math.random()<.5?-1:1)*(380+Math.random()*260),vy:210+Math.random()*130,life:.9};this.nextShoot=6+Math.random()*9;}
    if(this.shoot){const s=this.shoot;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      const a=clamp(s.life/.9,0,1),tail=110;const g=this.ctx.createLinearGradient(s.x,s.y,s.x-s.vx/Math.hypot(s.vx,s.vy)*tail,s.y-s.vy/Math.hypot(s.vx,s.vy)*tail);
      g.addColorStop(0,`rgba(255,255,255,${.9*a})`);g.addColorStop(1,'rgba(255,255,255,0)');
      this.ctx.strokeStyle=g;this.ctx.lineWidth=1.6;this.ctx.beginPath();this.ctx.moveTo(s.x,s.y);this.ctx.lineTo(s.x-s.vx/Math.hypot(s.vx,s.vy)*tail,s.y-s.vy/Math.hypot(s.vx,s.vy)*tail);this.ctx.stroke();
      if(s.life<=0)this.shoot=null;}}}
};

bus.on('settings',k=>{
  if(!Wall.ready)return;
  if(k==='wallpaper')Wall.setMode(settings.wallpaper);
  if(k==='quality')Wall.setQuality();
});