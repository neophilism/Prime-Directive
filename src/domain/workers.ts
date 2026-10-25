export type WorkerState = 'idle' | 'working' | 'paused' | 'retired';
export interface WorkerProfile {
  id:string; workspaceId:string; label:string; name:string|null; nameClaimId:string|null;
  specialty:string; state:WorkerState; createdAt:string; simulation:boolean;
}
export interface WorkerRun {
  id:string; workerId:string; workspaceId:string; taskId:string;
  state:'running'|'completed'|'cancelled'; startedAt:string; endedAt:string|null;
}
export const activityKinds = ['worker.created','worker.retired','worker.paused','worker.resumed','task.assigned','task.reviewing','task.completed','experience.reviewed','memory.revoked'] as const;
export type ActivityKind = typeof activityKinds[number];
/** A deliberate public activity projection. Raw model reasoning is never a field. */
export interface ActivityEvent {
  cursor:number; eventId:string; workspaceId:string; workerId:string; taskId:string|null; runId:string|null;
  kind:ActivityKind; summary:string; evidence:string[]; occurredAt:string; simulation:boolean;
}
export interface WorkspaceSnapshot {
  graph:import('./graph.ts').DirectiveGraph; workers:WorkerProfile[]; runs:WorkerRun[]; cursor:number;
  mode:'simulation';
}
