import {readFileSync} from 'node:fs';
import {parsePrRegistry} from '../registry/pr-contract.mjs';
const {document} = parsePrRegistry(readFileSync(new URL('../registry/prs.json', import.meta.url), 'utf8'), 'neophilism/Prime-Directive');
console.log(`Validated ${document.units.length} canonical work units; ${document.pullRequests.length} dated PR observations.`);

