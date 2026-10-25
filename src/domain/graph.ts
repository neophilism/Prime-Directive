export type WorkKind = 'directive' | 'subdirective' | 'task' | 'subtask';
export type WorkState = 'proposed' | 'ready' | 'running' | 'blocked' | 'validating' | 'succeeded' | 'failed' | 'cancelled';
export interface WorkNode {
  id: string; parentId: string | null; kind: WorkKind; title: string;
  description: string; acceptance: string; state: WorkState; evidence: string[];
}
export interface Dependency {id: string; source: string; target: string}
export interface DirectiveGraph {id: string; workspaceId: string; revision: number; nodes: WorkNode[]; dependencies: Dependency[]}
export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {super(message); this.name = 'DomainError'; this.code = code;}
}
const kinds = new Set(['directive', 'subdirective', 'task', 'subtask']);
const states = new Set(['proposed', 'ready', 'running', 'blocked', 'validating', 'succeeded', 'failed', 'cancelled']);
export const MAX_NODES = 5000;
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(value);
}
export function requireText(value: unknown, max: number, label: string, empty = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
    throw new DomainError('invalid', `Invalid ${label}`);
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('invalid', 'Expected an object');
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new DomainError('invalid', 'Unsupported field');
}

/** Validate at the trust boundary; returns a detached, explicitly allowlisted value. */
export function validateGraph(value: unknown): DirectiveGraph {
  const g = record(value);
  exactKeys(g, ['id', 'workspaceId', 'revision', 'nodes', 'dependencies']);
  if (!validId(g.id) || !validId(g.workspaceId) || !Number.isSafeInteger(g.revision) || Number(g.revision) < 1 ||
      !Array.isArray(g.nodes) || g.nodes.length < 1 || g.nodes.length > MAX_NODES ||
      !Array.isArray(g.dependencies) || g.dependencies.length > MAX_NODES * 4) throw new DomainError('invalid', 'Invalid graph envelope');
  const nodes = g.nodes.map(value => {
    const n = record(value);
    exactKeys(n, ['id', 'parentId', 'kind', 'title', 'description', 'acceptance', 'state', 'evidence']);
    if (!validId(n.id) || !(n.parentId === null || validId(n.parentId)) || !kinds.has(String(n.kind)) || !states.has(String(n.state)))
      throw new DomainError('invalid', 'Invalid work node');
    requireText(n.title, 160, 'title'); requireText(n.description, 6000, 'description', true); requireText(n.acceptance, 2000, 'acceptance');
    if (!Array.isArray(n.evidence) || n.evidence.length > 50) throw new DomainError('invalid', 'Invalid evidence');
    n.evidence.forEach(v => requireText(v, 500, 'evidence reference'));
    if (n.state === 'succeeded' && n.evidence.length === 0) throw new DomainError('evidence_required', 'Success requires evidence');
    return {id:n.id, parentId:n.parentId, kind:n.kind as WorkKind, title:n.title, description:n.description,
      acceptance:n.acceptance, state:n.state as WorkState, evidence:[...n.evidence] as string[]};
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (byId.size !== nodes.length) throw new DomainError('duplicate', 'Duplicate work ID');
  const roots = nodes.filter(n => n.parentId === null);
  if (roots.length !== 1 || roots[0].kind !== 'directive' || nodes.filter(n => n.kind === 'directive').length !== 1)
    throw new DomainError('invalid', 'Exactly one prime directive is required');
  for (const n of nodes) {
    let parent = n.parentId, depth = 0;
    const visited = new Set([n.id]);
    while (parent !== null) {
      if (visited.has(parent)) throw new DomainError('cycle', 'Hierarchy contains a cycle');
      visited.add(parent);
      const ancestor = byId.get(parent);
      if (!ancestor) throw new DomainError('orphan', 'Missing parent');
      if (++depth > 32) throw new DomainError('limit', 'Hierarchy exceeds 32 levels');
      parent = ancestor.parentId;
    }
  }
  const dependencies = g.dependencies.map(value => {
    const d = record(value);
    exactKeys(d, ['id', 'source', 'target']);
    if (!validId(d.id) || !validId(d.source) || !validId(d.target) || d.source === d.target || !byId.has(d.source) || !byId.has(d.target))
      throw new DomainError('invalid', 'Invalid dependency');
    // Dependencies are execution prerequisites between branches, not their hierarchy.
    let ancestor = byId.get(d.target)!.parentId;
    while (ancestor !== null) {if (ancestor === d.source) throw new DomainError('cycle', 'Ancestor cannot block its descendant'); ancestor = byId.get(ancestor)!.parentId;}
    ancestor = byId.get(d.source)!.parentId;
    while (ancestor !== null) {if (ancestor === d.target) throw new DomainError('cycle', 'Use hierarchy completion rules, not ancestor dependencies'); ancestor = byId.get(ancestor)!.parentId;}
    return {id:d.id, source:d.source, target:d.target};
  });
  if (new Set(dependencies.map(d => d.id)).size !== dependencies.length || new Set(dependencies.map(d => `${d.source}\0${d.target}`)).size !== dependencies.length)
    throw new DomainError('duplicate', 'Duplicate dependency');
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const d of dependencies) {incoming.set(d.target, incoming.get(d.target)! + 1); outgoing.set(d.source, [...(outgoing.get(d.source) ?? []), d.target]);}
  const ready = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
  for (let i = 0; i < ready.length; i++) for (const next of outgoing.get(ready[i]) ?? []) {
    incoming.set(next, incoming.get(next)! - 1); if (incoming.get(next) === 0) ready.push(next);
  }
  if (ready.length !== nodes.length) throw new DomainError('cycle', 'Execution dependencies contain a cycle');
  return {id:g.id, workspaceId:g.workspaceId, revision:g.revision as number, nodes, dependencies};
}

const transitions: Record<WorkState, readonly WorkState[]> = {
  proposed:['ready', 'cancelled'], ready:['running', 'blocked', 'cancelled'],
  running:['validating', 'blocked', 'failed', 'cancelled'], blocked:['ready', 'cancelled'],
  validating:['succeeded', 'failed', 'ready', 'cancelled'], succeeded:[], failed:['ready', 'cancelled'], cancelled:[],
};
export function transitionNode(graph: DirectiveGraph, id: string, next: WorkState, expectedRevision: number, evidence?: string[]): DirectiveGraph {
  const g = validateGraph(graph);
  if (g.revision !== expectedRevision) throw new DomainError('conflict', 'Graph revision changed');
  const node = g.nodes.find(n => n.id === id);
  if (!node) throw new DomainError('not_found', 'Work item not found');
  if (!transitions[node.state].includes(next)) throw new DomainError('transition', `Cannot change ${node.state} to ${next}`);
  if (next === 'running') {
    const prerequisites = g.dependencies.filter(d => d.target === id);
    if (prerequisites.some(d => g.nodes.find(n => n.id === d.source)!.state !== 'succeeded')) throw new DomainError('blocked', 'Prerequisites are incomplete');
  }
  node.state = next;
  if (evidence !== undefined) node.evidence = evidence;
  g.revision++;
  return validateGraph(g);
}

export function leafProgress(graph: DirectiveGraph, underId?: string) {
  const parents = new Set(graph.nodes.map(n => n.parentId));
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const leaves = graph.nodes.filter(n => !parents.has(n.id) && (!underId || (() => {
    let current: WorkNode | undefined = n;
    while (current) {if (current.id === underId) return true; current = current.parentId ? byId.get(current.parentId) : undefined;}
    return false;
  })()));
  return {total:leaves.length, completed:leaves.filter(n => n.state === 'succeeded').length,
    cancelled:leaves.filter(n => n.state === 'cancelled').length};
}
