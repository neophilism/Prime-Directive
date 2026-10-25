import {validId} from './graph.ts';
import type {Orientation} from './projection.ts';
export type ViewSelection={type:'work'|'worker';id:string}|{type:'activity'|'workforce'|'names'}|null;
export interface ViewPreferences {version:1;orientation:Orientation;collapsed:string[];view:'map'|'outline';query:string;motion:'system'|'reduced';focus:ViewSelection}
export function defaultPreferences():ViewPreferences {return {version:1,orientation:'horizontal',collapsed:['materials'],view:'map',query:'',motion:'system',focus:{type:'work',id:'root'}};}
/** Saved presentation preferences never carry canonical graph state or commands. */
export function parsePreferences(raw:string|null):ViewPreferences {
  try {
    if(!raw||raw.length>65536)return defaultPreferences();
    const p=JSON.parse(raw);
    if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join()!==['version','orientation','collapsed','view','query','motion','focus'].sort().join()||p.version!==1||
      !['horizontal','vertical'].includes(p.orientation)||!['map','outline'].includes(p.view)||!['system','reduced'].includes(p.motion)||
      typeof p.query!=='string'||p.query.length>120||!Array.isArray(p.collapsed)||p.collapsed.length>5000||!p.collapsed.every(validId)||new Set(p.collapsed).size!==p.collapsed.length)return defaultPreferences();
    if(p.focus!==null){
      if(!p.focus||typeof p.focus!=='object'||Array.isArray(p.focus))return defaultPreferences();
      if(['work','worker'].includes(p.focus.type)){if(!validId(p.focus.id)||Object.keys(p.focus).sort().join()!=='id,type')return defaultPreferences();}
      else if(!['activity','workforce','names'].includes(p.focus.type)||Object.keys(p.focus).join()!=='type')return defaultPreferences();
    }
    return p as ViewPreferences;
  }catch{return defaultPreferences();}
}
