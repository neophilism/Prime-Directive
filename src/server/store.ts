import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {DomainError, requireText, transitionNode, validateGraph, validId} from '../domain/graph.ts';
import type {DirectiveGraph} from '../domain/graph.ts';
import type {ActivityEvent, ActivityKind, WorkerProfile, WorkerRun, WorkspaceSnapshot} from '../domain/workers.ts';

type Row = Record<string, unknown>;
const workerRow = (r:Row):WorkerProfile => ({id:r.id as string,workspaceId:r.workspace_id as string,label:r.label as string,
  name:r.name as null,nameClaimId:r.name_claim_id as null,specialty:r.specialty as string,state:r.state as WorkerProfile['state'],createdAt:r.created_at as string,simulation:true});
const runRow = (r:Row):WorkerRun => ({id:r.id as string,workspaceId:r.workspace_id as string,workerId:r.worker_id as string,
  taskId:r.task_id as string,state:r.state as WorkerRun['state'],startedAt:r.started_at as string,endedAt:r.ended_at as string|null});

/** Local, single-owner reference persistence. Not a production authentication boundary. */
export class WorkspaceStore {
  private db:DatabaseSync;
  constructor(path:string) {
    this.db = new DatabaseSync(path, {timeout:5000});
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    const hasVersion = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get();
    const versions = hasVersion ? this.db.prepare('SELECT version FROM schema_version').all() : [];
    if (versions.length > 1 || (versions.length === 1 && versions[0].version !== 1)) {this.db.close(); throw new Error('Unsupported local schema version');}
    this.db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
    this.db.prepare('INSERT OR IGNORE INTO schema_version(version) VALUES(1)').run();
  }
  close() {this.db.close();}
  private transaction<T>(fn:()=>T, write=true):T {
    this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {const value=fn(); this.db.exec('COMMIT'); return value;}
    catch(error) {this.db.exec('ROLLBACK'); throw error;}
  }
  private graph(workspaceId:string):DirectiveGraph {
    if (!validId(workspaceId)) throw new DomainError('invalid','Invalid workspace');
    const row=this.db.prepare('SELECT body FROM graphs WHERE workspace_id=?').get(workspaceId);
    if (!row) throw new DomainError('not_found','Workspace not found');
    return validateGraph(JSON.parse(row.body as string));
  }
  private worker(workspaceId:string,workerId:string):WorkerProfile {
    const r=this.db.prepare('SELECT * FROM workers WHERE workspace_id=? AND id=?').get(workspaceId,workerId);
    if (!r) throw new DomainError('not_found','Worker not found');
    return workerRow(r);
  }
  private saveGraph(graph:DirectiveGraph, previousRevision:number) {
    const result=this.db.prepare('UPDATE graphs SET revision=?,body=? WHERE workspace_id=? AND revision=?')
      .run(graph.revision,JSON.stringify(graph),graph.workspaceId,previousRevision);
    if (result.changes !== 1) throw new DomainError('conflict','Graph revision changed');
  }
  private event(workspaceId:string,workerId:string,kind:ActivityKind,summary:string,taskId:string|null=null,runId:string|null=null,evidence:string[]=[]) {
    requireText(summary,500,'activity summary');
    this.db.prepare('INSERT INTO activity_events(event_id,workspace_id,worker_id,task_id,run_id,kind,summary,evidence,occurred_at,simulation) VALUES(?,?,?,?,?,?,?,?,?,1)')
      .run(randomUUID(),workspaceId,workerId,taskId,runId,kind,summary,JSON.stringify(evidence),new Date().toISOString());
  }
  initialize(input:DirectiveGraph):boolean {
    const graph=validateGraph(input);
    return this.transaction(() => this.db.prepare('INSERT OR IGNORE INTO graphs(workspace_id,id,revision,body) VALUES(?,?,?,?)')
      .run(graph.workspaceId,graph.id,graph.revision,JSON.stringify(graph)).changes === 1);
  }
  createSimulationWorker(workspaceId:string,label:string,specialty:string):WorkerProfile {
    requireText(label,80,'simulation label'); requireText(specialty,80,'specialty');
    return this.transaction(() => {
      this.graph(workspaceId);
      const id=randomUUID();
      this.db.prepare("INSERT INTO workers(id,workspace_id,label,specialty,state,created_at,simulation) VALUES(?,?,?,?,'idle',?,1)")
        .run(id,workspaceId,label,specialty,new Date().toISOString());
      this.event(workspaceId,id,'worker.created','Persistent simulation worker created.');
      return this.worker(workspaceId,id);
    });
  }
  snapshot(workspaceId:string):WorkspaceSnapshot {
    return this.transaction(() => ({graph:this.graph(workspaceId),
      workers:this.db.prepare('SELECT * FROM workers WHERE workspace_id=? ORDER BY created_at,id').all(workspaceId).map(workerRow),
      runs:this.db.prepare('SELECT * FROM runs WHERE workspace_id=? ORDER BY started_at,id').all(workspaceId).map(runRow),
      cursor:Number(this.db.prepare('SELECT COALESCE(MAX(cursor),0) AS cursor FROM activity_events WHERE workspace_id=?').get(workspaceId)!.cursor),
      mode:'simulation' as const}),false);
  }
  assign(workspaceId:string,workerId:string,taskId:string,revision:number):WorkerRun {
    return this.transaction(() => {
      const graph=this.graph(workspaceId), worker=this.worker(workspaceId,workerId);
      if (worker.state !== 'idle') throw new DomainError('conflict','Worker is not idle');
      const task=graph.nodes.find(n => n.id === taskId);
      if (!task || !['task','subtask'].includes(task.kind) || graph.nodes.some(n => n.parentId === taskId)) throw new DomainError('invalid','Choose an executable leaf task');
      const next=transitionNode(graph,taskId,'running',revision), id=randomUUID(), now=new Date().toISOString();
      this.saveGraph(next,revision);
      this.db.prepare("INSERT INTO runs(id,workspace_id,worker_id,task_id,state,started_at) VALUES(?,?,?,?,'running',?)").run(id,workspaceId,workerId,taskId,now);
      this.db.prepare("UPDATE workers SET state='working' WHERE id=? AND workspace_id=?").run(workerId,workspaceId);
      this.event(workspaceId,workerId,'task.assigned',`Started simulated work: ${task.title}`,taskId,id);
      return {id,workspaceId,workerId,taskId,state:'running',startedAt:now,endedAt:null};
    });
  }
  advanceSimulation(workspaceId:string,workerId:string,revision:number):WorkerRun {
    return this.transaction(() => {
      const graph=this.graph(workspaceId),worker=this.worker(workspaceId,workerId);
      if (worker.state !== 'working') throw new DomainError('conflict','Worker is not working');
      const row=this.db.prepare("SELECT * FROM runs WHERE workspace_id=? AND worker_id=? AND state='running'").get(workspaceId,workerId);
      if (!row) throw new DomainError('not_found','Active run not found');
      const run=runRow(row),task=graph.nodes.find(n => n.id === run.taskId)!;
      const done=task.state === 'validating';
      const evidence=done ? [`simulation:${run.id}:review`] : undefined;
      const next=transitionNode(graph,task.id,done ? 'succeeded' : 'validating',revision,evidence);
      this.saveGraph(next,revision);
      if (done) {
        run.state='completed'; run.endedAt=new Date().toISOString();
        this.db.prepare("UPDATE runs SET state='completed',ended_at=? WHERE id=?").run(run.endedAt,run.id);
        this.db.prepare("UPDATE workers SET state='idle' WHERE id=?").run(workerId);
      }
      this.event(workspaceId,workerId,done ? 'task.completed' : 'task.reviewing',
        done ? 'Simulation result recorded with fixture evidence; no external outcome is implied.' : 'Checking the simulated result against the task acceptance criteria.',task.id,run.id,evidence);
      return run;
    });
  }
  pauseWorker(workspaceId:string,workerId:string,paused:boolean) {
    return this.transaction(() => {
      const w=this.worker(workspaceId,workerId);
      if (paused && w.state !== 'working' || !paused && w.state !== 'paused') throw new DomainError('transition','Invalid worker pause transition');
      this.db.prepare('UPDATE workers SET state=? WHERE id=? AND workspace_id=?').run(paused ? 'paused' : 'working',workerId,workspaceId);
      this.event(workspaceId,workerId,paused ? 'worker.paused' : 'worker.resumed',paused ? 'Simulation worker paused; assignment retained.' : 'Simulation worker resumed.');
      return this.worker(workspaceId,workerId);
    });
  }
  retireWorker(workspaceId:string,workerId:string) {
    return this.transaction(() => {
      const w=this.worker(workspaceId,workerId);
      if (w.state !== 'idle') throw new DomainError('conflict','Only an idle worker may retire');
      this.db.prepare("UPDATE workers SET state='retired' WHERE id=? AND workspace_id=?").run(workerId,workspaceId);
      this.event(workspaceId,workerId,'worker.retired','Worker retired; identity and reviewed history are retained.');
      return this.worker(workspaceId,workerId);
    });
  }
  events(workspaceId:string,after=0,limit=100):ActivityEvent[] {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new DomainError('invalid','Invalid event cursor or limit');
    this.graph(workspaceId);
    return this.db.prepare('SELECT * FROM activity_events WHERE workspace_id=? AND cursor>? ORDER BY cursor LIMIT ?').all(workspaceId,after,limit)
      .map(r => ({cursor:Number(r.cursor),eventId:r.event_id as string,workspaceId:r.workspace_id as string,workerId:r.worker_id as string,
        taskId:r.task_id as string|null,runId:r.run_id as string|null,kind:r.kind as ActivityKind,summary:r.summary as string,
        evidence:JSON.parse(r.evidence as string) as string[],occurredAt:r.occurred_at as string,simulation:true}));
  }
}
