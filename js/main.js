import {applySettings} from './core/settings.js';
import {loadVfs} from './core/vfs.js';
import {Wall} from './core/wallpaper.js';
import {initShell} from './shell.js';
import {bootSequence} from './boot.js';

applySettings();
loadVfs();
Wall.init();
initShell();
bootSequence();