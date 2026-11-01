import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {IdentityStore} from '../src/server/identity.ts';
import {SignedIdentityVerifier} from '../src/server/signed-identity.ts';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const other=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=publicKey.export({type:'spki',format:'pem'}).toString();
const now=1_800_000_000_000,seconds=now/1000;
function token(patch:Record<string,unknown>={},header:Record<string,unknown>={},key=privateKey){
  const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'pd-session+jwt',kid:'current',...header})).toString('base64url');
  const b=Buffer.from(JSON.stringify({iss:'https://broker.example',aud:'prime-directive',purpose:'session-exchange',sub:'owner',jti:randomBytes(16).toString('base64url'),iat:seconds,exp:seconds+60,auth_time:seconds,amr:['mfa'],...patch})).toString('base64url');
  return h+'.'+b+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+b),key).toString('base64url');
}
function fixture(){const store=new IdentityStore(':memory:',()=>now);const verifier=new SignedIdentityVerifier({issuer:'https://broker.example',audience:'prime-directive',kind:'human',keys:{current:pem},replay:store,now:()=>now});return {store,verifier};}
test('pinned signed identity exchanges into a scoped session and replay is refused',async()=>{
  const f=fixture();try{
    const assertion=token();f.store.provision('w',{issuer:'https://broker.example',subject:'owner',kind:'human',authenticatedAt:now,mfaAt:now});
    const session=await f.store.exchange(f.verifier,assertion,'w');assert.equal(f.store.authorize(session.token,'mandate.issue').role,'owner');
    await assert.rejects(f.store.exchange(f.verifier,assertion,'w'),/Authentication failed/);
    const second=new SignedIdentityVerifier({issuer:'https://broker.example',audience:'prime-directive',kind:'human',keys:{current:pem},replay:f.store,now:()=>now});
    await assert.rejects(second.verify(assertion),/already consumed/);
  }finally{f.store.close();}
});
test('signature, issuer, audience, token purpose, algorithm and supplied key URLs cannot be substituted',async()=>{
  const f=fixture();try{
    for(const bad of [token({}, {},other.privateKey),token({iss:'https://evil.example'}),token({aud:'other-app'}),token({aud:['prime-directive','other']}),token({purpose:'access'}),token({}, {alg:'none'}),token({}, {alg:'HS256'}),token({}, {typ:'JWT'}),token({}, {kid:'unknown'}),token({}, {jku:'https://evil.example/keys'}),token()+'.extra'])await assert.rejects(f.verifier.verify(bad));
  }finally{f.store.close();}
});
test('expired, future, stale authentication and malformed claims fail closed',async()=>{
  const f=fixture();try{
    for(const patch of [{exp:seconds},{exp:seconds+301},{iat:seconds+1},{auth_time:seconds-301},{auth_time:seconds+1},{nbf:seconds+1},{jti:'short'},{sub:''},{amr:'mfa'},{exp:'later'}])await assert.rejects(f.verifier.verify(token(patch)));
    const single=await f.verifier.verify(token({amr:['pwd']}));assert.equal(single.mfaAt,null);
    const connector=new SignedIdentityVerifier({issuer:'https://broker.example',audience:'prime-directive',kind:'connector',keys:{current:pem},replay:f.store,now:()=>now});
    assert.equal((await connector.verify(token({kind:'human',role:'owner'}))).mfaAt,null);
  }finally{f.store.close();}
});
