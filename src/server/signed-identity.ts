import {createPublicKey,verify,constants} from 'node:crypto';
import type {KeyObject} from 'node:crypto';
import {AccessError,principalId} from './identity.ts';
import type {IdentityVerifier,VerifiedIdentity} from './identity.ts';
export interface AssertionReplayStore {consumeAssertion(id:string,expiresAt:number):void}
function invalid():never{throw new AccessError(401,'Invalid signed authentication assertion');}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))invalid();return value as Record<string,unknown>;}
function decode(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))invalid();const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)invalid();return bytes;}
function numeric(value:unknown):value is number{return Number.isSafeInteger(value)&&Number(value)>=0;}

/** Narrow, application-specific assertion contract, not a general OIDC ID-token client.
 * The trusted identity broker verifies its login/MFA flow before minting this token.
 * Keys and principal kind are configured by the operator, never selected by claims. */
export class SignedIdentityVerifier implements IdentityVerifier {
  private keys:Map<string,KeyObject>;private issuer:string;private audience:string;
  private kind:'human'|'connector';private replay:AssertionReplayStore;private now:()=>number;
  constructor(config:{issuer:string;audience:string;kind:'human'|'connector';keys:Record<string,string>;replay:AssertionReplayStore;now?:()=>number}){
    if(new URL(config.issuer).protocol!=='https:'||!config.audience||config.audience.length>256||!['human','connector'].includes(config.kind))throw new Error('Invalid identity verifier configuration');
    this.issuer=config.issuer;this.audience=config.audience;this.kind=config.kind;this.replay=config.replay;this.now=config.now??Date.now;
    this.keys=new Map(Object.entries(config.keys).map(([id,pem])=>{
      if(!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw new Error('Invalid identity key identifier');
      const key=createPublicKey(pem);
      if(key.asymmetricKeyType!=='rsa'||Number(key.asymmetricKeyDetails?.modulusLength)<2048)throw new Error('Identity signing key must be RSA with at least 2048 bits');
      return [id,key];
    }));
    if(this.keys.size===0)throw new Error('Identity signing keys are required');
  }
  async verify(assertion:string):Promise<VerifiedIdentity>{
    try{
      if(typeof assertion!=='string'||assertion.length>16384)invalid();
      const parts=assertion.split('.');if(parts.length!==3)invalid();
      const header=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0]))));
      if(Object.keys(header).some(k=>!['alg','typ','kid'].includes(k))||header.alg!=='RS256'||header.typ!=='pd-session+jwt'||typeof header.kid!=='string')invalid();
      const key=this.keys.get(header.kid);if(!key)invalid();
      if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),{key,padding:constants.RSA_PKCS1_PADDING},decode(parts[2])))invalid();
      const body=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1]))));
      const now=Math.floor(this.now()/1000);
      if(body.iss!==this.issuer||body.aud!==this.audience||body.purpose!=='session-exchange'||typeof body.sub!=='string'||
        typeof body.jti!=='string'||! /^[A-Za-z0-9_-]{16,128}$/.test(body.jti)||!numeric(body.iat)||!numeric(body.exp)||!numeric(body.auth_time)||
        body.iat>now||body.auth_time>body.iat||now-body.auth_time>300||body.exp<=now||body.exp<=body.iat||body.exp-body.iat>300||
        (body.nbf!==undefined&&(!numeric(body.nbf)||body.nbf>now)))invalid();
      if(body.amr!==undefined&&(!Array.isArray(body.amr)||body.amr.some(v=>typeof v!=='string')))invalid();
      const mfa=this.kind==='human'&&Array.isArray(body.amr)&&body.amr.includes('mfa');
      const identity:VerifiedIdentity={issuer:this.issuer,subject:body.sub,kind:this.kind,authenticatedAt:body.auth_time*1000,mfaAt:mfa?body.auth_time*1000:null};
      principalId(identity);
      // Durable uniqueness prevents replay across restarts and parallel server processes.
      this.replay.consumeAssertion(createPublicKeyFingerprint(this.issuer,body.jti),body.exp*1000);
      return identity;
    }catch(error){if(error instanceof AccessError)throw error;invalid();}
  }
}
function createPublicKeyFingerprint(issuer:string,jti:string){
  // The issuer is public routing data; this receipt contains no token or subject.
  return principalId({issuer,subject:jti});
}
