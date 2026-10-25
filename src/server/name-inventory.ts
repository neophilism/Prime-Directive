import {readFileSync} from 'node:fs';
import {availableNames, unknownAvailability, validateCatalog} from '../domain/names.ts';
import type {NameAvailability} from '../domain/names.ts';
export const approvedNames=validateCatalog(JSON.parse(readFileSync(new URL('../../registry/agent-names.json',import.meta.url),'utf8')));

/** Server-owned authenticated adapter port. Private account metadata must be discarded upstream. */
export interface NameInventoryProvider {
  read(ownerScope:string,signal:AbortSignal):Promise<unknown>;
}
export async function readNameAvailability(provider:NameInventoryProvider|null,ownerScope:string,timeoutMs=3000):Promise<NameAvailability> {
  if (!provider) return unknownAvailability(approvedNames,'Boardroom inventory and shared name reservations are not connected. No names have been allocated.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error('Invalid inventory timeout');
  const controller=new AbortController(); let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const timeout=new Promise<never>((_,reject) => {timer=setTimeout(() => {controller.abort();reject(new Error('Inventory timeout'));},timeoutMs);});
    const snapshot=await Promise.race([provider.read(ownerScope,controller.signal),timeout]);
    return availableNames(approvedNames,snapshot,ownerScope,Date.now());
  } catch {return unknownAvailability(approvedNames,'The authenticated name inventory is unavailable.');}
  finally {if (timer) clearTimeout(timer);}
}
