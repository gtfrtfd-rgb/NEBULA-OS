import {$,esc,fmtBytes,fmtUp} from '../core/utils.js';
import {settings,setSetting,ACCENTS,WALL_NAMES} from '../core/settings.js';
import {bus} from '../core/bus.js';
import {session} from '../core/session.js';
import {Audio} from '../core/audio.js';
import {Music} from '../core/music.js';
import {Wall} from '../core/wallpaper.js';
import {notify} from '../core/notifications.js';
import {WM} from '../wm.js';
import {Apps} from './index.js';
import {joinPath,nodeAt,parentPath,baseName,addNode,removeNode,restoreNode,mkText,mkDir,saveVfs} from '../core/vfs.js';

export default {name:'Терминал',icon:'terminal',g:['#232849','#4a5382'],w:660,h:430,minW:420,minH:260,
mount(body,win){
  let cwd='/',hist=[],hi=0;
  body.innerHTML=`<div class="term selectable"><div class="term-out"></div><div class="term-inrow"><span class="term-ps"></span><input spellcheck="false" autocomplete="off" aria-label="Командная строка"></div></div>`;
  const out=$('.term-out',body),inp=$('input',body),ps=$('.term-ps',body);
  const dispPath=()=>cwd==='/'?'~':'~'+cwd;
  const promptHtml=()=>`<span class="p-user">${esc(settings.username.toLowerCase().replace(/\s+/g,''))}@nebula</span><span class="dim">:</span><span class="p-path">${esc(dispPath())}</span><span class="dim">$ </span>`;
  function syncPs(){ps.innerHTML=promptHtml();win.setTitle('Терминал — '+dispPath());}
  function print(html,cls=''){const d=document.createElement('div');if(cls)d.className=cls;d.innerHTML=html;out.appendChild(d);
    while(out.children.length>600)out.firstElementChild.remove();out.scrollTop=out.scrollHeight;}
  const echoCmd=c=>print(promptHtml()+esc(c));
  print(`<span class="acc">NEBULA Shell 1.0</span> <span class="dim">— оболочка Звёздного Совета</span>`);
  print(`<span class="dim">Введите</span> <span class="info">help</span><span class="dim">, чтобы увидеть список команд.</span>`);
  print('');
  const APP_ALIAS={'файлы':'explorer','explorer':'explorer','проводник':'explorer','терминал':'terminal','terminal':'terminal','блокнот':'editor','editor':'editor','калькулятор':'calc','calc':'calc','графика':'paint','paint':'paint','музыка':'music','music':'music','волна':'music','сапёр':'game','game':'game','сапер':'game','монитор':'monitor','monitor':'monitor','настройки':'settings','settings':'settings','просмотр':'viewer','viewer':'viewer','справка':'help','help':'help'};
  const CMDS=['help','ls','cd','pwd','cat','touch','mkdir','rm','echo','clear','date','whoami','neofetch','open','theme','wallpaper','music','notify','uptime','history','sudo','reboot','exit','about'];
  function resolve(p){return joinPath(cwd,p||'.');}
  function exec(raw){
    const line=raw.trim();if(!line){print(promptHtml());return;}
    echoCmd(line);hist.push(line);hi=hist.length;
    const redirect=line.match(/^(.*?)\s*>\s*(\S+)\s*$/);
    const tokens=(redirect?redirect[1]:line).match(/"[^"]*"|\S+/g)||[];
    const cmd=(tokens[0]||'').toLowerCase();const args=tokens.slice(1).map(a=>a.replace(/^"|"$/g,''));
    const ok=t=>print(esc(t),'ok'),err=t=>print(esc(t),'err'),info=t=>print(esc(t),'info'),dim=t=>print(esc(t),'dim');
    try{switch(cmd){
      case'help':{
        print(`<span class="acc">Доступные команды:</span>`);
        const rows=[['ls [путь]','содержимое папки'],['cd <путь>','сменить папку (.. — вверх)'],['pwd','текущая папка'],['cat <файл>','прочитать файл'],['touch <имя>','создать файл'],['mkdir <имя>','создать папку'],['rm [-r] <имя>','удалить (-r для папок)'],['echo текст > файл','записать текст в файл'],['open <приложение>','запустить приложение'],['theme <цвет>','violet cyan magenta amber lime azure'],['wallpaper <1-4>','сменить обои'],['music play|stop|next','управление Волной FM'],['neofetch','сведения о системе'],['notify <текст>','проверить уведомления'],['date / uptime / whoami','время · аптайм · пользователь'],['history / clear','история · очистить экран'],['reboot / exit','перезагрузка · закрыть терминал']];
        rows.forEach(([c,d])=>print(`  <span class="info">${esc(c.padEnd(22))}</span><span class="dim">${esc(d)}</span>`));break;}
      case'ls':{const p=args[0]?resolve(args[0]):cwd;const n=nodeAt(p);
        if(!n){err(`ls: ${p}: нет такого пути`);break;}
        if(n.type!=='dir'){print(esc(n.name));break;}
        if(!n.children.length){dim('(пусто)');break;}
        [...n.children].sort((a,b)=>(a.type==='dir'?0:1)-(b.type==='dir'?0:1)||a.name.localeCompare(b.name,'ru')).forEach(c=>{
          if(c.type==='dir')print(`<span class="dir">${esc(c.name)}/</span>  <span class="dim">${c.children.length} эл.</span>`);
          else print(`${esc(c.name)}  <span class="dim">${fmtBytes(nodeSize(c))}</span>`);});break;}
      case'cd':{const p=args[0]?resolve(args[0]):'/';const n=nodeAt(p);
        if(!n)err(`cd: ${args[0]}: нет такой папки`);else if(n.type!=='dir')err(`cd: ${n.name}: это не папка`);else{cwd=p;syncPs();}break;}
      case'pwd':print(esc(cwd));break;
      case'cat':{if(!args[0]){err('cat: укажите файл');break;}const n=nodeAt(resolve(args[0]));
        if(!n)err(`cat: ${args[0]}: файл не найден`);
        else if(n.type==='dir')err(`cat: ${n.name}: это папка`);
        else if(n.type==='image')info(`[изображение ${fmtBytes(nodeSize(n))} — откройте: open просмотр]`);
        else print(esc(n.content)||dim('(пустой файл)'));break;}
      case'touch':{if(!args[0]){err('touch: укажите имя файла');break;}const dir=nodeAt(cwd);const ex=dir.children.find(c=>c.name===args[0]);
        if(ex){ex.mtime=Date.now();saveVfs();bus.emit('vfs');ok(`${ex.name}: время обновлено`);}
        else{const n=addNode(cwd,mkText(args[0],''));ok(`создан ${n.name}`);}break;}
      case'mkdir':{if(!args[0]){err('mkdir: укажите имя');break;}
        if(nodeAt(resolve(args[0])))err(`mkdir: ${args[0]}: уже существует`);
        else{const n=addNode(cwd,mkDir(args[0]));ok(`папка ${n.name} создана`);}break;}
      case'rm':{let r=false,name=args[0];if(name==='-r'){r=true;name=args[1];}
        if(!name){err('rm: укажите имя');break;}const p=resolve(name);const n=nodeAt(p);
        if(!n){err(`rm: ${name}: не найдено`);break;}
        if(n.type==='dir'&&!r){err(`rm: ${n.name}: это папка — используйте rm -r`);break;}
        const rec=removeNode(p);ok(`удалено: ${n.name}`);
        notify('warn','Терминал удалил объект',`«${n.name}»`,{label:'Отменить',fn:()=>restoreNode(rec)},6500);break;}
      case'echo':{const text=args.join(' ');
        if(redirect){const fname=redirect[2];const p=resolve(fname);const ex=nodeAt(p);
          if(ex&&ex.type==='dir'){err(`echo: ${fname}: это папка`);break;}
          if(ex){ex.content=text;ex.mtime=Date.now();saveVfs();bus.emit('vfs');}
          else addNode(parentPath(p),mkText(baseName(p),text));
          ok(`записано в ${fname} (${new Blob([text]).size} Б)`);}
        else print(esc(text));break;}
      case'clear':out.innerHTML='';break;
      case'date':print(esc(new Date().toLocaleString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})));break;
      case'whoami':print(esc(settings.username));break;
      case'uptime':print(`аптайм: ${fmtUp((Date.now()-session.bootTime)/1000)}`);break;
      case'history':hist.forEach((h,i)=>print(`<span class="dim">${String(i+1).padStart(3)}</span>  ${esc(h)}`));break;
      case'neofetch':{
        const art=['   ·  ✦  ·  * ','  ┌─────────┐ ','  │  ◕   ◕  │ ','  │    ▽    │ ','  └─────────┘ ','   *  ·  ✦  · '];
        const inf=[`${settings.username}@nebula`,'─────────────',`ОС: NEBULA OS 1.0 «Пульсар»`,`Ядро: 6.2.0-nebula`,`Аптайм: ${fmtUp((Date.now()-session.bootTime)/1000)}`,`Оболочка: NebulaShell 1.0`,`Экран: ${innerWidth}×${innerHeight}`,`Обои: ${WALL_NAMES[settings.wallpaper]}`,`Акцент: ${ACCENTS[settings.accent].name}`,`Окна: ${WM.wins.size}`,`FPS обоев: ${Wall.fps}`];
        const rows=Math.max(art.length,inf.length);
        let html='<pre>';for(let i=0;i<rows;i++){html+=`<span class="acc">${esc((art[i]||'').padEnd(15))}</span>${esc(inf[i]||'')}\n`;}html+='</pre>';print(html);break;}
      case'open':{const a=APP_ALIAS[(args[0]||'').toLowerCase()];
        if(!a){err('open: укажите приложение (файлы, блокнот, графика, музыка, сапёр, монитор, настройки, просмотр, справка, калькулятор)');break;}
        let params={};
        if(args[1]&&(a==='explorer'||a==='editor'||a==='viewer')){const p=resolve(args[1]);const n=nodeAt(p);
          if(!n){err(`open: ${args[1]}: не найдено`);break;}
          params=a==='explorer'?{path:p}:{id:n.id};}
        WM.open(a,params);ok(`запуск: ${Apps[a].name}`);break;}
      case'theme':{const t=(args[0]||'').toLowerCase();
        if(!ACCENTS[t]){err('theme: violet · cyan · magenta · amber · lime · azure');break;}
        setSetting('accent',t);ok(`акцент: ${ACCENTS[t].name}`);break;}
      case'wallpaper':{const keys=Object.keys(WALL_NAMES);let k=args[0];
        if(/^[1-4]$/.test(k))k=keys[+k-1];
        if(!WALL_NAMES[k]){err('wallpaper: 1 (Аврора) · 2 (Туманность) · 3 (Пульсар) · 4 (Закат)');break;}
        setSetting('wallpaper',k);ok(`обои: ${WALL_NAMES[k]}`);break;}
      case'music':{const a=(args[0]||'').toLowerCase();
        if(a==='play'){Music.play();ok('Волна FM: в эфире — '+Music.presets[Music.preset].name);}
        else if(a==='stop'){Music.stop();ok('эфир остановлен');}
        else if(a==='next'){Music.setPreset((Music.preset+1)%Music.presets.length);if(!Music.playing)Music.play();ok('станция: '+Music.presets[Music.preset].name);}
        else err('music: play · stop · next');break;}
      case'notify':notify('info','Из терминала',args.join(' ')||'привет, космос ✦');ok('уведомление отправлено');break;
      case'sudo':err(`${settings.username} не входит в список sudoers. Инцидент будет доложен Звёздному совету. 🛸`);Audio.sfx('error');break;
      case'about':info('NEBULA OS 1.0 «Пульсар» — сборка 2026.11.19. Vanilla JS · Canvas 2D · Web Audio.');break;
      case'reboot':print('Перезагрузка…','warn');setTimeout(()=>bus.emit('power','restart'),400);break;
      case'exit':WM.close(win);break;
      default:err(`команда не найдена: ${cmd} — введите help`);Audio.sfx('error');
    }}catch(e){err('ошибка: '+e.message);}
    out.scrollTop=out.scrollHeight;
  }
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){const v=inp.value;inp.value='';exec(v);}
    else if(e.key==='ArrowUp'){e.preventDefault();if(hi>0){hi--;inp.value=hist[hi]||'';}setTimeout(()=>inp.setSelectionRange(999,999));}
    else if(e.key==='ArrowDown'){e.preventDefault();if(hi<hist.length){hi++;inp.value=hist[hi]||'';}}
    else if(e.key==='Tab'){e.preventDefault();
      const parts=inp.value.split(' ');const last=parts[parts.length-1];
      const pool=parts.length===1?CMDS:(nodeAt(cwd)?.children||[]).map(c=>c.name+(c.type==='dir'?'/':''));
      const m=pool.filter(x=>x.toLowerCase().startsWith(last.toLowerCase()));
      if(m.length===1){parts[parts.length-1]=m[0];inp.value=parts.join(' ')+(parts.length===1?' ':'');}
      else if(m.length>1){echoCmd(inp.value);print(m.map(esc).join('  '),'dim');}}
    else if(e.ctrlKey&&e.code==='KeyL'){e.preventDefault();out.innerHTML='';}
    else if(e.ctrlKey&&e.code==='KeyC'){e.preventDefault();echoCmd(inp.value+'^C');inp.value='';}
  });
  body.addEventListener('pointerup',()=>{if(!getSelection().toString())inp.focus();});
  syncPs();setTimeout(()=>inp.focus(),80);
  const off=bus.on('settings',k=>{if(k==='username')syncPs();});
  return{onClose:off};
}};