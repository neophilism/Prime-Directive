import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {WorkspaceStore} from '../src/server/store.ts';
import {createApplication} from '../src/server/app.ts';
import {initializeSimulation,stepSimulation} from '../src/server/simulation.ts';
import {acceptActivity,newerSnapshot,parseActivity} from '../src/domain/activity.ts';

async function fixture() {
  const store=new WorkspaceStore(':memory:');initializeSimulation(store);
  const app=createApplication(store,{heartbeatMs:50});
  await new Promise<void>(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const address=app.server.address();if(!address || typeof address==='string')throw new Error('Missing test server');
  const url=`http://127.0.0.1:${address.port}`;
  return {store,url,command:(body:unknown,headers:Record<string,string>={}) => fetch(url+'/api/commands',{
    method:'POST',headers:{'content-type':'application/json',origin:url,'x-prime-directive':'local-ui',...headers},body:JSON.stringify(body)}),
    close:async()=>{await app.close();store.close();}};
}
test('local API persists observed changes and refuses unsafe request origins and fields',async () => {
  const f=await fixture();
  try {
    assert.deepEqual(await (await fetch(f.url+'/api/health')).json(),{ok:true,mode:'simulation',liveExecution:false});
    assert.equal((await f.command({type:'step'},{origin:'https://attacker.example'})).status,403);
    const forgedHostStatus=await new Promise<number|undefined>((resolve,reject) => {
      const req=request(f.url+'/api/workspace',{headers:{host:'attacker.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('error',reject);req.end();
    });
    assert.equal(forgedHostStatus,403);
    assert.equal((await f.command({type:'step',rawReasoning:'private'})).status,400);
    assert.equal((await f.command({type:'step'},{'x-prime-directive':''})).status,403);
    const result=await (await f.command({type:'step'})).json() as {snapshot:{graph:{revision:number}}};
    assert.equal(result.snapshot.graph.revision,2);
    const names=await (await fetch(f.url+'/api/names')).json() as {state:string;liveAllocationEnabled:boolean;candidates:string[]};
    assert.equal(names.state,'unknown');assert.equal(names.liveAllocationEnabled,false);assert.deepEqual(names.candidates,[]);
    const worker=f.store.snapshot('local-demo').workers[1];
    assert.equal((await f.command({type:'assign',workerId:worker.id,taskId:'relationships-research',revision:1})).status,409);
    assert.equal((await f.command({type:'assign',workerId:worker.id,taskId:'relationships-research',revision:'2'})).status,400);
  } finally {await f.close();}
});
test('oversize JSON and ahead-of-stream cursors are rejected',async () => {
  const f=await fixture();
  try {
    assert.equal((await f.command({type:'createWorker',label:'x'.repeat(40000),specialty:'Research'})).status,413);
    assert.equal((await fetch(f.url+'/api/events?after=999999')).status,409);
    assert.equal((await fetch(f.url+'/api/events?after=-1')).status,400);
  } finally {await f.close();}
});
test('SSE replays only after the last accepted event and emits deliberate activity summaries',async () => {
  const f=await fixture();const abort=new AbortController();
  try {
    const prior=f.store.snapshot('local-demo').cursor;
    await f.command({type:'step'});
    const response=await fetch(f.url+'/api/events?after=0',{headers:{'last-event-id':String(prior)},signal:abort.signal});
    assert.equal(response.headers.get('content-type'),'text/event-stream');
    const reader=response.body!.getReader();const chunk=await reader.read();
    const text=new TextDecoder().decode(chunk.value);
    assert.ok(text.includes(`id: ${prior+1}`));assert.ok(!text.includes('worker.created'));assert.ok(text.includes('task.assigned'));
    assert.ok(!text.includes('rawReasoning') && !text.includes('prompt'));
    await reader.cancel();
  } finally {abort.abort();await f.close();}
});
test('subscriber limits are bounded and slots are released after disconnection',async () => {
  const f=await fixture();const responses:Response[]=[];
  try {
    for(let i=0;i<8;i++)responses.push(await fetch(f.url+'/api/events?after=0'));
    assert.equal((await fetch(f.url+'/api/events?after=0')).status,429);
    await Promise.all(responses.map(r=>r.body!.cancel()));
  } finally {await f.close();}
});
test('client projection deduplicates events and rejects stale or foreign state',async () => {
  const f=await fixture();
  try {
    const before=f.store.snapshot('local-demo');stepSimulation(f.store);
    const after=f.store.snapshot('local-demo'),event=f.store.events('local-demo',before.cursor)[0];
    assert.equal(acceptActivity(event.cursor,event,'local-demo'),null);
    assert.equal(acceptActivity(before.cursor,event,'local-demo')!.kind,'task.assigned');
    assert.throws(()=>acceptActivity(0,event,'other'),/different workspace/);
    assert.throws(()=>parseActivity({...event,rawReasoning:'hidden'}),/Unsupported/);
    assert.equal(newerSnapshot(after,before),after);
    assert.throws(()=>newerSnapshot(before,{...after,graph:{...after.graph,workspaceId:'other'}}),/identity/);
  } finally {await f.close();}
});
test('simulation completes bounded leaf work without asserting an external outcome',()=>{
  const store=new WorkspaceStore(':memory:');
  try {
    initializeSimulation(store);initializeSimulation(store);assert.equal(store.snapshot('local-demo').workers.length,3);
    let steps=0;while(stepSimulation(store).changed && steps<100)steps++;
    const s=store.snapshot('local-demo');
    assert.ok(steps<100);assert.equal(s.runs.filter(r=>r.state==='completed').length,6);
    assert.equal(s.graph.nodes.find(n=>n.kind==='directive')!.state,'ready');
    assert.equal(s.workers.every(w=>w.state==='idle'),true);
  } finally {store.close();}
});
