import type {WorkspaceSnapshot} from './workers.ts';
import {projectAttachments} from './projection.ts';
import type {Orientation,PositionedWork} from './projection.ts';
interface Box {x:number;y:number;width:number;height:number}
const overlaps=(a:Box,b:Box)=>a.x<b.x+b.width+12&&a.x+a.width+12>b.x&&a.y<b.y+b.height+12&&a.y+a.height+12>b.y;
export function projectWorkers(snapshot:WorkspaceSnapshot,work:PositionedWork[],orientation:Orientation,collapsed:readonly string[]) {
  const active=snapshot.runs.filter(r=>r.state==='running');
  const attachments=projectAttachments(snapshot.graph,active.map(r=>({workerId:r.workerId,taskId:r.taskId})),orientation,collapsed);
  const root=work.find(w=>w.work.parentId===null)!;
  const boxes:Box[]=work.map(w=>({...w.position,width:256,height:w.work.kind==='directive'?200:155}));
  return snapshot.workers.map((worker,index)=>{
    const attachment=attachments.find(a=>a.workerId===worker.id);
    const target=work.find(w=>w.id===attachment?.visibleTarget);
    const desired=target?(orientation==='horizontal'?{x:target.position.x+278,y:target.position.y+20}:{x:target.position.x+45,y:target.position.y+175}):
      orientation==='horizontal'?{x:root.position.x+25,y:root.position.y+240+index*90}:{x:root.position.x-220,y:root.position.y+index*90};
    const box={...desired,width:184,height:78};
    // Stacked workers and collapsed branches remain individually inspectable.
    while(boxes.some(b=>overlaps(box,b)))box.y+=90;
    boxes.push(box);
    return {worker,position:{x:box.x,y:box.y},attachment:attachment??null};
  });
}
