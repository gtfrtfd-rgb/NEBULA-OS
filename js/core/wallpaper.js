import {hexRgb,clamp,$} from './utils.js';
import {settings} from './settings.js';
import {bus} from './bus.js';

export const WP_PAL={
 aurora:{bg:['#05060f','#0b0e26'],cols:['#7c6bff','#22d3ee','#ff4fa3','#4f8dff'],alph:.42},
 nebula:{bg:['#0a0514','#1a0b32'],cols:['#ff4fa3','#7c6bff','#ffb454','#ff5470'],alph:.4},
 pulsar:{bg:['#020409','#04121f'],cols:['#22d3ee','#4f8dff','#34e0a1','#7c6bff'],alph:.36},
 sunset:{bg:['#13060f','#2a1028'],cols:['#ffb454','#ff5470','#ff4fa3','#7c6bff'],alph:.42}};

export function makeBlobs(){return Array.from({length:4},()=>({nx:.15+.7*Math.random(),ny:.12+.6*Math.random(),r:.34+.3*Math.random(),s1:.05+.09*Math.random(),s2:.04+.08*Math.random(),p1:Math.random()*7,p2:Math.random()*7,amp:.09+.09*Math.random()}));}

/* статичный рендер — превью обоев и сид-картинки */
export function paintScene(x,w,h,mode,t,stars,blobs){
  const P=WP_PAL[mode]||WP_PAL.aurora;
  const bg=x.createLinearGradient(0,0,w*.3,h);bg.addColorStop(0,P.bg[0]);bg.addColorStop(1,P.bg[1]);
  x.globalCompositeOperation='source-over';x.globalAlpha=1;x.fillStyle=bg;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='lighter';
  blobs.forEach((b,i)=>{const cx=(b.nx+b.amp*Math.sin(t*b.s1+b.p1))*w,cy=(b.ny+b.amp*Math.cos(t*b.s2+b.p2))*h,r=b.r*Math.min(w,h)*1.35;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r);const[r1,g1,b1]=hexRgb(P.cols[i%P.cols.length]);
    g.addColorStop(0,`rgba(${r1},${g1},${b1},${P.alph})`);g.addColorStop(.55,`rgba(${r1},${g1},${b1},${P.alph*.32})`);g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();});
  x.globalCompositeOperation='source-over';
  x.fillStyle='#dfe6ff';
  stars.forEach(s=>{x.globalAlpha=.2+.8*(.5+.5*Math.sin(t*s.sp+s.ph));x.fillRect(s.x*w-s.r,s.y*h-s.r,s.r*2,s.r*2);});
  x.globalAlpha=1;
}

export const Wall={
ready:false,canvas:null,ctx:null,w:0,h:0,dpr:1,stars:[],blobs:makeBlobs(),mode:'aurora',
t:Math.random()*100,raf:0,last:0,lastDraw:0,fps:60,frames:0,fpsT:0,shoot:null,nextShoot:6,
blob:null,bctx:null,bw:2,bh:2,blobScale:.5,minFrame:0,_bg:null,_bgKey:'',
buckets:Array.from({length:6},()=>[]),_boot:null,_sd:null,

init(){
  this.canvas=$('#wallpaper');this.ctx=this.canvas.getContext('2d',{alpha:false});
  this.blob=document.createElement('canvas');this.bctx=this.blob.getContext('2d');
  this._boot=$('#bootScreen');this._sd=$('#shutdownScreen');
  this.mode=settings.wallpaper;this.ready=true;this.resize();this.start();
  addEventListener('resize',()=>{clearTimeout(this._rt);this._rt=setTimeout(()=>this.resize(),120);});
  document.addEventListener('visibilitychange',()=>{document.hidden?this.stopLoop():this.start();});
  const g=document.createElement('canvas');g.width=g.height=128;const gx=g.getContext('2d');const im=gx.createImageData(128,128);
  for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}
  gx.putImageData(im,0,0);$('#grain').style.backgroundImage=`url(${g.toDataURL()})`;
},
qFactor(){return settings.quality==='high'?1:settings.quality==='med'?.6:.35;},
resize(){
  const q=settings.quality;
  this.dpr=Math.min(devicePixelRatio||1,q==='high'?1.5:q==='med'?1:.75);
  this.blobScale=q==='high'?.5:q==='med'?.4:.3;
  this.minFrame=q==='eco'?1000/30:0;
  this.w=innerWidth;this.h=innerHeight;
  this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
  this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  this.bw=Math.max(2,Math.round(this.w*this.blobScale));this.bh=Math.max(2,Math.round(this.h*this.blobScale));
  this.blob.width=this.bw;this.blob.height=this.bh;
  this._bgKey='';
  const n=Math.round(this.w*this.h/8500*this.qFactor());
  this.stars=Array.from({length:n},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.3+.3,ph:Math.random()*7,sp:.4+Math.random()*1.8}));
},
setMode(m){if(this.mode===m)return;this.mode=m;this.blobs=makeBlobs();this.t=Math.random()*100;this._bgKey='';},
setQuality(){this.resize();},
covered(){
  const b=this._boot;
  if(b&&b.style.display!=='none'&&!b.classList.contains('hide'))return true;
  return !!(this._sd&&this._sd.classList.contains('on'));
},
start(){
  this.stopLoop();this.last=performance.now();this.fpsT=this.last;this.frames=0;this.lastDraw=0;
  const loop=now=>{
    this.raf=requestAnimationFrame(loop);
    if(this.covered()){this.last=now;return;}
    if(this.minFrame&&now-this.lastDraw<this.minFrame)return;
    const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.lastDraw=now;
    this.t+=dt*(settings.animations?1:.22);
    this.draw(dt);
    this.frames++;
    if(now-this.fpsT>600){this.fps=Math.round(this.frames*1000/(now-this.fpsT));this.frames=0;this.fpsT=now;}
  };
  this.raf=requestAnimationFrame(loop);
},
stopLoop(){cancelAnimationFrame(this.raf);this.raf=0;},
draw(dt){
  const x=this.ctx,w=this.w,h=this.h,P=WP_PAL[this.mode]||WP_PAL.aurora;
  const key=this.mode+':'+w+'x'+h;
  if(this._bgKey!==key){const g=x.createLinearGradient(0,0,w*.3,h);g.addColorStop(0,P.bg[0]);g.addColorStop(1,P.bg[1]);this._bg=g;this._bgKey=key;}
  x.globalCompositeOperation='source-over';x.globalAlpha=1;x.fillStyle=this._bg;x.fillRect(0,0,w,h);

  /* туманности растеризуются в четверть разрешения — визуально идентично, в разы дешевле */
  const bx=this.bctx,bw=this.bw,bh=this.bh,ts=this.t;
  bx.globalCompositeOperation='source-over';bx.clearRect(0,0,bw,bh);
  bx.globalCompositeOperation='lighter';
  for(let i=0;i<this.blobs.length;i++){
    const b=this.blobs[i];
    const cx=(b.nx+b.amp*Math.sin(ts*b.s1+b.p1))*bw,cy=(b.ny+b.amp*Math.cos(ts*b.s2+b.p2))*bh,r=b.r*Math.min(bw,bh)*1.35;
    const g=bx.createRadialGradient(cx,cy,0,cx,cy,r);const[r1,g1,b1]=hexRgb(P.cols[i%P.cols.length]);
    g.addColorStop(0,`rgba(${r1},${g1},${b1},${P.alph})`);g.addColorStop(.55,`rgba(${r1},${g1},${b1},${P.alph*.32})`);g.addColorStop(1,'rgba(0,0,0,0)');
    bx.fillStyle=g;bx.beginPath();bx.arc(cx,cy,r,0,7);bx.fill();
  }
  x.globalCompositeOperation='lighter';
  x.drawImage(this.blob,0,0,w,h);
  x.globalCompositeOperation='source-over';

  /* звёзды: пакетный fillRect по уровням яркости вместо сотен path-операций */
  const bk=this.buckets;for(let i=0;i<6;i++)bk[i].length=0;
  for(let i=0;i<this.stars.length;i++){
    const s=this.stars[i];
    const a=.2+.8*(.5+.5*Math.sin(ts*s.sp+s.ph));
    bk[Math.min(5,(a*6)|0)].push(s);
  }
  x.fillStyle='#dfe6ff';
  for(let i=0;i<6;i++){
    const arr=bk[i];if(!arr.length)continue;
    x.globalAlpha=(i+.5)/6;
    for(let j=0;j<arr.length;j++){const s=arr[j];x.fillRect(s.x*w-s.r,s.y*h-s.r,s.r*2,s.r*2);}
  }
  x.globalAlpha=1;

  if(settings.animations){
    this.nextShoot-=dt;
    if(this.nextShoot<=0&&!this.shoot){this.shoot={x:Math.random()*w*.7+w*.15,y:Math.random()*h*.3,vx:(Math.random()<.5?-1:1)*(380+Math.random()*260),vy:210+Math.random()*130,life:.9};this.nextShoot=6+Math.random()*9;}
    if(this.shoot){
      const s=this.shoot;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
      const a=clamp(s.life/.9,0,1),tail=110,mod=Math.hypot(s.vx,s.vy)||1;
      const ex=s.x-s.vx/mod*tail,ey=s.y-s.vy/mod*tail;
      const g=x.createLinearGradient(s.x,s.y,ex,ey);
      g.addColorStop(0,`rgba(255,255,255,${.9*a})`);g.addColorStop(1,'rgba(255,255,255,0)');
      x.strokeStyle=g;x.lineWidth=1.6;x.beginPath();x.moveTo(s.x,s.y);x.lineTo(ex,ey);x.stroke();
      if(s.life<=0)this.shoot=null;
    }
  }
}
};

bus.on('settings',k=>{
  if(!Wall.ready)return;
  if(k==='wallpaper')Wall.setMode(settings.wallpaper);
  if(k==='quality')Wall.setQuality();
});