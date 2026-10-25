# Local reference runtime

Use Node 24.22.1 and `npm ci`. `npm start` runs a loopback-only simulation API on `http://127.0.0.1:4317`; once the visual client is built it also serves `dist/`. `npm run dev:api` watches server sources. `PD_PORT` changes the local port and `PD_DATABASE` changes the SQLite path. Defaults persist under `.data/`, which is ignored by Git.

Run `npm run build && npm start` to open the visual workspace at that address. For development, run `npm run dev:api` and `npm run dev:web` in separate terminals; the client at `http://127.0.0.1:5173` proxies the local API. The map offers zoom, pan, branch collapse, search, both flow directions, task inspection, a workforce inspector, activity history and an accessible outline. `Step` advances one observed simulator action; `Run demo` advances it on a timer. Worker details offer pause/resume, individual stages and explicitly synthetic evaluation/lesson review.

Persistent workers also appear as separate robot nodes. An observed assignment moves the same node toward its task and draws an assignment connection. Hover or keyboard focus reveals the latest public activity summary; click opens the persistent profile. Collapsing a branch relocates its workers to the visible ancestor while preserving the actual task identity. Collision avoidance stacks workers without overlapping work cards. Movement is a presentation of the last observed assignment, not an estimate of model progress or a private reasoning trace.

Orientation, collapsed branches, search, selected item, map/outline mode and motion preference are saved in this browser. Pan and zoom remain session controls so a stale viewport cannot hide the directive on reload. Invalid or oversized preferences fall back to the default view. The graph has a 5,000-node/32-level input bound and renders visible items; this is a local reference limit, not a verified production throughput promise. Reduced motion follows the operating system and can also be selected explicitly. A disconnected stream stops the automatic demo and worker travel; nodes show their last observed state. The canvas never asserts that real work is continuing after a disconnection.

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

`npm run check` validates the canonical registry, typechecks the server and browser, runs domain/integration tests, and builds the client. `npx playwright install chromium` installs the browser for `npm run test:e2e`; CI runs both checks. Browser tests use a separate loopback server and disposable database. They cover graph collapse/search, both views, worker control, reviewed memory, persistent identities after reload and narrow-screen inspection. Domain tests exercise database restarts, cross-workspace rejection, concurrent assignment conflicts, source changes, revocation, request bounds and stream resumption. Passing these checks is not a deployment or live-integration claim.
