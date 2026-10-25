import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {WorkspaceStore} from './store.ts';
import {createApplication} from './app.ts';
import {initializeSimulation} from './simulation.ts';
if(process.env.NODE_ENV==='production')throw new Error('This local reference server is not a production service.');
const port=Number(process.env.PD_PORT??4317);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
if(process.env.PD_HOST && process.env.PD_HOST!=='127.0.0.1')throw new Error('Local reference server must bind to 127.0.0.1');
const path=resolve(process.env.PD_DATABASE??'.data/prime-directive.sqlite');mkdirSync(dirname(path),{recursive:true});
const store=new WorkspaceStore(path);initializeSimulation(store);
const app=createApplication(store,{frontendOrigin:'http://127.0.0.1:5173',staticDir:resolve('dist')});
app.server.listen(port,'127.0.0.1',() => console.log(`Prime Directive simulation: http://127.0.0.1:${port}`));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await app.close();store.close();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
