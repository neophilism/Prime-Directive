import {useEffect,useRef,useState} from 'react';
import {Handle,Position} from '@xyflow/react';
import type {Node,NodeProps} from '@xyflow/react';
import type {ActivityEvent,WorkerProfile} from '../domain/workers.ts';
import type {Orientation} from '../domain/projection.ts';
export type WorkerData={worker:WorkerProfile;activity:ActivityEvent|undefined;taskTitle:string|null;targetKey:string;insideCollapsedBranch:boolean;
  orientation:Orientation;selected:boolean;previewBelow:boolean;motion:boolean;fresh:boolean;onSelect:(id:string)=>void};
export type WorkerCanvasNode=Node<WorkerData,'worker'>;
function Robot(){return <svg className="worker-robot" viewBox="0 0 40 48" fill="none" aria-hidden="true"><path d="M20 8V4" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="3" r="2" fill="currentColor"/><rect x="8" y="9" width="24" height="20" rx="7" fill="currentColor" opacity=".15" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="14" width="18" height="10" rx="4" fill="#102a34"/><circle cx="16" cy="19" r="2" fill="currentColor"/><circle cx="24" cy="19" r="2" fill="currentColor"/><path d="M13 32H27V39H13Z" fill="currentColor" opacity=".35"/><path className="robot-leg left" d="M16 40V45H12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path className="robot-leg right" d="M24 40V45H28" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M8 32L5 36M32 32L35 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;}
export function WorkerNode({data}:NodeProps<WorkerCanvasNode>) {
  const [travelling,setTravelling]=useState(false);const previous=useRef(data.targetKey);
  useEffect(()=>{
    const changed=previous.current!==data.targetKey;previous.current=data.targetKey;
    if(!changed||!data.motion){setTravelling(false);return;}
    setTravelling(true);const timer=setTimeout(()=>setTravelling(false),1100);return()=>clearTimeout(timer);
  },[data.targetKey,data.motion]);
  const tooltip=`activity-${data.worker.id}`;
  return <article className={`worker-node ${data.selected?'is-selected':''} ${travelling?'is-travelling':''} ${data.previewBelow?'preview-below':''}`} data-worker-id={data.worker.id} data-task={data.taskTitle??'idle'}>
    <Handle type="target" position={data.orientation==='horizontal'?Position.Left:Position.Top} isConnectable={false}/>
    <button className="worker-node-button" aria-label={`Inspect ${data.worker.label}`} aria-describedby={tooltip} onClick={()=>data.onSelect(data.worker.id)}><Robot/><span><strong>{data.worker.name??data.worker.label}</strong><small><span className={`state-dot ${data.worker.state}`}/>{data.fresh?data.worker.state:'last observed'}</small><span className="worker-task">{data.insideCollapsedBranch?'↳ Inside branch':data.taskTitle??data.worker.specialty}</span></span></button>
    <div className="worker-preview" id={tooltip} role="tooltip"><span className="detail-type">{data.fresh?'Observed activity':'Connection interrupted'}</span><strong>{data.taskTitle??'Available for a task'}</strong><p>{data.activity?.summary??'No activity recorded yet.'}</p>{data.activity&&<time dateTime={data.activity.occurredAt}>{new Date(data.activity.occurredAt).toLocaleTimeString()}</time>}<span className="simulation-note">Simulation · Persistent worker</span></div>
  </article>;
}
