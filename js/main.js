import {$} from './core/utils.js';
import {applySettings} from './core/settings.js';
import {loadVfs} from './core/vfs.js';
import {Wall} from './core/wallpaper.js';
import {Updates} from './core/updates.js';
import {initShell} from './shell.js';
import {bootSequence} from './boot.js';
import {SHORT_LINE,PAGE_TITLE} from './core/version.js';

async function start(){
  applySettings();
  const sub=$('#bootSub');if(sub)sub.textContent=SHORT_LINE;
  document.title=PAGE_TITLE;
  Updates.init();
  await loadVfs();
  Wall.init();
  initShell();
  bootSequence();
  if(document.readyState==='complete')Updates.register();
  else addEventListener('load',()=>Updates.register(),{once:true});
}
start();