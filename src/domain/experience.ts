import {DomainError,exactKeys,record,requireText,validId} from './graph.ts';
export interface SourceVersion {id:string;version:number}
export interface Lesson {text:string;sources:SourceVersion[];expiresAt:string;status:'pending'|'approved'|'revoked'}
export interface Experience {
  id:string;workspaceId:string;workerId:string;runId:string;specialty:string;
  outcome:'accepted'|'rejected';evidence:string[];reviewerId:string;createdAt:string;
  revoked:boolean;lesson:Lesson|null;modelVersion:'simulator-v1';
}
export interface EvaluationInput {id:string;runId:string;outcome:'accepted'|'rejected';evidence:string[];lesson:{text:string;sources:SourceVersion[];expiresAt:string}|null}
export interface ReviewPrincipal {id:string;role:'owner'|'evaluator'|'worker';workspaceId:string}
export function requireReviewer(actor:ReviewPrincipal,workspaceId:string,workerId:string) {
  if (!validId(actor.id) || actor.workspaceId !== workspaceId || !['owner','evaluator'].includes(actor.role) || actor.id === workerId)
    throw new DomainError('forbidden','Independent authorized evaluation is required');
}
export function parseEvaluation(value:unknown):EvaluationInput {
  const r=record(value);exactKeys(r,['id','runId','outcome','evidence','lesson']);
  if (!validId(r.id) || !validId(r.runId) || !['accepted','rejected'].includes(String(r.outcome)) || !Array.isArray(r.evidence) || r.evidence.length < 1 || r.evidence.length > 20)
    throw new DomainError('invalid','Invalid evaluation');
  r.evidence.forEach(v => requireText(v,500,'evaluation evidence'));
  let lesson:EvaluationInput['lesson']=null;
  if (r.lesson !== null && r.lesson !== undefined) {
    const l=record(r.lesson);exactKeys(l,['text','sources','expiresAt']);requireText(l.text,2000,'lesson');requireText(l.expiresAt,50,'lesson expiry');
    const expiry=Date.parse(l.expiresAt);
    if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== l.expiresAt || !Array.isArray(l.sources) || l.sources.length < 1 || l.sources.length > 20)
      throw new DomainError('invalid','Lesson needs source versions and valid expiry');
    const sources=l.sources.map(v => {const s=record(v);exactKeys(s,['id','version']);if (!validId(s.id) || !Number.isSafeInteger(s.version) || Number(s.version)<1) throw new DomainError('invalid','Invalid source version');return {id:s.id,version:s.version as number};});
    if (new Set(sources.map(s => s.id)).size !== sources.length) throw new DomainError('invalid','Duplicate lesson source');
    lesson={text:l.text,sources,expiresAt:l.expiresAt};
  }
  return {id:r.id,runId:r.runId,outcome:r.outcome as EvaluationInput['outcome'],evidence:[...r.evidence] as string[],lesson};
}
export function usableLessons(experience:readonly Experience[],workspaceId:string,workerId:string,sourceVersions:Readonly<Record<string,number>>,now:number) {
  return experience.filter(e => !e.revoked && e.workspaceId === workspaceId && e.workerId === workerId && e.lesson?.status === 'approved' &&
    Date.parse(e.lesson.expiresAt) > now && e.lesson.sources.every(s => Object.hasOwn(sourceVersions,s.id) && sourceVersions[s.id] === s.version))
    .map(e => ({experienceId:e.id,...e.lesson!}));
}
export function summarizeExperience(experience:readonly Experience[]) {
  const specialties=new Map<string,{specialty:string;accepted:number;rejected:number;sampleSize:number}>();
  for (const e of experience) if (!e.revoked) {
    const s=specialties.get(e.specialty) ?? {specialty:e.specialty,accepted:0,rejected:0,sampleSize:0};
    s[e.outcome]++;s.sampleSize++;specialties.set(e.specialty,s);
  }
  return [...specialties.values()].sort((a,b) => a.specialty.localeCompare(b.specialty));
}
