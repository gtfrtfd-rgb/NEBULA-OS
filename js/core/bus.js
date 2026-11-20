export const bus={
  m:{},
  on(e,f){(this.m[e]??=[]).push(f);return()=>{this.m[e]=this.m[e].filter(x=>x!==f);};},
  emit(e,d){(this.m[e]||[]).forEach(f=>{try{f(d);}catch(err){console.warn(err);}});}
};