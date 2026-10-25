import {createServer} from 'node:http';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {DomainError,record,exactKeys,requireText,validId} from '../domain/graph.ts';
import {parseActivity} from '../domain/activity.ts';
import {summarizeExperience} from '../domain/experience.ts';
import type {ReviewPrincipal} from '../domain/experience.ts';
import type {WorkspaceStore} from './store.ts';
import {approvedNames,readNameAvailability} from './name-inventory.ts';
import {DEMO_WORKSPACE,stepSimulation} from './simulation.ts';
const BODY_LIMIT=32768;
class HttpError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
function reply(res:ServerResponse,status:number,value:unknown) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
function jsonBody(req:IncomingMessage):Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return Promise.reject(new HttpError(415,'JSON is required'));
  return new Promise((resolveBody,reject) => {
    let length=0,settled=false;const chunks:Buffer[]=[];
    req.on('data',(chunk:Buffer) => {if(settled)return;length+=chunk.length;if(length>BODY_LIMIT){settled=true;req.pause();reject(new HttpError(413,'Request body too large'));return;}chunks.push(chunk);});
    req.on('end',() => {if(settled)return;settled=true;try{resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new HttpError(400,'Invalid JSON'));}});
    req.on('error',() => reject(new HttpError(400,'Request interrupted')));
  });
}
function cursor(value:unknown):number {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,14})$/.test(value) || !Number.isSafeInteger(Number(value))) throw new HttpError(400,'Invalid cursor');
  return Number(value);
}
interface Subscriber {res:ServerResponse;cursor:number;lastHeartbeat:number}
export function createApplication(store:WorkspaceStore,options:{frontendOrigin?:string;staticDir?:string;heartbeatMs?:number}={}) {
  if (options.frontendOrigin) {
    const origin=new URL(options.frontendOrigin);
    if (origin.protocol!=='http:' || !['localhost','127.0.0.1'].includes(origin.hostname) || origin.origin!==options.frontendOrigin) throw new Error('Frontend must use an exact loopback origin');
  }
  const subscribers=new Set<Subscriber>();
  const heartbeatMs=options.heartbeatMs??10000;
  if (!Number.isSafeInteger(heartbeatMs) || heartbeatMs<10 || heartbeatMs>30000) throw new Error('Invalid heartbeat interval');
  const actor:ReviewPrincipal={id:'local-owner',workspaceId:DEMO_WORKSPACE,role:'owner'};
  let timer:ReturnType<typeof setInterval>|null=null;
  function pump() {
    for (const client of subscribers) {
      try {
        for (const raw of store.events(DEMO_WORKSPACE,client.cursor,100)) {
          const event=parseActivity(raw);
          if (client.res.writableLength>65536 || !client.res.write(`id: ${event.cursor}\nevent: activity\ndata: ${JSON.stringify(event)}\n\n`)) {client.res.end();subscribers.delete(client);break;}
          client.cursor=event.cursor;
        }
        if (subscribers.has(client) && Date.now()-client.lastHeartbeat>=heartbeatMs) {
          client.lastHeartbeat=Date.now();
          if (!client.res.write(`event: heartbeat\ndata: ${JSON.stringify({at:new Date().toISOString(),cursor:client.cursor})}\n\n`)) {client.res.end();subscribers.delete(client);}
        }
      } catch {client.res.end();subscribers.delete(client);}
    }
  }
  const server=createServer(async(req,res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const address=server.address();const port=address && typeof address==='object' ? address.port : 0;
      if (![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host??'')) throw new HttpError(403,'Host rejected');
      const allowedOrigins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`,options.frontendOrigin].filter(Boolean));
      if (req.headers.origin && !allowedOrigins.has(req.headers.origin) || req.headers['sec-fetch-site']==='cross-site') throw new HttpError(403,'Origin rejected');
      const url=new URL(req.url??'/',`http://127.0.0.1:${port}`);
      if (req.method==='GET' && url.pathname==='/api/health') return reply(res,200,{ok:true,mode:'simulation',liveExecution:false});
      if (req.method==='GET' && url.pathname==='/api/workspace') return reply(res,200,store.snapshot(DEMO_WORKSPACE));
      if (req.method==='GET' && url.pathname==='/api/names') return reply(res,200,{catalog:approvedNames,...await readNameAvailability(null,'local-owner')});
      if (req.method==='GET' && url.pathname==='/api/activity') {
        if(url.searchParams.has('recent')){
          if(url.searchParams.get('recent')!=='1'||url.searchParams.has('after'))throw new HttpError(400,'Invalid history mode');
          const through=cursor(url.searchParams.get('through'));
          if(through>store.snapshot(DEMO_WORKSPACE).cursor)throw new HttpError(409,'History cursor is ahead of the workspace');
          return reply(res,200,{events:store.recentEvents(DEMO_WORKSPACE,through,100)});
        }
        if(url.searchParams.has('through'))throw new HttpError(400,'History mode required');
        return reply(res,200,{events:store.events(DEMO_WORKSPACE,cursor(url.searchParams.get('after')??'0'),100)});
      }
      if (req.method==='GET' && url.pathname==='/api/events') {
        if(subscribers.size>=8)throw new HttpError(429,'Too many event subscribers');
        const after=cursor(req.headers['last-event-id']??url.searchParams.get('after')??'0');
        if(after>store.snapshot(DEMO_WORKSPACE).cursor)throw new HttpError(409,'Cursor is ahead of the workspace; fetch a fresh snapshot');
        res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
        const client={res,cursor:after,lastHeartbeat:0};subscribers.add(client);
        res.on('close',() => subscribers.delete(client));pump();return;
      }
      const experiencePath=url.pathname.match(/^\/api\/workers\/([A-Za-z0-9_.:-]+)\/experience$/);
      if (req.method==='GET' && experiencePath) {
        const experience=store.experience(DEMO_WORKSPACE,experiencePath[1]);
        return reply(res,200,{experience,summary:summarizeExperience(experience),lessons:store.lessons(DEMO_WORKSPACE,experiencePath[1],{'demo-source':1})});
      }
      if (req.method==='POST' && url.pathname==='/api/commands') {
        if (!req.headers.origin || !allowedOrigins.has(req.headers.origin) || req.headers['x-prime-directive']!=='local-ui') throw new HttpError(403,'Local UI request required');
        const body=record(await jsonBody(req));let result:unknown;
        const fields:Record<string,string[]>={step:['type'],assign:['type','workerId','taskId','revision'],advance:['type','workerId','revision'],
          pause:['type','workerId'],resume:['type','workerId'],retire:['type','workerId'],createWorker:['type','label','specialty'],
          evaluate:['type','workerId','evaluation'],reviewLesson:['type','workerId','experienceId','decision'],revokeExperience:['type','workerId','experienceId']};
        if (typeof body.type!=='string' || !Object.hasOwn(fields,body.type))throw new HttpError(400,'Unknown command');
        exactKeys(body,fields[body.type]);
        if (fields[body.type].includes('revision') && (!Number.isSafeInteger(body.revision) || Number(body.revision)<1)) throw new HttpError(400,'Invalid revision');
        if (fields[body.type].includes('workerId') && !validId(body.workerId)) throw new HttpError(400,'Invalid worker');
        if (fields[body.type].includes('experienceId') && !validId(body.experienceId)) throw new HttpError(400,'Invalid experience ID');
        const workerId=body.workerId as string;
        switch(body.type) {
          case 'step':result=stepSimulation(store);break;
          case 'assign':if(!validId(body.taskId))throw new HttpError(400,'Invalid task');result=store.assign(DEMO_WORKSPACE,workerId,body.taskId,Number(body.revision));break;
          case 'advance':result=store.advanceSimulation(DEMO_WORKSPACE,workerId,Number(body.revision));break;
          case 'pause':result=store.pauseWorker(DEMO_WORKSPACE,workerId,true);break;
          case 'resume':result=store.pauseWorker(DEMO_WORKSPACE,workerId,false);break;
          case 'retire':result=store.retireWorker(DEMO_WORKSPACE,workerId);break;
          case 'createWorker':requireText(body.label,80,'label');requireText(body.specialty,80,'specialty');result=store.createSimulationWorker(DEMO_WORKSPACE,body.label,body.specialty);break;
          case 'evaluate':result=store.recordEvaluation(DEMO_WORKSPACE,workerId,body.evaluation,actor);break;
          case 'reviewLesson':if(body.decision!=='approved'&&body.decision!=='revoked')throw new HttpError(400,'Invalid decision');result=store.reviewLesson(DEMO_WORKSPACE,workerId,body.experienceId as string,body.decision,actor);break;
          case 'revokeExperience':result=store.revokeExperience(DEMO_WORKSPACE,workerId,body.experienceId as string,actor);break;
        }
        pump();return reply(res,200,{result,snapshot:store.snapshot(DEMO_WORKSPACE)});
      }
      if (req.method==='GET' && !url.pathname.startsWith('/api/') && options.staticDir) {
        const root=resolve(options.staticDir),path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
        if(!path.startsWith(root+sep))throw new HttpError(404,'Not found');
        let bytes:Buffer;try{bytes=await readFile(path);}catch{throw new HttpError(404,'Not found');}
        const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'};
        res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream'});res.end(bytes);return;
      }
      throw new HttpError(404,'Not found');
    } catch(error) {
      if(res.headersSent){res.end();return;}
      const domainStatus:Record<string,number>={forbidden:403,not_found:404,conflict:409,blocked:409,transition:409};
      const status=error instanceof HttpError ? error.status : error instanceof DomainError ? (domainStatus[error.code]??400) : 500;
      if(status===413){res.setHeader('Connection','close');res.once('finish',() => req.destroy());}
      reply(res,status,{error:status===500?'Local service could not complete the request':(error as Error).message});
    }
  });
  server.requestTimeout=10000;server.headersTimeout=5000;
  server.on('listening',() => {timer=setInterval(pump,250);timer.unref();});
  server.on('close',() => {if(timer)clearInterval(timer);});
  return {server,close:async() => {if(timer)clearInterval(timer);for(const c of subscribers)c.res.end();subscribers.clear();server.closeAllConnections();await new Promise<void>((resolveClose,reject) => server.close(error => error?reject(error):resolveClose()));}};
}
