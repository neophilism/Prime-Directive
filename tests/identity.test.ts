import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {IdentityStore,AccessError,principalId} from '../src/server/identity.ts';
import type {VerifiedIdentity,Role,Scope} from '../src/server/identity.ts';
const START=1_800_000_000_000;
function fixture(path=':memory:'){
  let now=START;const store=new IdentityStore(path,()=>now);
  const identity=(subject:string,kind:'human'|'connector'='human',mfa=true):VerifiedIdentity=>({issuer:'https://identity.example',subject,kind,authenticatedAt:now,mfaAt:mfa?now:null});
  const owner=identity('owner');store.provision('workspace',owner);
  const login=(id:VerifiedIdentity,workspace='workspace')=>store.exchange({verify:async()=>id},'verified-test-assertion',workspace);
  return {store,owner,identity,login,advance:(ms:number)=>{now+=ms;}};
}
function denied(fn:()=>unknown,status:number){assert.throws(fn,(e:unknown)=>e instanceof AccessError&&e.status===status);}
test('role matrix is distinct and caller claims never override stored authority',async()=>{
  const f=fixture();try{
    const owner=(await f.login(f.owner)).token;
    for(const role of ['owner','collaborator','observer','connector'] as Role[]){
      const id=f.identity(role+'-member',role==='connector'?'connector':'human');
      f.store.setMembership(owner,{principalId:principalId(id),role,kind:id.kind,active:true,expectedRevision:0});
      const token=(await f.login(id)).token;
      const allowed:Record<Role,Scope[]>={owner:['workspace.read','work.write','experience.review','membership.admin','mandate.issue'],collaborator:['workspace.read','work.write'],observer:['workspace.read'],connector:['connector.execute']};
      for(const scope of ['workspace.read','work.write','experience.review','membership.admin','mandate.issue','connector.execute'] as Scope[]){
        if(allowed[role].includes(scope))assert.equal(f.store.authorize(token,scope).role,role);else denied(()=>f.store.authorize(token,scope),403);
      }
    }
    denied(()=>f.store.authorize('owner','membership.admin'),401);
    assert.notEqual(principalId({issuer:'a',subject:'b:c'}),principalId({issuer:'a:b',subject:'c'}));
  }finally{f.store.close();}
});
test('revocation immediately invalidates stale mandate sessions and regrant does not revive them',async()=>{
  const f=fixture();try{
    const owner=(await f.login(f.owner)).token,id=f.identity('delegate');
    f.store.setMembership(owner,{principalId:principalId(id),role:'owner',kind:'human',active:true,expectedRevision:0});
    const token=(await f.login(id)).token;f.store.authorize(token,'mandate.issue');
    f.store.setMembership(owner,{principalId:principalId(id),role:'owner',kind:'human',active:false,expectedRevision:1});
    denied(()=>f.store.authorize(token,'mandate.issue'),403);
    f.store.setMembership(owner,{principalId:principalId(id),role:'owner',kind:'human',active:true,expectedRevision:2});
    denied(()=>f.store.authorize(token,'mandate.issue'),403);
    assert.equal(f.store.authorize((await f.login(id)).token,'mandate.issue').id,principalId(id));
    denied(()=>f.store.setMembership(owner,{principalId:principalId(id),role:'observer',kind:'human',active:true,expectedRevision:1}),409);
  }finally{f.store.close();}
});
test('sensitive administration requires fresh provider-verified MFA, session expiry and logout fail closed',async()=>{
  const f=fixture();try{
    const single=(await f.login({...f.owner,mfaAt:null})).token;
    f.store.authorize(single,'workspace.read');denied(()=>f.store.memberships(single),403);denied(()=>f.store.authorize(single,'mandate.issue'),403);
    const strong=(await f.login(f.owner)).token;f.advance(300001);denied(()=>f.store.authorize(strong,'mandate.issue'),403);
    f.store.authorize(strong,'work.write');f.store.revokeSession(strong);denied(()=>f.store.authorize(strong,'work.write'),401);
    f.advance(8*60*60*1000);denied(()=>f.store.authorize(single,'workspace.read'),401);
    await assert.rejects(f.login(f.owner),/Stale/);
  }finally{f.store.close();}
});
test('delegation is a bounded intersection and revoking its grantor stops access',async()=>{
  const f=fixture();try{
    const owner=(await f.login(f.owner)).token,id=f.identity('bounded');
    const grant={principalId:principalId(id),role:'collaborator' as Role,kind:'human' as const,active:true,expectedRevision:0,delegated:true,expiresAt:START+60000,scopes:['workspace.read'] as Scope[]};
    denied(()=>f.store.setMembership(owner,{...grant,scopes:['membership.admin']}),400);
    denied(()=>f.store.setMembership(owner,{...grant,expiresAt:null}),400);
    denied(()=>f.store.setMembership(owner,{...grant,role:'owner'}),400);
    f.store.setMembership(owner,grant);const session=(await f.login(id)).token;
    f.store.authorize(session,'workspace.read');denied(()=>f.store.authorize(session,'work.write'),403);
    const second=f.identity('second-owner');f.store.setMembership(owner,{principalId:principalId(second),role:'owner',kind:'human',active:true,expectedRevision:0});
    const secondToken=(await f.login(second)).token;
    f.store.setMembership(secondToken,{principalId:principalId(f.owner),role:'observer',kind:'human',active:true,expectedRevision:1});
    denied(()=>f.store.authorize(session,'workspace.read'),403);
    const later=f.identity('expired');f.store.setMembership(secondToken,{...grant,principalId:principalId(later)});
    const expiring=(await f.login(later)).token;f.advance(60000);denied(()=>f.store.authorize(expiring,'workspace.read'),401);
  }finally{f.store.close();}
});
test('cross-workspace sessions, malformed provider results and provider failures are denied',async()=>{
  const f=fixture();try{
    await assert.rejects(f.login(f.owner,'foreign'),/Membership/);
    await assert.rejects(f.store.exchange({verify:async()=>{throw new Error('upstream secret');}},'opaque','workspace'),/Authentication failed/);
    for(const patch of [{authenticatedAt:START+1},{mfaAt:START+1},{authenticatedAt:NaN},{kind:'owner'},{issuer:''}]){
      await assert.rejects(f.login({...f.owner,...patch} as VerifiedIdentity));
    }
    const token=(await f.login(f.owner)).token,other=f.identity('connector','connector');
    f.store.setMembership(token,{principalId:principalId(other),role:'connector',kind:'connector',active:true,expectedRevision:0});
    await assert.rejects(f.login({...other,kind:'human'}),/kind mismatch/);
    denied(()=>f.store.provision('workspace',f.owner),409);
    denied(()=>f.store.setMembership(token,{principalId:principalId(f.owner),role:'observer',kind:'human',active:true,expectedRevision:1}),409);
    denied(()=>f.store.setMembership(token,{principalId:principalId(f.owner),role:'owner',kind:'human',active:true,expectedRevision:1,scopes:['workspace.read']}),400);
  }finally{f.store.close();}
});
test('sessions and revocation survive restart and a second database connection observes changes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pd-identity-')),path=join(dir,'access.sqlite');
  const f=fixture(path);let second:IdentityStore|undefined;
  try{
    const owner=(await f.login(f.owner)).token,id=f.identity('reader');
    f.store.setMembership(owner,{principalId:principalId(id),role:'observer',kind:'human',active:true,expectedRevision:0});
    const token=(await f.login(id)).token;second=new IdentityStore(path,()=>START);
    second.authorize(token,'workspace.read');
    f.store.setMembership(owner,{principalId:principalId(id),role:'observer',kind:'human',active:false,expectedRevision:1});
    denied(()=>second!.authorize(token,'workspace.read'),403);
    second.close();second=new IdentityStore(path,()=>START);denied(()=>second!.authorize(token,'workspace.read'),403);
    assert.equal(readFileSync(path).includes(Buffer.from(token)),false);
    assert.equal(readFileSync(path+'-wal').includes(Buffer.from(token)),false);
  }finally{second?.close();f.store.close();rmSync(dir,{recursive:true,force:true});}
});
