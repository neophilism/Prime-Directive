# Development plan — visual workforce revision

The canonical plan is [`registry/prs.json`](../registry/prs.json). It contains the original 80 work units plus 12 visual-workforce additions: **92 units total**. The table below is documentation of that registry, not a second machine-readable plan. Original IDs are mapped explicitly from PD001 to PD-001 through PD080 to PD-080 to meet the inspected portfolio contract.

## Delivery order

1. Establish source-bound ownership contracts, the shared registry, and CI (PD-001/002).
2. Build the graph model, persistent worker/run separation, Boardroom name adapter, and experience ledger (PD-081/082/083/085).
3. Deliver the visual canvas, moving workers, safe activity stream, and saved accessible workspace (PD-087/088/089/091). A labeled local simulator validates the experience before enabling models or external actions.
4. Continue the original knowledge, planning, authorization, execution and communications phases. Integrate production auth and PostgreSQL rather than exposing the local reference server.
5. Complete shared atomic naming, evaluated skill routing, historical replay and production acceptance (PD-084/086/090/092), then release under the original deployment and operational gates.

## Persistent workers

Workers keep identity and reviewed experience when tasks or provider runs end. Reusable memory has evidence, reviewer, scope, expiry and revocation. Performance is measured by specialty; more tasks alone do not prove improvement. No claim of autonomous model-weight training is made.

## Estimate update

The original 66–105 engineering-week estimate remains the baseline for its original scope. The visual workforce adds a preliminary 14–24 engineering weeks, for a revised total of 80–129 engineering weeks, with overlap possible across teams. Treat this as an estimate to replace with measured delivery and pilot results, not a delivery promise. The local visual reference is intentionally available earlier than the full production system.

## Work units

| ID | Title | Dependencies |
| --- | --- | --- |
| PD-001 | Canonical ownership and architecture decisions | None |
| PD-002 | Repository foundation and work registry | PD-001 |
| PD-003 | Identity membership and administrative access | PD-002 |
| PD-004 | Transactional tenant isolation | PD-003 |
| PD-005 | Private objects and source access | PD-003, PD-004 |
| PD-006 | Authority policy and stop contracts | PD-003, PD-004 |
| PD-007 | Audit and redacted telemetry foundation | PD-004, PD-006 |
| PD-008 | Synthetic providers and evaluation harness | PD-002, PD-007 |
| PD-009 | Document intake and provenance | PD-005, PD-008 |
| PD-010 | Isolated parsing and OCR | PD-009 |
| PD-011 | Source authority and classification | PD-009, PD-010, PD-006 |
| PD-012 | Claim evidence and conflict register | PD-010, PD-011 |
| PD-013 | Hybrid retrieval and reranking | PD-011, PD-012 |
| PD-014 | Context compilation and immutable snapshots | PD-012, PD-013 |
| PD-015 | Source change invalidation | PD-012, PD-014 |
| PD-016 | Knowledge quality and injection suite | PD-010, PD-013, PD-014, PD-015, PD-008 |
| PD-017 | Prime directive intake and standing settings | PD-006, PD-014, PD-016 |
| PD-018 | Outcome definitions and verification | PD-017, PD-012 |
| PD-019 | Domain and action catalogs | PD-017, PD-006 |
| PD-020 | Candidate strategies and assumptions | PD-018, PD-019, PD-014 |
| PD-021 | Subdirective and microtask graph | PD-020 |
| PD-022 | Cost estimation and atomic reservations | PD-021, PD-004 |
| PD-023 | Plan visibility and delegated activation | PD-021, PD-022, PD-006 |
| PD-024 | Shadow directive demonstration | PD-016, PD-018, PD-019, PD-020, PD-021, PD-022, PD-023, PD-008 |
| PD-025 | Durable coordinator and workflow adapter | PD-024, PD-001 |
| PD-026 | Bounded model worker runtime | PD-025, PD-014, PD-022 |
| PD-027 | Fair scheduling leases and fencing | PD-025, PD-026, PD-022 |
| PD-028 | Capability tool gateway | PD-026, PD-006, PD-007 |
| PD-029 | Action ledger outbox and reconciliation | PD-028, PD-022, PD-004 |
| PD-030 | Final authorization and revocation | PD-029, PD-015, PD-006 |
| PD-031 | Automatic replanning and result reconciliation | PD-025, PD-021, PD-023, PD-030 |
| PD-032 | Execution failure and recovery gate | PD-025, PD-026, PD-027, PD-028, PD-029, PD-030, PD-031, PD-008 |
| PD-033 | Organizations contacts and reversible identity | PD-011, PD-004, PD-032 |
| PD-034 | Commercial relevance discovery | PD-033, PD-013, PD-019 |
| PD-035 | Contact permissions and suppression | PD-033, PD-006 |
| PD-036 | First mailbox read and draft adapter | PD-028, PD-035 |
| PD-037 | Authorized email dispatch | PD-029, PD-030, PD-035, PD-036 |
| PD-038 | Replies followups and human handoff | PD-037 |
| PD-039 | Calendar and promise tracking | PD-038, PD-028 |
| PD-040 | Sender health and channel operations | PD-037, PD-038, PD-007 |
| PD-041 | Evidence grounded writing and review | PD-012, PD-014, PD-015, PD-028 |
| PD-042 | Document deck and asset adapters | PD-041, PD-005 |
| PD-043 | Website previews and controlled publication | PD-041, PD-028, PD-030 |
| PD-044 | Artifact approval and correction propagation | PD-041, PD-042, PD-043, PD-015 |
| PD-045 | Prime directive dashboard and decision inbox | PD-023, PD-031, PD-038, PD-039, PD-040, PD-044, PD-087, PD-089 |
| PD-046 | Commercial end to end acceptance | PD-034, PD-035, PD-037, PD-038, PD-039, PD-044, PD-045, PD-008 |
| PD-047 | Private alpha security review | PD-016, PD-032, PD-040, PD-043, PD-045, PD-046 |
| PD-048 | Controlled private alpha release | PD-046, PD-047 |
| PD-049 | Investment preparation and diligence workflow | PD-048 |
| PD-050 | Official civic procedure and status monitoring | PD-048, PD-019, PD-018 |
| PD-051 | Public explanations and voluntary coalition tools | PD-050, PD-043, PD-044, PD-035 |
| PD-052 | Public communications and media workflow | PD-048, PD-041, PD-034 |
| PD-053 | Locales and jurisdiction configuration | PD-035, PD-039, PD-051 |
| PD-054 | Multimedia production and rights | PD-042, PD-044, PD-052 |
| PD-055 | Bounded commercial advertising adapter | PD-053, PD-054, PD-022, PD-030 |
| PD-056 | Domain workflow acceptance gate | PD-049, PD-050, PD-051, PD-052, PD-053, PD-054, PD-055 |
| PD-057 | Outcome evidence ingestion | PD-056, PD-018, PD-038 |
| PD-058 | Commercial experiments and uncertainty | PD-057, PD-020 |
| PD-059 | Evidence driven strategy revision | PD-057, PD-058, PD-031 |
| PD-060 | Evaluated model routing and fallback | PD-026, PD-016, PD-056 |
| PD-061 | Cost ledger and owner controls | PD-022, PD-057, PD-060 |
| PD-062 | Operational traces and incident views | PD-007, PD-057, PD-061 |
| PD-063 | Evaluation regression and release controls | PD-016, PD-047, PD-056, PD-059, PD-060, PD-062 |
| PD-064 | Adaptive beta and usability gate | PD-059, PD-061, PD-062, PD-063 |
| PD-065 | Tenant fairness and capacity scaling | PD-064, PD-027 |
| PD-066 | Workflow history and deployment compatibility | PD-065, PD-025 |
| PD-067 | Search graph and database performance | PD-065, PD-013, PD-033 |
| PD-068 | Disaster recovery and restore rehearsal | PD-066, PD-067, PD-048 |
| PD-069 | Retention access and deletion lifecycle | PD-068, PD-035, PD-005 |
| PD-070 | Regional eligibility and deployment boundaries | PD-053, PD-068, PD-069 |
| PD-071 | Connector SDK and extension sandbox | PD-028, PD-040, PD-066, PD-070 |
| PD-072 | Portfolio scale and chaos gate | PD-065, PD-066, PD-067, PD-068, PD-069, PD-070, PD-071 |
| PD-073 | Superintelligence Engine production integration | PD-001, PD-072 |
| PD-074 | Command Center product integration | PD-073, PD-045 |
| PD-075 | Boardroom development coordination | PD-002, PD-073 |
| PD-076 | Engine Room live portfolio reporting | PD-002, PD-075 |
| PD-077 | Portable export import and migration | PD-069, PD-073, PD-074 |
| PD-078 | Pilot evidence and operating playbooks | PD-064, PD-072, PD-074, PD-076, PD-077 |
| PD-079 | Release and supply chain assurance | PD-078, PD-063 |
| PD-080 | General availability and measured expansion | PD-079 |
| PD-081 | Visual graph domain and projection | PD-002 |
| PD-082 | Persistent worker identity and run lifecycle | PD-081 |
| PD-083 | Boardroom name catalog and availability adapter | PD-002 |
| PD-084 | Shared atomic name reservation integration | PD-082, PD-083 |
| PD-085 | Reviewed experience and reusable worker memory | PD-082 |
| PD-086 | Experience-aware assignment and skill evaluation | PD-085, PD-027 |
| PD-087 | Interactive directive canvas and inspectors | PD-081 |
| PD-088 | Animated worker movement and task attachment | PD-082, PD-087 |
| PD-089 | Safe live activity and resumable event projection | PD-082, PD-081 |
| PD-090 | Historical graph replay and plan comparison | PD-089, PD-031 |
| PD-091 | Saved visual workspace and accessible navigation | PD-087, PD-088 |
| PD-092 | Visual workforce production acceptance | PD-084, PD-085, PD-086, PD-088, PD-089, PD-090, PD-091, PD-045, PD-047 |

Every unit retains scope, acceptance criteria, a negative test and separate implementation/acceptance/deployment states in the registry. PR count is not a measure of completed capabilities. Real PR links are added only after GitHub creates them.
