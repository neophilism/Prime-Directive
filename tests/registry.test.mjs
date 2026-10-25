import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePrRegistry} from '../registry/pr-contract.mjs';
const raw = readFileSync(new URL('../registry/prs.json', import.meta.url), 'utf8');
const repo = 'neophilism/Prime-Directive';
test('canonical plan preserves original 80 IDs and the visual workforce additions', () => {
  const {document} = parsePrRegistry(raw, repo);
  assert.equal(document.units.length, 92);
  for (let i=1; i<=80; i++) assert.ok(document.units.find(u => u.id === `PD-${String(i).padStart(3, '0')}` && u.legacyId === `PD${String(i).padStart(3, '0')}`));
});
test('duplicate IDs, cycles and invented dependencies are rejected', () => {
  const mutate = f => {const d = JSON.parse(raw); f(d); return () => parsePrRegistry(JSON.stringify(d), repo);};
  assert.throws(mutate(d => d.units[1].id = d.units[0].id));
  assert.throws(mutate(d => d.units[0].dependsOn = [d.units[1].id]));
  assert.throws(mutate(d => d.units[0].dependsOn = ['PD-999']));
});
test('Boardroom catalog is exact, unique and versioned; it is not availability evidence', () => {
  const catalog = JSON.parse(readFileSync(new URL('../registry/agent-names.json', import.meta.url), 'utf8'));
  assert.equal(new Set(catalog.names).size, catalog.names.length);
  assert.ok(catalog.names.includes('Eve') && catalog.names.includes('EVE'));
  assert.ok(catalog.names.includes('Smith'));
});
