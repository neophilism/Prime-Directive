import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorkspaceStore} from '../src/server/store.ts';
import {DatabaseSync} from 'node:sqlite';
import {exampleGraph} from '../src/domain/example.ts';

test('worker identity, assignment and events survive close and restart', () => {
  const dir=mkdtempSync(join(tmpdir(),'pd-store-')),path=join(dir,'test.sqlite');
  try {
    let db=new WorkspaceStore(path); db.initialize(exampleGraph());
    const worker=db.createSimulationWorker('local-demo','Worker 01','Evidence research');
    const run=db.assign('local-demo',worker.id,'readiness-evidence',1);
    const cursor=db.snapshot('local-demo').cursor; db.close(); db=new WorkspaceStore(path);
    try {
      assert.equal(db.initialize(exampleGraph()),false);
      assert.equal(db.snapshot('local-demo').workers[0].id,worker.id);
      assert.equal(db.snapshot('local-demo').runs[0].id,run.id);
      assert.equal(db.snapshot('local-demo').workers[0].state,'working');
      db.advanceSimulation('local-demo',worker.id,2); db.advanceSimulation('local-demo',worker.id,3);
      const s=db.snapshot('local-demo');
      assert.equal(s.workers[0].state,'idle'); assert.equal(s.workers[0].name,null);
      assert.equal(s.runs[0].state,'completed'); assert.equal(s.graph.nodes[0].state,'ready');
      assert.equal(db.events('local-demo',cursor).length,2);
      assert.equal(db.retireWorker('local-demo',worker.id).id,worker.id);
      assert.equal(db.snapshot('local-demo').runs.length,1);
    } finally {db.close();}
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('assignment conflicts roll back all state and cannot cross workspaces', () => {
  const db=new WorkspaceStore(':memory:');
  try {
    db.initialize(exampleGraph());db.initialize({...exampleGraph(),workspaceId:'other'});
    const a=db.createSimulationWorker('local-demo','Worker A','Research'),b=db.createSimulationWorker('local-demo','Worker B','Writing');
    db.assign('local-demo',a.id,'readiness-evidence',1);
    assert.throws(() => db.assign('local-demo',a.id,'relationships-research',2),/idle/);
    assert.throws(() => db.assign('local-demo',b.id,'readiness-evidence',2));
    assert.throws(() => db.assign('local-demo',b.id,'relationships-research',1),/revision/);
    assert.throws(() => db.assign('other',a.id,'readiness-evidence',1),/not found/);
    assert.equal(db.snapshot('local-demo').graph.revision,2);
    assert.equal(db.snapshot('local-demo').runs.length,1);
    assert.equal(db.events('other').length,0);
    assert.throws(() => db.retireWorker('local-demo',a.id),/idle/);
    db.pauseWorker('local-demo',a.id,true);
    assert.throws(() => db.advanceSimulation('local-demo',a.id,2),/not working/);
    db.pauseWorker('local-demo',a.id,false);
    assert.equal(db.snapshot('local-demo').workers.find(w => w.id === a.id)!.state,'working');
  } finally {db.close();}
});
test('two database connections cannot claim the same task or worker', () => {
  const dir=mkdtempSync(join(tmpdir(),'pd-conflict-')),path=join(dir,'test.sqlite');
  const a=new WorkspaceStore(path),b=new WorkspaceStore(path);
  try {
    a.initialize(exampleGraph());const w1=a.createSimulationWorker('local-demo','Worker A','Research'),w2=a.createSimulationWorker('local-demo','Worker B','Research');
    const revA=a.snapshot('local-demo').graph.revision,revB=b.snapshot('local-demo').graph.revision;
    a.assign('local-demo',w1.id,'readiness-evidence',revA);
    assert.throws(() => b.assign('local-demo',w2.id,'readiness-evidence',revB));
    assert.equal(b.snapshot('local-demo').runs.length,1);
  } finally {a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
test('a future schema is refused before application tables are created', () => {
  const dir=mkdtempSync(join(tmpdir(),'pd-version-')),path=join(dir,'test.sqlite');
  let raw=new DatabaseSync(path);
  raw.exec('CREATE TABLE schema_version(version INTEGER PRIMARY KEY); INSERT INTO schema_version VALUES(99)'); raw.close();
  try {
    assert.throws(() => new WorkspaceStore(path),/Unsupported/);
    raw=new DatabaseSync(path);
    assert.equal(raw.prepare("SELECT name FROM sqlite_master WHERE name='graphs'").get(),undefined);
    raw.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});
