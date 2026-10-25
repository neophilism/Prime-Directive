import {record, requireText, exactKeys, DomainError} from './graph.ts';
export const occupancySources = ['activeCredentials','ownerReservations','logicalAgents','primeDirectiveClaims'] as const;
export interface NameInventory {
  ownerScope:string; revision:string; capturedAt:string;
  complete:Record<typeof occupancySources[number],boolean>;
  occupied:Record<typeof occupancySources[number],string[]>;
}
export interface NameAvailability {
  state:'verified-snapshot'|'unknown'; candidates:string[]; occupiedCount:number|null;
  catalogCount:number; inventoryRevision:string|null; reason:string;
  // A complete read does not solve a cross-application write race.
  liveAllocationEnabled:false;
}
export function validateCatalog(value:unknown):readonly string[] {
  const r=record(value);
  if (r.schemaVersion !== 1 || !Array.isArray(r.names) || r.names.length < 1 || r.names.length > 10000) throw new DomainError('invalid','Invalid name catalog');
  r.names.forEach(n => requireText(n,100,'catalog name'));
  if (new Set(r.names).size !== r.names.length) throw new DomainError('duplicate','Duplicate exact catalog name');
  return Object.freeze([...r.names] as string[]);
}
export function unknownAvailability(catalog:readonly string[],reason:string):NameAvailability {
  return {state:'unknown',candidates:[],occupiedCount:null,catalogCount:catalog.length,inventoryRevision:null,reason,liveAllocationEnabled:false};
}
/** Input must originate from the configured authenticated inventory port, never a browser upload. */
export function availableNames(catalog:readonly string[],value:unknown,ownerScope:string,now:number,maxAgeMs=60000):NameAvailability {
  try {
    const r=record(value);
    exactKeys(r,['ownerScope','revision','capturedAt','complete','occupied']);
    requireText(r.revision,200,'inventory revision');requireText(r.capturedAt,50,'capture time');
    if (r.ownerScope !== ownerScope || !Number.isSafeInteger(now) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 300000)
      return unknownAvailability(catalog,'Inventory scope or freshness policy is invalid.');
    const captured=Date.parse(r.capturedAt);
    if (!Number.isFinite(captured) || new Date(captured).toISOString() !== r.capturedAt || captured > now || now-captured > maxAgeMs)
      return unknownAvailability(catalog,'Inventory is stale or has an invalid timestamp.');
    const complete=record(r.complete),occupied=record(r.occupied);
    exactKeys(complete,occupancySources);exactKeys(occupied,occupancySources);
    const used=new Set<string>();
    for (const source of occupancySources) {
      const names=occupied[source];
      if (complete[source] !== true || !Array.isArray(names) || names.length > 10000)
        return unknownAvailability(catalog,'Every occupancy source must be complete.');
      for (const name of names) {requireText(name,100,'occupied name');used.add(name);}
    }
    const candidates=catalog.filter(name => !used.has(name));
    return {state:'verified-snapshot',candidates,occupiedCount:catalog.length-candidates.length,catalogCount:catalog.length,
      inventoryRevision:r.revision,reason:'Current inventory checked. Live allocation still requires the shared atomic name authority.',liveAllocationEnabled:false};
  } catch {return unknownAvailability(catalog,'Inventory could not be validated.');}
}

export interface NameClaim {
  claimId:string; ownerScope:string; workerId:string; name:string; version:number;
}
/** Both applications must use this same authority; a local unique constraint is insufficient. */
export interface SharedNameAuthority {
  reserve(request:{ownerScope:string;workerId:string;name:string;idempotencyKey:string;expectedInventoryRevision:string},signal:AbortSignal):Promise<NameClaim>;
  inspect(claimId:string,signal:AbortSignal):Promise<NameClaim|null>;
  release(claimId:string,expectedVersion:number,signal:AbortSignal):Promise<void>;
}
