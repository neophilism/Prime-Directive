import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPreferences,parsePreferences} from '../src/domain/preferences.ts';
import {projectGraph} from '../src/domain/projection.ts';
import {projectWorkers} from '../src/domain/worker-projection.ts';
import {WorkspaceStore} from '../src/server/store.ts';
import {initializeSimulation,DEMO_WORKSPACE} from '../src/server/simulation.ts';
test('saved presentation preferences are bounded, explicit and cannot introduce execution fields',()=>{
  const p={...defaultPreferences(),orientation:'vertical',view:'outline',query:'source',motion:'reduced'};
  assert.deepEqual(parsePreferences(JSON.stringify(p)),p);
  for(const bad of ['{','null','[]',JSON.stringify({...p,execute:'send'}),JSON.stringify({...p,focus:{type:'work',id:'root',html:'<script>'}}),JSON.stringify({...p,query:'x'.repeat(121)}),JSON.stringify({...p,collapsed:['root','root']}),JSON.stringify({...p,orientation:'javascript:alert(1)'})])assert.deepEqual(parsePreferences(bad),defaultPreferences());
});
test('worker nodes keep their task identity and avoid overlap when branches collapse',()=>{
  const store=new WorkspaceStore(':memory:');initializeSimulation(store);
  try{
    let s=store.snapshot(DEMO_WORKSPACE);
    store.assign(DEMO_WORKSPACE,s.workers[0].id,'readiness-evidence',s.graph.revision);s=store.snapshot(DEMO_WORKSPACE);
    store.assign(DEMO_WORKSPACE,s.workers[1].id,'relationships-research',s.graph.revision);s=store.snapshot(DEMO_WORKSPACE);
    for(const orientation of ['horizontal','vertical'] as const){
      const projected=projectWorkers(s,projectGraph(s.graph,orientation,['root']).nodes,orientation,['root']);
      assert.equal(projected[0].attachment?.taskId,'readiness-evidence');assert.equal(projected[0].attachment?.visibleTarget,'root');
      assert.equal(projected[1].attachment?.insideCollapsedBranch,true);
      for(let i=0;i<projected.length;i++)for(let j=i+1;j<projected.length;j++){
        const a=projected[i].position,b=projected[j].position;
        assert.ok(Math.abs(a.x-b.x)>=184||Math.abs(a.y-b.y)>=78);
      }
      assert.deepEqual(projected,projectWorkers(s,projectGraph(s.graph,orientation,['root']).nodes,orientation,['root']));
    }
  }finally{store.close();}
});
