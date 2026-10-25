import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {WorkspaceStore} from '../src/server/store.ts';
import {exampleGraph} from '../src/domain/example.ts';
import {summarizeExperience,parseEvaluation} from '../src/domain/experience.ts';
import type {ReviewPrincipal} from '../src/domain/experience.ts';
const actor:ReviewPrincipal={id:'reviewer-fixture',role:'evaluator',workspaceId:'local-demo'};
const now=Date.parse('2026-10-25T04:00:00.000Z');
function setup(db:WorkspaceStore) {
  db.initialize(exampleGraph());const w=db.createSimulationWorker('local-demo','Worker 01','Evidence research');
  const run=db.assign('local-demo',w.id,'readiness-evidence',1);
  db.advanceSimulation('local-demo',w.id,2);db.advanceSimulation('local-demo',w.id,3);
  return {worker:w,command:{id:'evaluation-fixture',runId:run.id,outcome:'accepted',evidence:['fixture:review'],
    lesson:{text:'Verify dates against the current source version.',sources:[{id:'company-source',version:1}],expiresAt:new Date(now+86400000).toISOString()}}};
}
test('evaluation is idempotent and experience survives restart', () => {
  const dir=mkdtempSync(join(tmpdir(),'pd-memory-')),path=join(dir,'db.sqlite');let db=new WorkspaceStore(path);
  try {
    const {worker,command}=setup(db);const first=db.recordEvaluation('local-demo',worker.id,command,actor,now);
    assert.deepEqual(db.recordEvaluation('local-demo',worker.id,command,actor,now+1),first);
    assert.deepEqual(db.recordEvaluation('local-demo',worker.id,command,actor,now+86400001),first);
    assert.throws(() => db.recordEvaluation('local-demo',worker.id,{...command,outcome:'rejected'},actor,now),/different/);
    assert.throws(() => db.recordEvaluation('local-demo',worker.id,{...command,id:'another'},actor,now),/already/);
    db.close();db=new WorkspaceStore(path);
    assert.equal(db.experience('local-demo',worker.id).length,1);
    assert.deepEqual(summarizeExperience(db.experience('local-demo',worker.id)),[{specialty:'Evidence research',accepted:1,rejected:0,sampleSize:1}]);
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
test('only independently reviewed, current and correctly scoped lessons are reused', () => {
  const db=new WorkspaceStore(':memory:');
  try {
    const {worker,command}=setup(db);
    assert.throws(() => db.recordEvaluation('local-demo',worker.id,command,{...actor,id:worker.id},now),/Independent/);
    assert.throws(() => db.recordEvaluation('local-demo',worker.id,command,{...actor,role:'worker'},now),/Independent/);
    assert.throws(() => db.recordEvaluation('local-demo',worker.id,command,{...actor,workspaceId:'other'},now),/Independent/);
    db.recordEvaluation('local-demo',worker.id,command,actor,now);
    assert.deepEqual(db.lessons('local-demo',worker.id,{'company-source':1},now),[]);
    db.reviewLesson('local-demo',worker.id,command.id,'approved',actor,now);
    assert.equal(db.lessons('local-demo',worker.id,{'company-source':1},now).length,1);
    assert.equal(db.lessons('local-demo',worker.id,{'company-source':2},now).length,0);
    assert.equal(db.lessons('local-demo',worker.id,{},now).length,0);
    assert.equal(db.lessons('local-demo',worker.id,{'company-source':1},now+86400001).length,0);
    db.revokeExperience('local-demo',worker.id,command.id,actor);
    assert.equal(db.lessons('local-demo',worker.id,{'company-source':1},now).length,0);
    assert.equal(summarizeExperience(db.experience('local-demo',worker.id)).length,0);
    assert.equal(db.snapshot('local-demo').workers[0].id,worker.id);
  } finally {db.close();}
});
test('memory cannot import unbounded data, authority or raw reasoning fields', () => {
  assert.throws(() => parseEvaluation({id:'e',runId:'r',outcome:'accepted',evidence:['x'],rawReasoning:'private'}),/Unsupported/);
  assert.throws(() => parseEvaluation({id:'e',runId:'r',outcome:'accepted',evidence:[],lesson:null}),/Invalid/);
});
