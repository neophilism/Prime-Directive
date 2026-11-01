import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configuredAccess} from '../src/server/access-config.ts';
const key=generateKeyPairSync('rsa',{modulusLength:2048}).publicKey.export({type:'spki',format:'pem'}).toString();
test('trusted startup config provisions once and reopening never changes existing ownership',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pd-access-')),file=join(dir,'access.json'),database=join(dir,'state.sqlite');
  const config={issuer:'https://identity.example',audience:'pd',keys:{current:key},ownerSubject:'original-owner',workspaceId:'local-demo'};
  try{
    writeFileSync(file,JSON.stringify(config));let access=configuredAccess(file,database);access.store.close();
    writeFileSync(file,JSON.stringify({...config,ownerSubject:'replacement-owner'}));access=configuredAccess(file,database);
    try{
      await assert.rejects(access.store.exchange({verify:async()=>({issuer:config.issuer,subject:'replacement-owner',kind:'human',authenticatedAt:Date.now(),mfaAt:null})},'test','local-demo'),/Membership/);
      const session=await access.store.exchange({verify:async()=>({issuer:config.issuer,subject:'original-owner',kind:'human',authenticatedAt:Date.now(),mfaAt:null})},'test','local-demo');
      assert.equal(access.store.authorize(session.token,'workspace.read').role,'owner');
    }finally{access.store.close();}
    for(const patch of [{issuer:'http://insecure.example'},{keys:{}},{keys:{current:'not a key'}},{unknown:'claim'}]){
      writeFileSync(file,JSON.stringify({...config,...patch}));assert.throws(()=>configuredAccess(file,database));
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
