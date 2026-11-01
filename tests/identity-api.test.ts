import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {IdentityStore,principalId} from '../src/server/identity.ts';
import type {VerifiedIdentity,Role} from '../src/server/identity.ts';
import {WorkspaceStore} from '../src/server/store.ts';
import {createApplication} from '../src/server/app.ts';
import {initializeSimulation} from '../src/server/simulation.ts';
import {exampleGraph} from '../src/domain/example.ts';
async function fixture(){
  const now=Date.now(),access=new IdentityStore(':memory:'),store=new WorkspaceStore(':memory:');initializeSimulation(store);
  const identities=new Map<string,VerifiedIdentity>();
  for(const name of ['owner','collaborator','observer','connector','single-factor'])identities.set(name,{issuer:'test-provider',subject:name,kind:name==='connector'?'connector':'human',authenticatedAt:now,mfaAt:name==='single-factor'?null:now});
  access.provision('local-demo',identities.get('owner')!);
  const app=createApplication(store,{access:{store:access,verifier:{verify:async assertion=>{
    const id=identities.get(assertion);if(!id)throw new Error('invalid assertion');return id;
  }}},heartbeatMs:10});
  await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));const address=app.server.address();
  if(!address||typeof address==='string')throw new Error('No address');const base=`http://127.0.0.1:${address.port}`;
  const call=(path:string,token='',method='GET',body?:unknown)=>fetch(base+path,{method,headers:{authorization:'Bearer '+token,origin:base,'x-prime-directive':'local-ui','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const login=async(name:string,workspaceId='local-demo')=>{
    const response=await call('/api/session',name,'POST',{workspaceId});assert.equal(response.status,200);
    return (await response.json() as {token:string}).token;
  };
  const owner=await login('owner');
  for(const role of ['collaborator','observer','connector','single-factor']){
    const actual=(role==='single-factor'?'owner':role) as Role;
    access.setMembership(owner,{principalId:principalId(identities.get(role)!),role:actual,kind:role==='connector'?'connector':'human',active:true,expectedRevision:0});
  }
  return {store,access,base,owner,call,login,identities,close:async()=>{await app.close();access.close();store.close();}};
}
test('authenticated API rejects missing sessions, forged owner fields, observer writes and connector reads',async()=>{
  const f=await fixture();try{
    assert.equal((await f.call('/api/workspace')).status,401);
    assert.equal((await f.call('/api/session','owner','POST',{workspaceId:'local-demo',role:'owner',mfaAt:Date.now()})).status,400);
    assert.equal((await f.call('/api/session','forged','POST',{workspaceId:'local-demo'})).status,401);
    const observer=await f.login('observer'),collaborator=await f.login('collaborator'),connector=await f.login('connector');
    assert.equal((await f.call('/api/workspace',observer)).status,200);
    assert.equal((await f.call('/api/commands',observer,'POST',{type:'step'})).status,403);
    assert.equal((await f.call('/api/commands',collaborator,'POST',{type:'step'})).status,200);
    assert.equal((await f.call('/api/memberships',collaborator)).status,403);
    assert.equal((await f.call('/api/workspace',connector)).status,403);
    assert.equal((await f.call('/api/session',connector,'DELETE')).status,200);
    assert.throws(()=>f.access.authorize(connector,'connector.execute'),/Session unavailable/);
    assert.equal((await f.call('/api/memberships',await f.login('single-factor'))).status,403);
  }finally{await f.close();}
});
test('membership admin uses verified MFA, revision preconditions and the session workspace',async()=>{
  const f=await fixture();try{
    const target={principalId:principalId(f.identities.get('observer')!),role:'collaborator',kind:'human',active:true,expectedRevision:1};
    assert.equal((await f.call('/api/memberships',f.owner,'POST',{...target,workspaceId:'foreign'})).status,400);
    assert.equal((await f.call('/api/memberships',f.owner,'POST',target)).status,200);
    assert.equal((await f.call('/api/memberships',f.owner,'POST',target)).status,409);
    const foreign={...exampleGraph(),id:'foreign-directive',workspaceId:'foreign'};f.store.initialize(foreign);
    const snapshot=await (await f.call('/api/workspace?workspaceId=foreign',f.owner)).json() as {graph:{workspaceId:string}};
    assert.equal(snapshot.graph.workspaceId,'local-demo');
    assert.equal((await f.call('/api/session','owner','POST',{workspaceId:'foreign'})).status,403);
  }finally{await f.close();}
});
test('revocation during an incomplete request is rechecked before any command effect',async()=>{
  const f=await fixture();try{
    const token=await f.login('collaborator'),before=f.store.snapshot('local-demo').graph.revision;
    const body=JSON.stringify({type:'step'});
    const response=new Promise<number>((resolve,reject)=>{
      const req=request(f.base+'/api/commands',{method:'POST',headers:{authorization:'Bearer '+token,origin:f.base,'x-prime-directive':'local-ui','content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode!));});
      req.on('error',reject);req.flushHeaders();req.write(body.slice(0,1));
      f.access.setMembership(f.owner,{principalId:principalId(f.identities.get('collaborator')!),role:'collaborator',kind:'human',active:false,expectedRevision:1});
      req.end(body.slice(1));
    });
    assert.equal(await response,403);assert.equal(f.store.snapshot('local-demo').graph.revision,before);
  }finally{await f.close();}
});
test('a revoked membership closes its existing authenticated event stream',async()=>{
  const f=await fixture();const abort=new AbortController();try{
    const token=await f.login('observer');
    const response=await fetch(f.base+'/api/events',{headers:{authorization:'Bearer '+token},signal:abort.signal});
    assert.equal(response.status,200);const reader=response.body!.getReader();await reader.read();
    f.access.setMembership(f.owner,{principalId:principalId(f.identities.get('observer')!),role:'observer',kind:'human',active:false,expectedRevision:1});
    const timeout=setTimeout(()=>abort.abort(),2000);
    try{while(!(await reader.read()).done){};}finally{clearTimeout(timeout);}
    assert.equal((await f.call('/api/activity',token)).status,403);
  }finally{abort.abort();await f.close();}
});
