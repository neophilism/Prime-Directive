export const canonicalOwners = {
  project: 'engine', artifact: 'engine', providerRun: 'engine',
  directive: 'prime-directive', plan: 'prime-directive', task: 'prime-directive',
  worker: 'prime-directive', experience: 'prime-directive',
  nameClaim: 'portfolio-name-authority', developmentUnit: 'github-registry',
} as const;
export type EntityKind = keyof typeof canonicalOwners;
export type Owner = typeof canonicalOwners[EntityKind];

export function requireCanonicalWriter(entity: EntityKind, writers: readonly Owner[]): Owner {
  if (writers.length !== 1 || writers[0] !== canonicalOwners[entity]) {
    throw new Error(`Exactly one canonical writer is required for ${entity}`);
  }
  return writers[0];
}

// Bound to Superintelligence Engine contracts/openapi.json Project schema.
// This maps identifiers; it does not invoke or authenticate to the live engine.
export function linkEngineProject(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invalid engine project');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id.trim() || typeof p.title !== 'string' ||
      typeof p.kind !== 'string' || !Number.isSafeInteger(p.revision) || Number(p.revision) < 0) {
    throw new Error('Invalid engine project');
  }
  return {owner: 'engine' as const, externalId: p.id, revision: p.revision as number};
}
