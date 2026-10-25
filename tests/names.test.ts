import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {availableNames,validateCatalog} from '../src/domain/names.ts';
import {approvedNames,readNameAvailability} from '../src/server/name-inventory.ts';
const now=Date.parse('2026-10-25T04:00:00.000Z');
const inventory=() => ({ownerScope:'owner-fixture',revision:'inventory-1',capturedAt:new Date(now).toISOString(),
  complete:{activeCredentials:true,ownerReservations:true,logicalAgents:true,primeDirectiveClaims:true},
  occupied:{activeCredentials:['Smith'],ownerReservations:['Eve'],logicalAgents:['MAX'],primeDirectiveClaims:['Gort']}});
test('catalog matches the inspected Boardroom blob exactly', () => {
  const bytes=readFileSync(new URL('../registry/agent-names.json',import.meta.url));
  const hash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const source=JSON.parse(readFileSync(new URL('../registry/source-provenance.json',import.meta.url),'utf8'));
  assert.equal(hash,source.nameCatalogBlob);assert.equal(approvedNames.length,source.nameCatalogCount);
});
test('all occupancy sources are excluded without folding case or punctuation', () => {
  const result=availableNames(approvedNames,inventory(),'owner-fixture',now);
  assert.equal(result.state,'verified-snapshot');
  for (const occupied of ['Smith','Eve','MAX','Gort']) assert.ok(!result.candidates.includes(occupied));
  assert.ok(result.candidates.includes('EVE') && result.candidates.includes('Max'));
  assert.equal(result.liveAllocationEnabled,false);
});
test('stale, future, partial, invalid or wrong-scope inventory never allocates names', () => {
  const partial=inventory(); partial.complete.ownerReservations=false;
  for (const input of [partial,{...inventory(),capturedAt:new Date(now-60001).toISOString()},{...inventory(),capturedAt:new Date(now+1).toISOString()},
    {...inventory(),ownerScope:'other'},{...inventory(),occupied:{activeCredentials:[]}},null]) {
    const r=availableNames(approvedNames,input,'owner-fixture',now);assert.equal(r.state,'unknown');assert.deepEqual(r.candidates,[]);
  }
  assert.throws(() => validateCatalog({schemaVersion:1,names:['Smith','Smith']}));
});
test('unconfigured and timed-out providers return explicit unknown availability', async () => {
  assert.equal((await readNameAvailability(null,'owner-fixture')).state,'unknown');
  let aborted=false;
  const provider={read:(_scope:string,signal:AbortSignal) => new Promise<unknown>(() => {signal.addEventListener('abort',() => {aborted=true;});})};
  assert.equal((await readNameAvailability(provider,'owner-fixture',5)).state,'unknown');assert.equal(aborted,true);
});
