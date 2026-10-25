# Local reference runtime

Use Node 24.22.1 and `npm ci`. `npm start` runs a loopback-only simulation API on `http://127.0.0.1:4317`; once the visual client is built it also serves `dist/`. `npm run dev:api` watches server sources. `PD_PORT` changes the local port and `PD_DATABASE` changes the SQLite path. Defaults persist under `.data/`, which is ignored by Git.

The synthetic investment-readiness example is seeded only on first initialization. It has three persistent unnamed workers. Reloading or restarting does not reset identities, run history or reviewed experience. Activity is real observation of the simulator, not evidence of real model execution, investor contact or external success. No credentials, external requests, paid services or live name claims are enabled.

## API

- `GET /api/health`: explicit simulation and execution status.
- `GET /api/workspace`: consistent graph, workforce, run history and event cursor.
- `GET /api/events`: server-sent events. `Last-Event-ID` takes precedence over `after`; invalid/ahead cursors fail explicitly.
- `GET /api/activity?after=CURSOR`: paginated persisted public events.
- `GET /api/names`: public catalog plus unknown availability until the authenticated authority is connected.
- `GET /api/workers/ID/experience`: reviewed experience, measured specialty counts and currently usable lessons.
- `POST /api/commands`: allowlisted simulation commands. Requires the exact loopback UI origin, JSON and `X-Prime-Directive: local-ui`. The command body cannot choose a workspace or reviewer identity.

The server binds to 127.0.0.1 and rejects production mode. Host/origin checks protect the local browser boundary; they are not production authentication. Do not expose this server through a tunnel or use it for real customer data. Production authentication and tenant isolation remain PD-003/004 and the release gates.

The event schema exposes bounded summaries and evidence references. It rejects additional fields such as raw reasoning. Eight concurrent event subscribers are allowed; slow readers disconnect and resume from persisted cursors. Events are not pruned in this reference. Local task graphs are bounded at 5,000 nodes and 32 levels; production scale validation is separate work.

## Validation

`npm run check` validates the canonical registry, typechecks and runs graph, persistence, name, experience and HTTP/SSE tests. Tests use isolated temporary or in-memory databases. They exercise restarts, cross-workspace rejection, concurrent assignment conflicts, source changes, revocation, request bounds, stream resumption and observed progress. Passing these checks is not a deployment or live-integration claim.
