import {useEffect,useState} from 'react';
import type {WorkspaceSnapshot,WorkerProfile,ActivityEvent} from '../domain/workers.ts';
import type {WorkNode} from '../domain/graph.ts';
import type {Experience} from '../domain/experience.ts';
import {getJSON} from './api.ts';
export type {ViewSelection as Selection} from '../domain/preferences.ts';
import type {ViewSelection as Selection} from '../domain/preferences.ts';
export type CommandFn=(command:Record<string,unknown>)=>Promise<void>;
const time=(value:string)=>new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
export function ActivityList({events,workers}: {events:ActivityEvent[];workers:WorkerProfile[]}) {
  return <ol className="activity-list">{[...events].reverse().slice(0,40).map(e=><li key={e.eventId}>
    <div className="activity-meta"><span>{workers.find(w=>w.id===e.workerId)?.label??'Worker'}</span><time dateTime={e.occurredAt}>{time(e.occurredAt)}</time></div>
    <p>{e.summary}</p>{e.evidence.length>0&&<span className="evidence-tag">{e.evidence.length} evidence reference</span>}
  </li>)}{events.length===0&&<li className="muted">Activity appears here when a worker starts.</li>}</ol>;
}
function WorkDetails({node,snapshot,onSelect,onCommand,busy}:{node:WorkNode;snapshot:WorkspaceSnapshot;onSelect:(s:Selection)=>void;onCommand:CommandFn;busy:boolean}) {
  const dependencies=snapshot.graph.dependencies.filter(d=>d.target===node.id);
  const active=snapshot.runs.find(r=>r.taskId===node.id&&r.state==='running');
  const worker=snapshot.workers.find(w=>w.id===active?.workerId);
  const idle=snapshot.workers.find(w=>w.state==='idle');
  const executable=['task','subtask'].includes(node.kind)&&!snapshot.graph.nodes.some(n=>n.parentId===node.id);
  const eligible=dependencies.every(d=>snapshot.graph.nodes.find(n=>n.id===d.source)?.state==='succeeded');
  return <>
    <div className="detail-type">{node.kind}</div><h2>{node.title}</h2>
    <span className={`status-pill ${node.state}`}>{node.state==='succeeded'?'Complete':node.state}</span>
    <p className="detail-description">{node.description}</p>
    <section className="detail-section"><h3>Completion check</h3><p>{node.acceptance}</p></section>
    {node.parentId&&<section className="detail-section"><h3>Part of</h3><button className="text-link" onClick={()=>onSelect({type:'work',id:node.parentId!})}>{snapshot.graph.nodes.find(n=>n.id===node.parentId)?.title}</button></section>}
    <section className="detail-section"><h3>Evidence</h3>{node.evidence.length?node.evidence.map(e=><div className="evidence-reference" key={e}>↗ {e}</div>):<p className="muted">No completion evidence yet.</p>}</section>
    {dependencies.length>0&&<section className="detail-section"><h3>Prerequisites</h3>{dependencies.map(d=><button key={d.id} className="dependency-link" onClick={()=>onSelect({type:'work',id:d.source})}><span className={`state-dot ${snapshot.graph.nodes.find(n=>n.id===d.source)?.state}`}/>{snapshot.graph.nodes.find(n=>n.id===d.source)?.title}</button>)}</section>}
    <section className="detail-section"><h3>Assigned worker</h3>{worker?<button className="worker-list-item" onClick={()=>onSelect({type:'worker',id:worker.id})}><span className="mini-avatar">◉</span><span><strong>{worker.label}</strong><small>{worker.specialty}</small></span><span className={`state-dot ${worker.state}`}/></button>:<p className="muted">No active assignment.</p>}</section>
    {executable&&node.state==='ready'&&<button className="primary-button full" disabled={busy||!idle||!eligible} onClick={()=>void onCommand({type:'assign',workerId:idle!.id,taskId:node.id,revision:snapshot.graph.revision})}>Assign simulation worker</button>}
  </>;
}
function WorkerDetails({worker,snapshot,events,onCommand,busy}:{worker:WorkerProfile;snapshot:WorkspaceSnapshot;events:ActivityEvent[];onCommand:CommandFn;busy:boolean}) {
  const [details,setDetails]=useState<{experience:Experience[];summary:{specialty:string;accepted:number;rejected:number;sampleSize:number}[];lessons:unknown[]}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();setDetails(null);setError('');getJSON<NonNullable<typeof details>>(`/api/workers/${worker.id}/experience`,controller.signal).then(setDetails).catch(e=>{if(!controller.signal.aborted)setError(String(e.message));});return()=>controller.abort();},[worker.id,snapshot.cursor]);
  const active=snapshot.runs.find(r=>r.workerId===worker.id&&r.state==='running');
  const completed=snapshot.runs.filter(r=>r.workerId===worker.id&&r.state==='completed');
  const unreviewed=completed.find(r=>!details?.experience.some(e=>e.runId===r.id));
  const latest=events.filter(e=>e.workerId===worker.id).at(-1);
  return <>
    <div className="profile-heading"><span className="profile-avatar">◉</span><div><div className="detail-type">Persistent worker</div><h2>{worker.name??worker.label}</h2><span className={`status-pill ${worker.state}`}>{worker.state}</span></div></div>
    <p className="specialty">{worker.specialty}</p><p className="muted small">Simulation identity · Boardroom name not reserved</p>
    <section className="detail-section"><h3>Current activity</h3><p>{latest?.summary??'Ready for a task.'}</p>{latest&&<span className="muted small">Last observed {time(latest.occurredAt)}</span>}</section>
    {active&&<><p className="task-assignment">↳ {snapshot.graph.nodes.find(n=>n.id===active.taskId)?.title}</p><div className="button-row"><button className="secondary-button" disabled={busy} onClick={()=>void onCommand({type:worker.state==='paused'?'resume':'pause',workerId:worker.id})}>{worker.state==='paused'?'Resume worker':'Pause worker'}</button><button className="secondary-button" disabled={busy||worker.state==='paused'} onClick={()=>void onCommand({type:'advance',workerId:worker.id,revision:snapshot.graph.revision})}>Next stage</button></div></>}
    <section className="detail-section"><h3>Experience</h3><div className="profile-metrics"><div><strong>{completed.length}</strong><span>completed runs</span></div><div><strong>{details?.experience.filter(e=>!e.revoked).length??0}</strong><span>reviewed results</span></div></div>
      {error&&<p role="alert">{error}</p>}{details?.summary.map(s=><p key={s.specialty}>{s.specialty}: {s.accepted} accepted, {s.rejected} rejected.</p>)}
      <p className="muted small">Simulation evidence only. These counts do not establish live expertise.</p>
      {unreviewed&&details&&<button className="secondary-button full" disabled={busy} onClick={()=>void onCommand({type:'evaluate',workerId:worker.id,evaluation:{id:crypto.randomUUID(),runId:unreviewed.id,outcome:'accepted',evidence:[`simulation:${unreviewed.id}:owner-review`],lesson:{text:'Check the current source version before reusing a claim.',sources:[{id:'demo-source',version:1}],expiresAt:new Date(Date.now()+86400000*30).toISOString()}}})}>Record a demo review</button>}
    </section>
    <section className="detail-section"><h3>Reviewed memory</h3>{details?.experience.some(e=>e.lesson)?details.experience.filter(e=>e.lesson).map(e=><div className="lesson-card" key={e.id}><span className="detail-type">{e.lesson!.status}</span><p>{e.lesson!.text}</p>{e.lesson!.status==='pending'&&<button className="text-link" disabled={busy} onClick={()=>void onCommand({type:'reviewLesson',workerId:worker.id,experienceId:e.id,decision:'approved'})}>Approve lesson</button>}{e.lesson!.status==='approved'&&<button className="text-link" disabled={busy} onClick={()=>void onCommand({type:'reviewLesson',workerId:worker.id,experienceId:e.id,decision:'revoked'})}>Revoke lesson</button>}</div>):<p className="muted">Reviewed lessons will remain with this worker across tasks.</p>}</section>
    <section className="detail-section"><h3>Recent activity</h3><ActivityList events={events.filter(e=>e.workerId===worker.id)} workers={snapshot.workers}/></section>
    <details className="identity-detail"><summary>Worker identity</summary><code>{worker.id}</code><p>Created {new Date(worker.createdAt).toLocaleString()}</p></details>
  </>;
}
function Names() {
  const [data,setData]=useState<{catalog:string[];reason:string}|null>(null);const [error,setError]=useState('');const [query,setQuery]=useState('');
  useEffect(()=>{const c=new AbortController();getJSON<NonNullable<typeof data>>('/api/names',c.signal).then(setData).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[]);
  return <><div className="detail-type">Shared name catalog</div><h2>Names from Boardroom</h2><p>{data?.reason||error||'Loading catalog…'}</p><div className="notice">Availability is unverified. No catalog names are assigned in this simulation.</div><label className="field-label">Browse {data?.catalog.length??'…'} names<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the name catalog"/></label><ul className="name-catalog">{data?.catalog.filter(n=>n.toLowerCase().includes(query.toLowerCase())).map(n=><li key={n}>{n}<span>Unverified</span></li>)}</ul></>;
}
export function Inspector({selection,snapshot,events,onSelect,onCommand,busy}:{selection:Selection;snapshot:WorkspaceSnapshot;events:ActivityEvent[];onSelect:(s:Selection)=>void;onCommand:CommandFn;busy:boolean}) {
  if(!selection)return null;
  const node=selection.type==='work'?snapshot.graph.nodes.find(n=>n.id===selection.id):undefined;
  const worker=selection.type==='worker'?snapshot.workers.find(w=>w.id===selection.id):undefined;
  return <aside className="inspector" aria-label="Details inspector"><div className="inspector-top"><span>INSPECTOR</span><button className="icon-button" aria-label="Close inspector" onClick={()=>onSelect(null)}>×</button></div><div className="inspector-content">
    {node&&<WorkDetails node={node} snapshot={snapshot} onSelect={onSelect} onCommand={onCommand} busy={busy}/>}
    {worker&&<WorkerDetails worker={worker} snapshot={snapshot} events={events} onCommand={onCommand} busy={busy}/>}
    {selection.type==='activity'&&<><div className="detail-type">Observed activity</div><h2>Work as it happens</h2><p className="muted small">Concise activity summaries and evidence. All current activity is simulated.</p><ActivityList events={events} workers={snapshot.workers}/></>}
    {selection.type==='workforce'&&<><div className="detail-type">Persistent identities</div><h2>Your workforce</h2><p className="muted">Workers retain their identities and reviewed experience between tasks.</p>{snapshot.workers.map(w=><button className="worker-list-item" key={w.id} onClick={()=>onSelect({type:'worker',id:w.id})}><span className="mini-avatar">◉</span><span><strong>{w.name??w.label}</strong><small>{w.specialty}</small></span><span className={`state-dot ${w.state}`}/></button>)}<button className="secondary-button full" onClick={()=>onSelect({type:'names'})}>Browse Boardroom names</button></>}
    {selection.type==='names'&&<Names/>}
  </div></aside>;
}
