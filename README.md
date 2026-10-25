# The Prime Directive

A visual workspace for turning a prime directive and supporting documents into a managed hierarchy of subdirectives, tasks, and verified outcomes.

The primary interface is an interactive directive graph. Persistent, named AI workers move between tasks, retain reviewed experience, and expose concise activity summaries, evidence, and uncertainty. A worker's identity persists independently of any one model call or execution process.

## Repository status

A runnable local visual workspace with a validated directive graph, persistent worker identities, an experience ledger and a replayable activity stream. Implementation is delivered through tested pull requests. Planned capabilities are not deployed capabilities.

The initial implementation targets a local visual workspace with synthetic work, graph validation, persistent worker records, and observable task execution. Live model execution, external outreach, production authentication, and cross-application name reservations are separate capabilities and remain disabled until implemented and verified.

## Architecture commitments

- The owner supplies the prime directive; the system manages its decomposition and routine execution within standing authority.
- Every task connects to the directive, input evidence, resource limits, and a completion check.
- Worker identity, execution runs, reviewed memory, and measured skill are separate records.
- Boardroom's exact approved name catalog is reused. A catalog entry alone never proves that a name is available or authenticates a worker.
- Animated activity represents observed events. It does not imply access to private model reasoning or invent progress.
- Completion of tasks and achievement of the external objective are verified separately.
- Development work is tracked in a single canonical registry compatible with Boardroom and Engine Room.

## Development

Use Node 24.22.1:

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4317`. The fictional investment-readiness workspace persists locally between restarts. `Step` or `Run demo` shows observed simulation progress. No paid services or production deployment are required.

Run `npm run check` and `npm run test:e2e` (install Chromium first with `npx playwright install chromium`). See [the local runtime guide](docs/LOCAL_REFERENCE.md), [architecture](docs/ARCHITECTURE.md), [visual workforce design](docs/VISUAL_WORKFORCE.md), and [development plan](docs/DEVELOPMENT_PLAN.md). The canonical work registry is [registry/prs.json](registry/prs.json).
