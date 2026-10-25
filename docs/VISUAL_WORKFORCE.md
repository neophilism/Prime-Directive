# Visual directive workspace and persistent workforce

This revision makes the graph the primary interface. It supersedes the list-first interaction in specification 1.0. The user provides a prime directive and documents; the system constructs and maintains the work hierarchy. People navigate and inspect that hierarchy rather than manage model conversations.

This document specifies the complete intended interaction. The [verified implementation status](IMPLEMENTATION_STATUS.md) distinguishes the delivered local canvas, workers and memory from pending live planning, naming and provider integrations.

## Canvas

The prime directive appears at the left in horizontal mode or at the top in vertical mode. Its subdirectives branch into tasks and subtasks. Solid hierarchy edges explain why work exists; dashed dependency edges explain execution order; colored worker tethers show current assignment. The backend stores these as distinct relationships. A dependency must not be inferred from visual proximity.

Cards show title, type, observed status, completion count, blockers and evidence availability. A completion count is task progress, not an invented probability of achieving the prime directive. The root has a separate outcome-evidence state. Pan, zoom, fit-to-view, orientation switching, search, filters, collapse and a minimap support navigation. Large graphs use visible-subtree projection, stable positions, level-of-detail rendering and explicit capacity targets.

Clicking or keyboard-selecting a card opens an inspector: purpose, parent, dependencies, acceptance criteria, evidence, current assignment, runs, costs and history. An accessible tree provides equivalent navigation. Layout is presentation state; dragging a node never changes its authority, parent or task status. Changing the work graph is a separate validated command with a revision precondition.

## Workers as moving nodes

A worker is a separate selectable node with a stable ID, approved display name when reserved, specialty and state. Idle workers gather in a workforce area. An assignment event moves that worker toward the task; a tether indicates active work. A release event moves it away. Movement interpolates between observed states and never drives the scheduler. There are no decorative fake progress loops represented as real execution.

Hover or keyboard focus opens a compact activity card. Selection opens the durable worker profile. It shows current task, current stage, last observed event, source references, uncertainty and a short decision summary. The full activity drawer keeps recent events and their timestamps. Waiting, disconnected, unknown and historical states are explicit. Reduced-motion settings eliminate travel while preserving position and attachment. A global motion control supplements the operating-system preference.

Multiple workers can eventually cooperate on a task; the initial reference runtime uses one active worker per task for a simpler, tested assignment contract. Dense groups become selectable clusters. A collapsed subtree shows the number of workers inside it; it must not pretend those workers are executing the collapsed parent. Worker nodes remain linked to the real task identity.

## Public activity contract

The UI streams structured status events, not raw model reasoning. Allowed fields are event ID, workspace ID, worker ID, task/run IDs, event kind, timestamp, short activity summary, current stage, evidence references and explicitly stated uncertainty. Adapters produce this public summary deliberately, with length bounds and data classification. Never expose raw prompts, private chain-of-thought, hidden reasoning tokens, credentials, unrestricted tool output or another workspace's data.

Examples: “Comparing the published investment focus with the company brief”; “Found conflicting dates in two source versions”; “Draft completed; checking its cited figures.” A summary is an explanation of observable work, not a claim to be a verbatim view into an AI mind. Synthetic demonstrations are labeled throughout and cannot silently switch to real providers.

Snapshots and ordered events share a cursor. On reconnect, the client resumes after its last accepted cursor, deduplicates repeated events and refuses revision regressions. A retention gap requires a fresh snapshot. Slow subscribers are disconnected and recover from the durable event log; they do not create unbounded server buffers. Animation stops inferring current activity when the stream is stale.

## Persistence model

| Record | Lifetime | Important relationships |
| --- | --- | --- |
| Worker profile | Across directives and runs within permitted scope | Stable UUID, name claim, specialties, lifecycle state |
| Name claim | Until explicit retirement/release | Portfolio authority, exact catalog entry, owner scope, claim version |
| Assignment | A bounded task engagement | Worker, task, lease/fencing generation, plan revision |
| Execution run | One attempt | Worker, assignment, provider/model version, context manifest |
| Experience event | Audited outcome history | Worker, specialty, task/run, evaluation, evidence, reviewer |
| Reviewed memory | Until expiry, deletion or revocation | Source versions, permitted workspace/directive scope, review status |
| Visual preferences | Per user and workspace | Orientation, viewport, collapse, motion and filters |

The first runnable backend is a loopback-only, single-owner SQLite reference implementation so persistence and crash/restart behavior can be tested without paid infrastructure. It is not the production multi-tenant API. Production keeps the PostgreSQL architecture and requires authentication, tenant isolation and durable orchestration before exposure. Domain interfaces remain storage-independent; temporary model processes never own durable identity.

## Experience and improvement

Record reviewed outcomes separately from generated drafts and activity volume. Each specialty tracks accepted and rejected evaluations, evidence freshness, applicable model/tool versions and uncertainty. A verified task result can produce a candidate lesson, but it becomes reusable memory only after review. Revoked, expired or source-invalidated lessons stop entering context. A failure remains useful evidence and cannot be erased by a worker to inflate its score.

Future assignment uses demonstrated fit, available capacity and current permissions. It includes cold-start opportunities so a new worker is not permanently excluded. Experience does not widen authority, imply human-like understanding, or automatically modify model weights. Improvement must be measured against held-out tasks and the previous routing policy. Model upgrades invalidate incompatible skill claims. Cross-workspace learning requires deliberate, authorized reuse; private documents never become shared skill data by default.

## Boardroom naming

The inspected catalog contains 601 exact labels. Catalog size is discovered, never hard-coded as 600. Active Boardroom credentials, owner reservations and logical-agent names must all be considered occupied, together with this platform's claims. Retired names need an explicit release policy; absence from an active-credential list alone is insufficient.

A fresh complete inventory supports availability display, but cannot by itself prevent a race between applications. Both applications must use a shared, atomic name authority before live activation. Its operations are reserve, bind, inspect and release, each idempotent, scoped and audited. On conflict or unavailable authority, the worker remains unnamed/inactive and the UI explains the state. No automatic credential issuance in Boardroom is used to squat on a name.

The first adapter and tests use synthetic authoritative inventory. Production occupancy and name claims are private runtime data and are not committed here. This repository does not yet modify Boardroom's registration flow. PD-084 explicitly tracks that cross-application integration. A finite shared catalog means a finite number of uniquely named workers; many task runs can reuse persistent identities over time without inventing extra catalog names.

## Release evidence

Required checks cover graph cycles and revision conflicts; two claims on the same task or worker; restart persistence; duplicate evaluation receipts; stale/revoked memory; catalog collisions and incomplete inventory; stream replay and slow consumers; keyboard navigation; both orientations; collapse; reduced motion; and responsive layout. The visual production gate additionally requires real authenticated runtime events and simultaneous name-claim tests against both applications.

