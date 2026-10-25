# Verified local foundation

The initial repository foundation and nine feature/fix PRs are merged. Each PR passed its current-head `verify` workflow before merging. The canonical registry records those dated GitHub observations and the corresponding check URLs. This document describes the local reference implementation; none of these merges establishes production deployment or live integration.

## Delivered

| Capability | Evidence | Scope |
| --- | --- | --- |
| Ownership decisions, 92-unit plan, shared registry and CI | [PR 1](https://github.com/neophilism/Prime-Directive/pull/1) | Original 80 IDs preserved; 12 visual-workforce additions |
| Validated directive hierarchy, dependencies and projections | [PR 2](https://github.com/neophilism/Prime-Directive/pull/2) | Stable IDs, legal transitions, bounded depth, horizontal/vertical layouts |
| Persistent workers, assignments, runs and events | [PR 3](https://github.com/neophilism/Prime-Directive/pull/3) | SQLite transactions, restart recovery and assignment conflict rejection |
| Exact Boardroom catalog and availability adapter | [PR 4](https://github.com/neophilism/Prime-Directive/pull/4) | Partial integration: 601 catalog entries; unknown availability until authoritative inventory is connected |
| Reviewed experience and reusable memory | [PR 5](https://github.com/neophilism/Prime-Directive/pull/5) | Accepted/rejected outcomes, independent review, source versions, expiry and revocation |
| Local API, deterministic simulation and resumable activity | [PR 6](https://github.com/neophilism/Prime-Directive/pull/6) | Loopback request boundary, bounded subscribers and explicit public summaries |
| Visual canvas, task and worker inspectors | [PR 7](https://github.com/neophilism/Prime-Directive/pull/7) | Search, collapse, progress, evidence, outline, workforce and activity views |
| Moving worker nodes and saved accessible views | [PR 8](https://github.com/neophilism/Prime-Directive/pull/8) | Observed assignment travel, connections, hover/focus summaries, reduced motion and disconnected state |
| Recent activity recovery after long histories | [PR 9](https://github.com/neophilism/Prime-Directive/pull/9) | Bounded recent history at the snapshot cursor and coalesced refreshes |

The foundational commit is [`afdaef3`](https://github.com/neophilism/Prime-Directive/commit/afdaef3a3a175e1f17bbdbe6157261638984326d). PR counts and accepted work-unit counts are different measures: nine units have local reference acceptance, and four units have partial contributions. All 92 retain separate implementation, acceptance and deployment metadata.

## Validation

- `npm run check`: registry validation, server/browser typechecks, 30 domain/integration tests and the production client build.
- `npm run test:e2e`: five Chromium scenarios covering inspection, worker control, retained identity and reviewed memory, task movement, collapsed assignments, saved preferences, keyboard/mobile access, reduced motion and disconnection/recovery.
- Desktop and narrow-screen renderings inspected. The controlled graph retains measured node dimensions for the minimap.
- GitHub CI independently installed the pinned Playwright browser and passed on every merged implementation head. Local QA also passed on Chromium 141 through `PD_TEST_CHROMIUM` when the local CDN download failed.

These results demonstrate the reference behavior. They do not verify production multi-tenant isolation, unlimited concurrency, live provider reliability, or improvement in real task outcomes.

## Current operating boundary

Run `npm ci`, `npm run build`, and `npm start` with Node 24.22.1. Open `http://127.0.0.1:4317`. The workspace contains a fictional investment-readiness graph and three simulation workers. Their identities, assignments, reviewed results and memory persist across process restarts; presentation preferences persist in the browser. See [the local runtime guide](LOCAL_REFERENCE.md).

The fixture graph is supplied by code. Document upload, model-generated decomposition, live agent execution, communications and deployment are pending. The simulator completes leaf tasks but cannot verify that the external prime directive has been achieved. Summaries describe observed actions and evidence, not private reasoning.

Names remain generic because the authenticated Boardroom occupancy source and shared atomic reservation authority are not connected. The public catalog alone cannot establish availability. No Boardroom database or credential records were copied into this public repository.

The experience ledger retains reviewed evidence and filters memory for reuse. Integrating those memories into real model contexts and demonstrating specialty improvement through evaluated routing remain pending. Task counts alone confer neither expertise nor additional authority.

## Next dependency-ready work

1. **PD-003/004:** authenticated ownership, membership and production PostgreSQL tenant boundaries.
2. **PD-005/006/007:** private source storage, standing authority, stop contracts and audit foundation.
3. **PD-008 through PD-016:** complete synthetic providers, document ingestion, provenance, evidence/claim handling and context compilation.
4. **PD-017 through PD-024:** directive intake, outcome checks, strategy generation, decomposition, cost reservations and a shadow execution demonstration.
5. **PD-025 through PD-031:** durable orchestration, bounded model execution, leases, tool capabilities, idempotent action delivery and replanning.
6. **PD-083/084, in parallel when the shared service is available:** authenticated occupancy and atomic naming used by both Boardroom and Prime Directive.
7. **PD-086/090/092 and the original release gates:** evaluated specialty routing, historical plan replay and production acceptance with real authorized events.

The [canonical registry](../registry/prs.json) owns dependency and completion tracking. Contribution PRs remain contributions until the entire corresponding unit is accepted. This status snapshot records PRs 1–9; later GitHub state remains authoritative.
