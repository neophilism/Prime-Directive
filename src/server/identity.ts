import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';

export type Role='owner'|'collaborator'|'observer'|'connector';
export type Scope='workspace.read'|'work.write'|'experience.review'|'membership.admin'|'mandate.issue'|'connector.execute';
export interface VerifiedIdentity {issuer:string;subject:string;kind:'human'|'connector';authenticatedAt:number;mfaAt:number|null}
/** Implementations must verify issuer, signature, audience, expiry and replay before returning. */
export interface IdentityVerifier {verify(assertion:string):Promise<VerifiedIdentity>}
export class AccessError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const roles:Record<Role,readonly Scope[]>={owner:['workspace.read','work.write','experience.review','membership.admin','mandate.issue'],collaborator:['workspace.read','work.write'],observer:['workspace.read'],connector:['connector.execute']};
const MAX_SESSION=8*60*60*1000, STEP_UP=5*60*1000;
type Row=Record<string,unknown>;
export interface AccessPrincipal {id:string;workspaceId:string;role:Role;scopes:Scope[]}
function fail(status:number,message:string):never{throw new AccessError(status,message);}
function text(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=256&&!/[\x00-\x1f\x7f]/.test(value);}
export function principalId(identity:Pick<VerifiedIdentity,'issuer'|'subject'>):string {
  if(!identity||!text(identity.issuer)||!text(identity.subject))fail(401,'Invalid verified identity');
  return createHash('sha256').update(JSON.stringify([identity.issuer,identity.subject])).digest('hex');
}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
function validRole(value:unknown):value is Role{return typeof value==='string'&&Object.hasOwn(roles,value);}

/** Persistent authorization reference. No passwords, assertions or bearer tokens are stored. */
export class IdentityStore {
  private db:DatabaseSync;private now:()=>number;
  constructor(path:string,now:()=>number=Date.now){
    this.now=now;this.db=new DatabaseSync(path,{timeout:5000});
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS access_workspaces(id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS access_memberships(
        workspace_id TEXT NOT NULL REFERENCES access_workspaces(id),principal_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner','collaborator','observer','connector')),
        kind TEXT NOT NULL CHECK(kind IN ('human','connector')),revision INTEGER NOT NULL,
        active INTEGER NOT NULL CHECK(active IN (0,1)),scopes TEXT NOT NULL,
        expires_at INTEGER,delegated_by TEXT,delegator_revision INTEGER,
        PRIMARY KEY(workspace_id,principal_id));
      CREATE TABLE IF NOT EXISTS access_assertions(id_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS access_sessions(
        token_hash TEXT PRIMARY KEY,principal_id TEXT NOT NULL,workspace_id TEXT NOT NULL,
        membership_revision INTEGER NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,mfa_at INTEGER,revoked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(workspace_id,principal_id) REFERENCES access_memberships(workspace_id,principal_id));`);
  }
  close(){this.db.close();}
  consumeAssertion(id:string,expiresAt:number){
    if(!text(id)||!Number.isSafeInteger(expiresAt)||expiresAt<=this.now())fail(401,'Invalid assertion receipt');
    this.transaction(()=>{
      this.db.prepare('DELETE FROM access_assertions WHERE expires_at<=?').run(this.now());
      if(this.db.prepare('SELECT id_hash FROM access_assertions WHERE id_hash=?').get(digest(id)))fail(401,'Assertion already consumed');
      this.db.prepare('INSERT INTO access_assertions VALUES(?,?)').run(digest(id),expiresAt);
    });
  }
  private transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  /** Operator-only provisioning, never exposed as a request route. Cannot replace an owner. */
  provision(workspaceId:string,identity:VerifiedIdentity){
    if(!text(workspaceId)||identity.kind!=='human')fail(400,'Invalid owner provisioning');
    const id=principalId(identity);
    this.transaction(()=>{
      if(this.db.prepare('SELECT id FROM access_workspaces WHERE id=?').get(workspaceId))fail(409,'Workspace already provisioned');
      this.db.prepare('INSERT INTO access_workspaces(id) VALUES(?)').run(workspaceId);
      this.db.prepare('INSERT INTO access_memberships VALUES(?,?,?,?,1,1,?,NULL,NULL,NULL)').run(workspaceId,id,'owner','human',JSON.stringify(roles.owner));
    });return id;
  }
  private member(workspaceId:string,id:string):Row {
    const member=this.db.prepare('SELECT * FROM access_memberships WHERE workspace_id=? AND principal_id=?').get(workspaceId,id);
    if(!member||member.active!==1||(member.expires_at!==null&&Number(member.expires_at)<=this.now()))fail(403,'Membership unavailable');
    if(member.delegated_by!==null){
      const grantor=this.db.prepare('SELECT * FROM access_memberships WHERE workspace_id=? AND principal_id=?').get(workspaceId,member.delegated_by as string);
      if(!grantor||grantor.active!==1||grantor.role!=='owner'||grantor.revision!==member.delegator_revision)fail(403,'Delegation revoked');
    }
    return member;
  }
  async exchange(verifier:IdentityVerifier,assertion:string,workspaceId:string){
    if(typeof assertion!=='string'||assertion.length<1||assertion.length>16384||!text(workspaceId))fail(401,'Invalid authentication request');
    let identity:VerifiedIdentity;
    try{identity=await verifier.verify(assertion);}catch{fail(401,'Authentication failed');}
    const id=principalId(identity),now=this.now();
    if(!['human','connector'].includes(identity.kind)||!Number.isSafeInteger(identity.authenticatedAt)||identity.authenticatedAt>now||now-identity.authenticatedAt>STEP_UP||
      (identity.mfaAt!==null&&(!Number.isSafeInteger(identity.mfaAt)||identity.mfaAt>now)))fail(401,'Stale or invalid authentication');
    return this.transaction(()=>{
      const member=this.member(workspaceId,id);if(member.kind!==identity.kind)fail(403,'Principal kind mismatch');
      const token=randomBytes(32).toString('base64url');
      const expiresAt=Math.min(now+MAX_SESSION,member.expires_at===null?Infinity:Number(member.expires_at));
      this.db.prepare('INSERT INTO access_sessions VALUES(?,?,?,?,?,?,?,?,0)').run(digest(token),id,workspaceId,Number(member.revision),identity.kind,now,expiresAt,identity.mfaAt);
      return {token,expiresAt};
    });
  }
  authorize(token:string,scope:Scope,sensitive=false):AccessPrincipal {
    if(typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token))fail(401,'Session required');
    const session=this.db.prepare('SELECT * FROM access_sessions WHERE token_hash=?').get(digest(token));
    if(!session||session.revoked!==0||Number(session.expires_at)<=this.now())fail(401,'Session unavailable');
    const member=this.member(session.workspace_id as string,session.principal_id as string);
    if(member.revision!==session.membership_revision||member.kind!==session.kind)fail(403,'Session membership changed');
    const scopes=JSON.parse(member.scopes as string) as Scope[];
    if(!scopes.includes(scope))fail(403,'Scope denied');
    if((sensitive||scope==='membership.admin'||scope==='mandate.issue')&&(session.kind!=='human'||session.mfa_at===null||this.now()-Number(session.mfa_at)>STEP_UP))fail(403,'Recent verified MFA required');
    return {id:session.principal_id as string,workspaceId:session.workspace_id as string,role:member.role as Role,scopes};
  }
  revokeSession(token:string){
    if(typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token))fail(401,'Session required');
    this.db.prepare('UPDATE access_sessions SET revoked=1 WHERE token_hash=?').run(digest(token));
  }
  memberships(token:string){const actor=this.authorize(token,'membership.admin');return this.db.prepare('SELECT principal_id AS principalId,role,revision,active,expires_at AS expiresAt,delegated_by AS delegatedBy FROM access_memberships WHERE workspace_id=? ORDER BY principal_id').all(actor.workspaceId);}
  setMembership(token:string,input:{principalId:string;role:Role;kind:'human'|'connector';expectedRevision:number;active:boolean;scopes?:Scope[];expiresAt?:number|null;delegated?:boolean}){
    return this.transaction(()=>{
      const actor=this.authorize(token,'membership.admin');
      if(!/^[a-f0-9]{64}$/.test(input.principalId)||!validRole(input.role)||!['human','connector'].includes(input.kind)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||typeof input.active!=='boolean'||
        (input.kind==='connector')!==(input.role==='connector'))fail(400,'Invalid membership');
      const scopes=input.scopes??[...roles[input.role]];
      if(!Array.isArray(scopes)||scopes.length===0||new Set(scopes).size!==scopes.length||scopes.some(s=>!roles[input.role].includes(s)))fail(400,'Invalid delegated scopes');
      if(input.role==='owner'&&(scopes.length!==roles.owner.length||roles.owner.some(scope=>!scopes.includes(scope))))fail(400,'Owner scopes cannot be narrowed');
      if(input.delegated!==undefined&&typeof input.delegated!=='boolean')fail(400,'Invalid delegation flag');
      const expiry=input.expiresAt??null;
      if(expiry!==null&&(!Number.isSafeInteger(expiry)||expiry<=this.now()))fail(400,'Invalid membership expiry');
      if(input.delegated&&(input.role==='owner'||expiry===null||expiry>this.now()+MAX_SESSION))fail(400,'Delegation must be bounded and cannot grant ownership');
      const current=this.db.prepare('SELECT * FROM access_memberships WHERE workspace_id=? AND principal_id=?').get(actor.workspaceId,input.principalId);
      if((current?.revision??0)!==input.expectedRevision)fail(409,'Membership revision changed');
      if(current?.role==='owner'&&(input.role!=='owner'||!input.active)){
        const owners=this.db.prepare("SELECT COUNT(*) AS n FROM access_memberships WHERE workspace_id=? AND role='owner' AND active=1 AND expires_at IS NULL").get(actor.workspaceId)!;
        if(Number(owners.n)<=1)fail(409,'Cannot remove the last persistent owner');
      }
      if(input.role==='owner'&&expiry!==null)fail(400,'Owner membership cannot expire');
      const revision=input.expectedRevision+1;
      const actorRow=this.member(actor.workspaceId,actor.id);
      this.db.prepare(`INSERT INTO access_memberships VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,principal_id) DO UPDATE SET
        role=excluded.role,kind=excluded.kind,revision=excluded.revision,active=excluded.active,scopes=excluded.scopes,expires_at=excluded.expires_at,delegated_by=excluded.delegated_by,delegator_revision=excluded.delegator_revision`)
        .run(actor.workspaceId,input.principalId,input.role,input.kind,revision,Number(input.active),JSON.stringify(scopes),expiry,input.delegated?actor.id:null,input.delegated?Number(actorRow.revision):null);
      return {principalId:input.principalId,revision};
    });
  }
}
