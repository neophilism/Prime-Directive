import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Background,BackgroundVariant,Controls,MiniMap,ReactFlow} from '@xyflow/react';
import type {Edge,ReactFlowInstance,NodeChange} from '@xyflow/react';
import type {ActivityEvent,WorkspaceSnapshot} from '../domain/workers.ts';
import type {WorkNode} from '../domain/graph.ts';
import {acceptActivity,newerSnapshot} from '../domain/activity.ts';
import {projectGraph} from '../domain/projection.ts';
import type {Orientation} from '../domain/projection.ts';
import {projectWorkers} from '../domain/worker-projection.ts';
import {parsePreferences} from '../domain/preferences.ts';
import {WorkerNode} from './WorkerNode.tsx';
import type {WorkerCanvasNode} from './WorkerNode.tsx';
import {WorkCard} from './WorkCard.tsx';
import type {WorkCanvasNode} from './WorkCard.tsx';
import {Inspector} from './Inspector.tsx';
import type {Selection} from './Inspector.tsx';
import {getJSON,sendCommand} from './api.ts';
const nodeTypes={work:WorkCard,worker:WorkerNode};
type CanvasNode=WorkCanvasNode|WorkerCanvasNode;
const preferenceKey='prime-directive:local-demo:view:v1';
function readPreferences(){try{return parsePreferences(localStorage.getItem(preferenceKey));}catch{return parsePreferences(null);}}
function descendants(nodes:WorkNode[],id:string):WorkNode[] {
  const children=nodes.filter(n=>n.parentId===id);
  return children.length?children.flatMap(n=>descendants(nodes,n.id)):nodes.filter(n=>n.id===id);
}
function Outline({snapshot,query,onSelect}:{snapshot:WorkspaceSnapshot;query:string;onSelect:(s:Selection)=>void}) {
  function branch(node:WorkNode):React.ReactNode {
    const children=snapshot.graph.nodes.filter(n=>n.parentId===node.id);
    return <li key={node.id}><button className={`outline-item ${query&&!node.title.toLowerCase().includes(query.toLowerCase())?'is-dimmed':''}`} onClick={()=>onSelect({type:'work',id:node.id})}><span className={`state-dot ${node.state}`}/><span><small>{node.kind}</small><strong>{node.title}</strong></span><span className="outline-status">{node.state}</span></button>{children.length>0&&<ul>{children.map(branch)}</ul>}</li>;
  }
  return <div className="outline-view" aria-label="Directive outline"><ul>{branch(snapshot.graph.nodes.find(n=>n.parentId===null)!)}</ul></div>;
}
export function App() {
  const [preferences]=useState(readPreferences);
  const [motion,setMotion]=useState(preferences.motion);
  const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduced=motion==='reduced'||systemReduced;
  const [snapshot,setSnapshot]=useState<WorkspaceSnapshot|null>(null);
  const [events,setEvents]=useState<ActivityEvent[]>([]);
  const [selection,setSelection]=useState<Selection>(preferences.focus);
  const [orientation,setOrientation]=useState<Orientation>(preferences.orientation);
  const [collapsed,setCollapsed]=useState<string[]>(preferences.collapsed);
  const [view,setView]=useState<'map'|'outline'>(preferences.view);
  const [query,setQuery]=useState(preferences.query);
  const [connection,setConnection]=useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);const [playing,setPlaying]=useState(false);
  const commandBusy=useRef(false);const cursor=useRef(0);
  const flow=useRef<ReactFlowInstance<CanvasNode,Edge>|null>(null);
  const [measurements,setMeasurements]=useState<Record<string,{width:number;height:number}>>({});
  const onNodesChange=useCallback((changes:NodeChange<CanvasNode>[])=>setMeasurements(current=>{
    let next=current;
    for(const change of changes)if(change.type==='dimensions'&&change.dimensions&&
      (current[change.id]?.width!==change.dimensions.width||current[change.id]?.height!==change.dimensions.height))next={...next,[change.id]:change.dimensions};
    return next;
  }),[]);
  const lastObserved=useRef(Date.now());
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystemReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{try{localStorage.setItem(preferenceKey,JSON.stringify({version:1,orientation,collapsed,view,query,motion,focus:selection}));}catch{/* Storage denial must not block the workspace. */}},150);return()=>clearTimeout(timer);},[orientation,collapsed,view,query,motion,selection]);
  useEffect(()=>{if(!snapshot||!selection||!('id' in selection))return;const exists=selection.type==='work'?snapshot.graph.nodes.some(n=>n.id===selection.id):snapshot.workers.some(w=>w.id===selection.id);if(!exists)setSelection({type:'work',id:'root'});},[snapshot,selection]);
  useEffect(()=>{const timer=setInterval(()=>{if(Date.now()-lastObserved.current>25000)setConnection('disconnected');},5000);return()=>clearInterval(timer);},[]);
  const commitSnapshot=useCallback((next:WorkspaceSnapshot)=>setSnapshot(current=>newerSnapshot(current,next)),[]);
  useEffect(()=>{
    const controller=new AbortController();let source:EventSource|undefined;
    async function start() {
      const initial=await getJSON<WorkspaceSnapshot>('/api/workspace',controller.signal);
      if(controller.signal.aborted)return;
      commitSnapshot(initial);cursor.current=initial.cursor;
      const history=await getJSON<{events:ActivityEvent[]}>('/api/activity',controller.signal);
      if(controller.signal.aborted)return;
      setEvents(history.events.slice(-100));
      source=new EventSource(`/api/events?after=${initial.cursor}`);
      source.onopen=()=>{lastObserved.current=Date.now();setConnection('connected');};source.onerror=()=>setConnection('disconnected');
      source.addEventListener('heartbeat',()=>{lastObserved.current=Date.now();setConnection('connected');});
      source.addEventListener('activity',event=>{
        try {
          const next=acceptActivity(cursor.current,JSON.parse((event as MessageEvent).data),initial.graph.workspaceId);
          if(!next)return;cursor.current=next.cursor;lastObserved.current=Date.now();setConnection('connected');
          setEvents(current=>[...current.filter(e=>e.eventId!==next.eventId),next].slice(-100));
          void getJSON<WorkspaceSnapshot>('/api/workspace',controller.signal).then(commitSnapshot).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
        } catch(e){setError((e as Error).message);}
      });
    }
    void start().catch(e=>{if(!controller.signal.aborted){setError(e.message);setConnection('disconnected');}});
    return()=>{controller.abort();source?.close();};
  },[commitSnapshot]);
  const command=useCallback(async(body:Record<string,unknown>)=>{
    if(commandBusy.current)return;
    commandBusy.current=true;setBusy(true);setError('');setNotice('');
    try {const response=await sendCommand(body);commitSnapshot(response.snapshot);if(response.result?.changed===false){setPlaying(false);setNotice(response.result.reason??'No eligible work remains.');}}
    catch(e){setError((e as Error).message);setPlaying(false);try{commitSnapshot(await getJSON<WorkspaceSnapshot>('/api/workspace'));}catch{/* Keep the last observed state visible. */}}
    finally{commandBusy.current=false;setBusy(false);}
  },[commitSnapshot]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>void command({type:'step'}),1600);return()=>clearInterval(timer);},[playing,command]);
  useEffect(()=>{if(connection==='disconnected')setPlaying(false);},[connection]);
  const toggle=useCallback((id:string)=>setCollapsed(current=>current.includes(id)?current.filter(v=>v!==id):[...current,id]),[]);
  const onSelect=useCallback((next:Selection)=>setSelection(next),[]);
  const projection=useMemo(()=>{
    if(!snapshot)return null;
    // A search reveals matched tasks, including those inside a collapsed branch.
    const ancestors=new Set<string>();
    if(query)for(const node of snapshot.graph.nodes.filter(n=>n.title.toLowerCase().includes(query.toLowerCase()))) {
      let current:WorkNode|undefined=node;
      while(current?.parentId){ancestors.add(current.parentId);current=snapshot.graph.nodes.find(n=>n.id===current!.parentId);}
    }
    return projectGraph(snapshot.graph,orientation,collapsed.filter(id=>!ancestors.has(id)));
  },[snapshot,orientation,collapsed,query]);
  const workNodes=useMemo<WorkCanvasNode[]>(()=>projection?.nodes.map(n=>{
    const leaves=descendants(snapshot!.graph.nodes,n.id);
    return {id:n.id,type:'work',position:n.position,draggable:false,selectable:false,
      data:{work:n.work,orientation,selected:selection?.type==='work'&&selection.id===n.id,collapsed:n.hiddenDescendants>0,
        childCount:snapshot!.graph.nodes.filter(v=>v.parentId===n.id).length,completed:leaves.filter(v=>v.state==='succeeded').length,total:leaves.length,
        dimmed:!!query&&!n.work.title.toLowerCase().includes(query.toLowerCase()),onSelect:(id:string)=>onSelect({type:'work',id}),onToggle:toggle}};
  })??[],[projection,snapshot,orientation,selection,query,onSelect,toggle]);
  const workerProjection=useMemo(()=>snapshot&&projection?projectWorkers(snapshot,projection.nodes,orientation,projection.nodes.filter(n=>n.hiddenDescendants>0).map(n=>n.id)):[],[snapshot,projection,orientation]);
  const workerNodes=useMemo<WorkerCanvasNode[]>(()=>workerProjection.map(p=>({id:`worker:${p.worker.id}`,type:'worker',position:p.position,draggable:false,selectable:false,
    className:!reduced&&connection==='connected'?'worker-position travel-enabled':'worker-position',zIndex:6,
    data:{worker:p.worker,activity:events.filter(e=>e.workerId===p.worker.id).at(-1),taskTitle:snapshot!.graph.nodes.find(n=>n.id===p.attachment?.taskId)?.title??null,
      targetKey:p.attachment?.visibleTarget??'idle',insideCollapsedBranch:p.attachment?.insideCollapsedBranch??false,orientation,
      selected:selection?.type==='worker'&&selection.id===p.worker.id,previewBelow:p.position.y<180,motion:!reduced&&connection==='connected',fresh:connection==='connected',onSelect:(id:string)=>onSelect({type:'worker',id})}})),[workerProjection,reduced,connection,events,snapshot,orientation,selection,onSelect]);
  const nodes=useMemo<CanvasNode[]>(()=>[...workNodes,...workerNodes].map(n=>({...n,measured:measurements[n.id]})),[workNodes,workerNodes,measurements]);
  const assignmentEdges=useMemo<Edge[]>(()=>workerProjection.filter(p=>p.attachment).map(p=>({id:`assignment:${p.worker.id}`,source:p.attachment!.visibleTarget,target:`worker:${p.worker.id}`,type:'smoothstep',
    className:'assignment-edge',style:{stroke:p.worker.state==='paused'?'#d7ad6c':'#52d9cd',strokeWidth:1.7,strokeDasharray:p.worker.state==='paused'?'3 5':undefined},zIndex:2})),[workerProjection]);
  const edges=useMemo<Edge[]>(()=>projection?.edges.map(e=>({id:e.id,source:e.source,target:e.target,type:'smoothstep',
    className:e.kind==='dependency'?'dependency-edge':'hierarchy-edge',style:{stroke:e.kind==='dependency'?'#8570c5':'#3a4f68',strokeWidth:e.kind==='dependency'?1.3:1.8,strokeDasharray:e.kind==='dependency'?'5 6':undefined},zIndex:e.kind==='dependency'?0:1}))??[],[projection]);
  const fit=useCallback(()=>{void flow.current?.fitView({padding:.16,duration:reduced?0:250,maxZoom:1});},[reduced]);
  useEffect(()=>{const timer=setTimeout(fit,80);return()=>clearTimeout(timer);},[orientation,collapsed,view,fit]);
  if(!snapshot)return <main className="loading"><div className="brand-mark">✦</div><h1>The Prime Directive</h1><p role={error?'alert':'status'}>{error||'Opening your workspace…'}</p>{error&&<button onClick={()=>location.reload()}>Retry connection</button>}</main>;
  const leaves=snapshot.graph.nodes.filter(n=>!snapshot.graph.nodes.some(c=>c.parentId===n.id));
  const complete=leaves.filter(n=>n.state==='succeeded').length;
  const active=snapshot.workers.filter(w=>w.state==='working').length;
  const root=snapshot.graph.nodes.find(n=>n.parentId===null)!;
  const matches=query?snapshot.graph.nodes.filter(n=>n.title.toLowerCase().includes(query.toLowerCase())).length:0;
  return <main className="app-shell">
    <nav className="rail" aria-label="Workspace navigation"><a className="brand-mark" href="#workspace" aria-label="Prime Directive workspace">✦</a><div className="rail-group"><button className={`rail-button ${view==='map'?'active':''}`} aria-label="Directive map" onClick={()=>{setView('map');setSelection({type:'work',id:root.id});}}><span>⌘</span><small>Map</small></button><button className="rail-button" aria-label="Open workforce" onClick={()=>setSelection({type:'workforce'})}><span>♧</span><small>Workers</small></button><button className="rail-button" aria-label="Open activity" onClick={()=>setSelection({type:'activity'})}><span>≋</span><small>Activity</small></button></div><span className="rail-footer">PD<br/><small>LOCAL</small></span></nav>
    <div className="workspace" id="workspace">
      <header className="topbar"><div className="wordmark">THE PRIME DIRECTIVE <span>/</span><small>Mission control</small></div><div className="topbar-status"><span className="simulation-badge">SIMULATION</span><span className={`connection ${connection}`} role="status"><span className="state-dot"/>{connection==='connected'?'Stream connected':connection==='connecting'?'Connecting':'Stream disconnected'}</span></div></header>
      <section className="mission-header"><div><p className="eyebrow">ONE DIRECTIVE. A PERSISTENT WORKFORCE.</p><h1>{root.title}</h1><p className="mission-subtitle">A fictional company · Investor readiness workspace</p></div><div className="mission-stats"><div><strong>{complete}<span>/{leaves.length}</span></strong><small>tasks complete</small></div><div><strong>{snapshot.workers.length}</strong><small>persistent workers</small></div><div><strong className="cyan">{active}</strong><small>{connection==='connected'?'working now':'last observed working'}</small></div></div></section>
      <div className="workspace-toolbar"><div className="view-switch" aria-label="Workspace view"><button aria-pressed={view==='map'} onClick={()=>setView('map')}>Map</button><button aria-pressed={view==='outline'} onClick={()=>setView('outline')}>Outline</button></div><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Find a directive or task" placeholder="Find a directive or task…" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)}/></label><label className="orientation-control"><span className="sr-only">Flow direction</span><select aria-label="Flow direction" value={orientation} onChange={e=>setOrientation(e.target.value as Orientation)}><option value="horizontal">Left to right</option><option value="vertical">Top to bottom</option></select></label><button className="secondary-button fit-button" onClick={fit} disabled={view!=='map'}>Fit view</button><span className="toolbar-spacer"/><button className="secondary-button" disabled={busy||connection!=='connected'} onClick={()=>void command({type:'step'})}>Step</button><button className="primary-button" aria-pressed={playing} disabled={connection!=='connected'} onClick={()=>setPlaying(v=>!v)}>{playing?'Ⅱ Pause demo':'▶ Run demo'}</button></div>
      {(error||notice)&&<div className={`message-bar ${error?'error':''}`} role={error?'alert':'status'}>{error||notice}<button aria-label="Dismiss message" onClick={()=>{setError('');setNotice('');}}>×</button></div>}
      <div className="workspace-body"><section className="canvas-panel" aria-label="Visual directive workspace">
        <div className="canvas-caption"><span className="eyebrow">DIRECTIVE NETWORK</span><span>{query?`${matches} matching items`:`${snapshot.graph.nodes.length} work items · ${snapshot.graph.dependencies.length} dependencies`}</span></div>
        {view==='map'?<ReactFlow<CanvasNode,Edge> nodes={nodes} onNodesChange={onNodesChange} edges={[...edges,...assignmentEdges]} nodeTypes={nodeTypes} onNodeClick={(_,node)=>onSelect(node.type==='worker'?{type:'worker',id:node.data.worker.id}:{type:'work',id:node.id})} onInit={instance=>{flow.current=instance;}} fitView fitViewOptions={{padding:.16,maxZoom:1}} minZoom={.18} maxZoom={1.8} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onlyRenderVisibleElements panOnScroll selectionOnDrag={false} deleteKeyCode={null} colorMode="dark" proOptions={{hideAttribution:false}}><Background variant={BackgroundVariant.Dots} color="#314052" gap={24} size={1}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={n=>n.type==='worker'?'#74e0b4':n.id==='root'?'#47d5cd':'#42617e'} maskColor="rgba(10,18,30,.65)"/></ReactFlow>:<Outline snapshot={snapshot} query={query} onSelect={onSelect}/>}
        {view==='map'&&<div className="canvas-legend"><span><i className="legend-line"/>Subdirective</span><span><i className="legend-line dashed"/>Prerequisite</span><span><i className="legend-line tether"/>Worker assignment</span>{!!projection?.hiddenDependencyCount&&<span>{projection.hiddenDependencyCount} prerequisite hidden by collapsed branches</span>}</div>}
      </section><Inspector selection={selection} snapshot={snapshot} events={events} onSelect={onSelect} onCommand={command} busy={busy}/></div>
      <footer className="workspace-footer"><span><span className="state-dot idle"/> Local state persists between sessions</span><span>Simulation only · No external messages or live model calls</span><label className="motion-control"><span className="sr-only">Animation preference</span><select aria-label="Animation preference" value={motion} onChange={e=>setMotion(e.target.value as 'system'|'reduced')}><option value="system">System motion</option><option value="reduced">Reduce motion</option></select></label><button className="text-link" onClick={()=>setSelection({type:'names'})}>Name catalog</button></footer>
    </div>
  </main>;
}
