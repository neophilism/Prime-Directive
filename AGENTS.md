# Prime Directive development

- Read `docs/ARCHITECTURE.md`, `docs/VISUAL_WORKFORCE.md`, and `docs/DEVELOPMENT_PLAN.md` before implementation.
- `registry/prs.json` is the single canonical plan. Use the shared Boardroom/Engine Room contract. Preserve legacy IDs through the explicit mapping. Never infer real PR numbers from work-unit ordinals.
- Keep planned, implemented, accepted, deployed, and live-verified states separate. Link partial work through `contributingPrs`; it must not complete a unit.
- Run `npm run check` and any relevant browser/integration tests. Review concrete authorization, persistence, concurrency, privacy, and injection risks. Independent human audit is follow-up work, not a prerequisite for ordinary implementation.
- Chain dependency-ready work. Do not request the owner as a reviewer. Respect actual branch rules; merge only with current-head passed required CI and clean mergeability. Missing, failed, skipped, or capacity-blocked CI is not success. Continue other eligible work when a PR is blocked.
- The repository is public. Never commit secrets, private Boardroom assignments, account emails, runtime databases, or real customer documents.
- Worker profiles are durable; model runs are temporary. Retain reviewed evidence and skill outcomes across runs. A display name is never an authentication credential.
- Reuse `registry/agent-names.json` exactly, including case and punctuation. Name availability requires current authoritative Boardroom occupancy and shared atomic reservation; do not guess unused names or activate a snapshot-only assignment.
- Live activity exposes actions, short decision summaries, evidence, uncertainty, and progress. Never store or expose raw private chain-of-thought. Do not animate fabricated work as real activity.
- No production deployment, paid provisioning, live outreach, or external message dispatch is authorized by a local simulator test.

