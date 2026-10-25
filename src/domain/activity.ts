import {activityKinds} from './workers.ts';
import type {ActivityEvent,WorkspaceSnapshot} from './workers.ts';
import {DomainError,record,exactKeys,requireText,validId,validateGraph} from './graph.ts';
export function parseActivity(value:unknown):ActivityEvent {
  const e=record(value);
  exactKeys(e,['cursor','eventId','workspaceId','workerId','taskId','runId','kind','summary','evidence','occurredAt','simulation']);
  if (!Number.isSafeInteger(e.cursor) || Number(e.cursor)<1 || !validId(e.eventId) || !validId(e.workspaceId) || !validId(e.workerId) ||
    !(e.taskId===null || validId(e.taskId)) || !(e.runId===null || validId(e.runId)) || !activityKinds.includes(e.kind as ActivityEvent['kind']) || typeof e.simulation !== 'boolean')
    throw new DomainError('invalid','Invalid public activity event');
  requireText(e.summary,500,'activity summary');requireText(e.occurredAt,50,'event time');
  const at=Date.parse(e.occurredAt);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== e.occurredAt || !Array.isArray(e.evidence) || e.evidence.length>50) throw new DomainError('invalid','Invalid activity evidence or time');
  e.evidence.forEach(v => requireText(v,500,'evidence reference'));
  return {...e,evidence:[...e.evidence]} as unknown as ActivityEvent;
}
export function acceptActivity(currentCursor:number,value:unknown,workspaceId:string):ActivityEvent|null {
  const event=parseActivity(value);
  if (event.workspaceId !== workspaceId) throw new DomainError('forbidden','Activity belongs to a different workspace');
  return event.cursor>currentCursor ? event : null;
}
export function newerSnapshot(current:WorkspaceSnapshot|null,incoming:WorkspaceSnapshot):WorkspaceSnapshot {
  validateGraph(incoming.graph);
  if (!Number.isSafeInteger(incoming.cursor) || incoming.cursor<0 || incoming.mode!=='simulation') throw new DomainError('invalid','Invalid snapshot cursor or mode');
  if (current && (incoming.graph.workspaceId !== current.graph.workspaceId || incoming.graph.id !== current.graph.id)) throw new DomainError('forbidden','Snapshot identity changed');
  if (current && (incoming.cursor<current.cursor || incoming.graph.revision<current.graph.revision)) return current;
  return incoming;
}
