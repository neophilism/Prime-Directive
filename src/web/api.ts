import type {WorkspaceSnapshot} from '../domain/workers.ts';
export async function getJSON<T>(path:string,signal?:AbortSignal):Promise<T> {
  const response=await fetch(path,{signal});
  if(!response.ok)throw new Error((await response.json()).error??'Could not load workspace');
  return response.json() as Promise<T>;
}
export async function sendCommand(body:Record<string,unknown>):Promise<{snapshot:WorkspaceSnapshot;result:{changed?:boolean;reason?:string}}> {
  const response=await fetch('/api/commands',{method:'POST',headers:{'content-type':'application/json','x-prime-directive':'local-ui'},body:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw new Error(value.error??'Command failed');return value;
}
