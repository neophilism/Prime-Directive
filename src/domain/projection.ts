import {validateGraph} from './graph.ts';
import type {DirectiveGraph, WorkNode} from './graph.ts';
export type Orientation = 'horizontal' | 'vertical';
export interface PositionedWork {id:string; work:WorkNode; position:{x:number;y:number}; hiddenDescendants:number}
export interface WorkerAttachment {workerId:string; taskId:string}
export function projectAttachments(graph:DirectiveGraph, assignments:readonly WorkerAttachment[], orientation:Orientation, collapsed:readonly string[]) {
  const projection = projectGraph(graph, orientation, collapsed);
  const workers = new Set<string>();
  return assignments.map(a => {
    if (!a.workerId || workers.has(a.workerId)) throw new Error('Duplicate or invalid worker attachment');
    workers.add(a.workerId);
    const visibleTarget = projection.visibleAncestor.get(a.taskId);
    if (!visibleTarget) throw new Error('Attachment references a missing task');
    return {...a, visibleTarget, insideCollapsedBranch:visibleTarget !== a.taskId};
  });
}
export function projectGraph(input: DirectiveGraph, orientation: Orientation = 'horizontal', collapsed: readonly string[] = []) {
  const graph = validateGraph(input);
  const children = new Map<string, WorkNode[]>();
  for (const n of graph.nodes) if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
  for (const items of children.values()) items.sort((a,b) => a.id.localeCompare(b.id));
  const root = graph.nodes.find(n => n.parentId === null)!;
  const hidden = new Set(collapsed), positions: PositionedWork[] = [], visibleAncestor = new Map<string,string>();
  let leaf = 0;
  function conceal(id:string, ancestor:string):number {
    visibleAncestor.set(id, ancestor); let count = 1;
    for (const child of children.get(id) ?? []) count += conceal(child.id, ancestor);
    return count;
  }
  function visit(node:WorkNode, depth:number):number {
    const descendants = children.get(node.id) ?? [];
    let count = 0, center:number;
    if (hidden.has(node.id)) {
      for (const child of descendants) count += conceal(child.id, node.id);
      center = leaf++;
    } else if (descendants.length) {
      const centers = descendants.map(n => visit(n, depth + 1)); center = (centers[0] + centers.at(-1)!) / 2;
    } else center = leaf++;
    visibleAncestor.set(node.id, node.id);
    positions.push({id:node.id, work:node, hiddenDescendants:count,
      position:orientation === 'horizontal' ? {x:depth*340, y:center*200} : {x:center*300, y:depth*230}});
    return center;
  }
  visit(root,0);
  positions.sort((a,b) => a.id.localeCompare(b.id));
  const visible = new Set(positions.map(n => n.id));
  const hierarchy = positions.filter(n => n.work.parentId && visible.has(n.work.parentId)).map(n => ({id:`hierarchy:${n.id}`, source:n.work.parentId!, target:n.id, kind:'hierarchy' as const}));
  const dependencies = graph.dependencies.filter(d => visible.has(d.source) && visible.has(d.target)).map(d => ({...d, id:`dependency:${d.id}`, kind:'dependency' as const}));
  return {nodes:positions, edges:[...hierarchy,...dependencies], visibleAncestor, hiddenDependencyCount:graph.dependencies.length-dependencies.length};
}
