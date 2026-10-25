import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linkEngineProject, requireCanonicalWriter} from '../src/domain/ownership.ts';

test('engine identifiers retain their canonical owner and revision', () => {
  assert.deepEqual(linkEngineProject({id: 'project_fixture_1', title: 'Investment readiness', kind: 'workspace', revision: 3}),
    {owner: 'engine', externalId: 'project_fixture_1', revision: 3});
  assert.throws(() => linkEngineProject({id: 'p', revision: '3'}));
});
test('integration cannot introduce a second writer or wrong authority', () => {
  assert.equal(requireCanonicalWriter('project', ['engine']), 'engine');
  assert.throws(() => requireCanonicalWriter('directive', ['prime-directive', 'engine']));
  assert.throws(() => requireCanonicalWriter('nameClaim', ['prime-directive']));
});
