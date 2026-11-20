import {WM} from '../wm.js';
export function openFileNode(node,path){
  if(node.type==='dir')WM.open('explorer',{path});
  else if(node.type==='image')WM.open('viewer',{id:node.id});
  else WM.open('editor',{id:node.id});
}