import {Handle,Position} from '@xyflow/react';
import type {Node,NodeProps} from '@xyflow/react';
import type {WorkNode} from '../domain/graph.ts';
import type {Orientation} from '../domain/projection.ts';
export type WorkData={work:WorkNode;orientation:Orientation;selected:boolean;collapsed:boolean;childCount:number;
  completed:number;total:number;dimmed:boolean;onSelect:(id:string)=>void;onToggle:(id:string)=>void};
export type WorkCanvasNode=Node<WorkData,'work'>;
export function WorkCard({data}:NodeProps<WorkCanvasNode>) {
  const {work,orientation}=data;
  const root=work.kind==='directive';
  return <article className={`work-card ${root?'prime-card':''} ${data.selected?'is-selected':''} ${data.dimmed?'is-dimmed':''}`} data-state={work.state}>
    {!root&&<Handle type="target" position={orientation==='horizontal'?Position.Left:Position.Top} isConnectable={false}/>}
    <button className="work-card-main" aria-label={`Inspect ${work.title}`} onClick={()=>data.onSelect(work.id)}>
      <span className="card-eyebrow"><span>{root?'✦ PRIME DIRECTIVE':work.kind.toUpperCase()}</span><span className={`state-dot ${work.state}`}/></span>
      <strong className="card-title">{work.title}</strong>
      <span className="card-bottom"><span className={`state-label ${work.state}`}>{work.state==='ready'?'Ready':work.state==='succeeded'?'Complete':work.state}</span>
        {data.childCount>0&&<span>{data.completed}/{data.total} tasks</span>}</span>
      {data.childCount>0&&<span className="progress-track"><span style={{width:`${data.total?data.completed/data.total*100:0}%`}}/></span>}
      {root&&<span className="outcome-label">External outcome unverified</span>}
    </button>
    {data.childCount>0&&<button className="collapse-button nodrag" aria-label={`${data.collapsed?'Expand':'Collapse'} ${work.title}`} aria-expanded={!data.collapsed} onClick={()=>data.onToggle(work.id)}>{data.collapsed?'+':'−'}</button>}
    <Handle type="source" position={orientation==='horizontal'?Position.Right:Position.Bottom} isConnectable={false}/>
  </article>;
}
