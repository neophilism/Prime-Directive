import {exampleGraph} from '../domain/example.ts';
import type {WorkspaceStore} from './store.ts';
export const DEMO_WORKSPACE='local-demo';
export function initializeSimulation(store:WorkspaceStore) {
  if (store.initialize(exampleGraph())) {
    store.createSimulationWorker(DEMO_WORKSPACE,'Worker 01','Evidence research');
    store.createSimulationWorker(DEMO_WORKSPACE,'Worker 02','Investment research');
    store.createSimulationWorker(DEMO_WORKSPACE,'Worker 03','Writing and design');
  }
}
/** A deterministic provider simulator. No LLM, network calls or external effects. */
export function stepSimulation(store:WorkspaceStore) {
  const s=store.snapshot(DEMO_WORKSPACE);
  const ordered=[...s.workers].sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
  const working=ordered.filter(w => w.state==='working');
  // Fill available workers before advancing results so the canvas shows concurrent work.
  const idle=ordered.find(w => w.state==='idle');
  const task=s.graph.nodes.find(n => ['task','subtask'].includes(n.kind) && n.state==='ready' &&
    !s.graph.nodes.some(c => c.parentId===n.id) && s.graph.dependencies.filter(d => d.target===n.id).every(d => s.graph.nodes.find(p => p.id===d.source)?.state==='succeeded'));
  if (idle && task) return {changed:true,run:store.assign(DEMO_WORKSPACE,idle.id,task.id,s.graph.revision)};
  const worker=working[0];
  if (worker) return {changed:true,run:store.advanceSimulation(DEMO_WORKSPACE,worker.id,s.graph.revision)};
  return {changed:false,reason:s.workers.some(w => w.state==='paused') ? 'Simulation is waiting for paused workers.' : task ? 'No idle worker is available for the remaining tasks.' : 'All eligible simulated tasks are complete. The external outcome remains unverified.'};
}
