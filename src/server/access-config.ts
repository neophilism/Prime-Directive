import {readFileSync} from 'node:fs';
import {AccessError,IdentityStore} from './identity.ts';
import {SignedIdentityVerifier} from './signed-identity.ts';
import {record,exactKeys} from '../domain/graph.ts';

/** Trusted operator configuration. This file is never accepted through HTTP. */
export function configuredAccess(path:string,databasePath:string){
  const bytes=readFileSync(path);if(bytes.length>65536)throw new Error('Access configuration too large');
  const config=record(JSON.parse(bytes.toString('utf8')));
  exactKeys(config,['issuer','audience','keys','ownerSubject','workspaceId']);
  if(typeof config.issuer!=='string'||typeof config.audience!=='string'||typeof config.ownerSubject!=='string'||typeof config.workspaceId!=='string')throw new Error('Incomplete access configuration');
  const keys=record(config.keys);if(Object.values(keys).some(key=>typeof key!=='string'))throw new Error('Invalid public keys');
  const store=new IdentityStore(databasePath);
  try{
    const verifier=new SignedIdentityVerifier({issuer:config.issuer,audience:config.audience,kind:'human',keys:keys as Record<string,string>,replay:store});
    try{store.provision(config.workspaceId,{issuer:config.issuer,subject:config.ownerSubject,kind:'human',authenticatedAt:Date.now(),mfaAt:null});}
    catch(error){if(!(error instanceof AccessError)||error.status!==409)throw error;}
    return {store,verifier};
  }catch(error){store.close();throw error;}
}
