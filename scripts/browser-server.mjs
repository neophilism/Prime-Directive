import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {WorkspaceStore} from '../src/server/store.ts';
import {initializeSimulation} from '../src/server/simulation.ts';
import {createApplication} from '../src/server/app.ts';
const directory=mkdtempSync(join(tmpdir(),'prime-directive-browser-'));
const store=new WorkspaceStore(join(directory,'test.sqlite'));
initializeSimulation(store);
const app=createApplication(store,{staticDir:resolve('dist')});
app.server.listen(4318,'127.0.0.1');
let closing=false;
async function close(){if(closing)return;closing=true;await app.close();store.close();rmSync(directory,{recursive:true,force:true});}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
