import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exampleGraph} from '../src/domain/example.ts';
import {validateGraph, transitionNode, leafProgress} from '../src/domain/graph.ts';
import {projectGraph, projectAttachments} from '../src/domain/projection.ts';

test('rejects duplicate identities, orphans, hierarchy loops and execution loops', () => {
  let g = exampleGraph(); g.nodes.push({...g.nodes[0]}); assert.throws(() => validateGraph(g), /Duplicate/);
  g = exampleGraph(); g.nodes[1].parentId = 'missing'; assert.throws(() => validateGraph(g), /Missing parent/);
  g = exampleGraph(); g.nodes[1].parentId = 'readiness-evidence'; assert.throws(() => validateGraph(g), /cycle/);
  g = exampleGraph(); g.dependencies.push({id:'reverse',source:'readiness-brief',target:'readiness-evidence'}); assert.throws(() => validateGraph(g), /cycle/);
  g = exampleGraph(); g.dependencies.push({id:'ancestor',source:'root',target:'readiness-evidence'}); assert.throws(() => validateGraph(g), /Ancestor/);
});
test('state changes require current revision, prerequisites and evidence', () => {
  let g = exampleGraph();
  assert.throws(() => transitionNode(g, 'readiness-evidence', 'running', 0), /revision/);
  assert.throws(() => transitionNode(g, 'readiness-brief', 'running', 1), /Prerequisites/);
  assert.throws(() => transitionNode(g, 'readiness-evidence', 'succeeded', 1), /Cannot change/);
  g = transitionNode(g, 'readiness-evidence', 'running', 1);
  g = transitionNode(g, 'readiness-evidence', 'validating', 2);
  assert.throws(() => transitionNode(g, 'readiness-evidence', 'succeeded', 3), /evidence/);
  g = transitionNode(g, 'readiness-evidence', 'succeeded', 3, ['fixture:review-1']);
  assert.equal(transitionNode(g, 'readiness-brief', 'running', 4).revision, 5);
  assert.equal(g.nodes.find(n => n.id === 'root')!.state, 'ready');
  assert.deepEqual(leafProgress(g), {completed:1,total:6,cancelled:0});
});
test('collapse preserves real attachment identity and omits hidden dependency edges', () => {
  const p = projectGraph(exampleGraph(), 'horizontal', ['readiness']);
  assert.equal(p.visibleAncestor.get('readiness-evidence'), 'readiness');
  assert.equal(p.nodes.find(n => n.id === 'readiness')!.hiddenDescendants, 2);
  assert.ok(!p.nodes.some(n => n.id === 'readiness-evidence'));
  assert.equal(p.hiddenDependencyCount, 2);
  assert.deepEqual(projectAttachments(exampleGraph(), [{workerId:'worker-1',taskId:'readiness-evidence'}], 'horizontal', ['readiness']),
    [{workerId:'worker-1',taskId:'readiness-evidence',visibleTarget:'readiness',insideCollapsedBranch:true}]);
  assert.throws(() => projectAttachments(exampleGraph(), [{workerId:'worker-1',taskId:'unknown'}], 'horizontal', []));
});
test('both layouts are deterministic, avoid card overlap and keep root at the origin side', () => {
  const g = exampleGraph();
  for (const orientation of ['horizontal','vertical'] as const) {
    const p = projectGraph(g, orientation), shuffled = projectGraph({...g,nodes:[...g.nodes].reverse()}, orientation);
    assert.deepEqual(p.nodes, shuffled.nodes);
    for (const a of p.nodes) for (const b of p.nodes) if (a.id !== b.id)
      assert.ok(Math.abs(a.position.x-b.position.x) >= 260 || Math.abs(a.position.y-b.position.y) >= 160);
    const root = p.nodes.find(n => n.id === 'root')!;
    assert.equal(orientation === 'horizontal' ? root.position.x : root.position.y, 0);
  }
});
test('untrusted graph envelopes cannot add private or executable fields', () => {
  assert.throws(() => validateGraph({...exampleGraph(), rawReasoning:'hidden'}), /Unsupported/);
  const g = exampleGraph(); g.nodes[0].evidence = ['']; assert.throws(() => validateGraph(g), /evidence/);
});
