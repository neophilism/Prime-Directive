# Source-bound integration audit

Inspected on October 24, 2026 (America/New_York). This is a source-contract audit, not a claim that the remote services were tested live.

| Source | Verified fact | Implementation consequence |
| --- | --- | --- |
| Boardroom `registry/PR_FORMAT.md` and `registry/pr-contract.mjs` | Version 1 registry requires hyphenated stable IDs, explicit PR mappings, and distinct contribution evidence. | Original PD001..PD080 map one-to-one to PD-001..PD-080 with `legacyId`. Canonical plan is `registry/prs.json`. |
| Boardroom `registry/agent-names.json` | 601 unique exact names, including distinct case variants and Smith. | Copy exact catalog with provenance; do not normalize identities. |
| Boardroom `src/server/agent-registration.ts` | Active credentials are read from the private DB, and owner registration creates a credential. | Public source cannot tell which names are occupied; no credential creation to reserve a name. |
| Boardroom migrations 0013/0014 | Separate owner name reservations and logical-agent records exist. | Availability must include all occupancy types, not credentials alone. |
| Boardroom owner agents route | Listing requires owner authentication and includes private account data. | Future adapter returns minimal occupancy only; do not expose account metadata in this public repo. |
| Superintelligence Engine `contracts/openapi.json` | Existing project/artifact/run schemas and endpoints; project IDs and revisions are canonical. | `linkEngineProject` preserves engine identity and revision. No second project writer. |
| Superintelligence Command Center README | Uses version-pinned shared engine workspace/UI through a submodule and package link. | The visual directive module will integrate through a versioned adapter; do not copy or overwrite Command Center. |

## Canonical write ownership

Engine: projects, engine artifacts and provider runs. Prime Directive: directive hierarchy, strategies, task graph, persistent worker profiles, scoped experience and display projections. Shared portfolio name authority: live name claims. GitHub canonical registry: planned development scope and dated contribution mapping. Boardroom remains the software-development coordinator. No component gets write authority merely because it can render another component's data.

The initial `src/domain/ownership.ts` fixture verifies project identifier mapping and rejects duplicate writers. Production adapters, authenticated integration, PostgreSQL tenancy and coordinated name claiming remain future work. The local reference store is explicitly separate from production state.

## Source versions

- Boardroom inspected commit: `48adab7db6a7f68fcb5461f6d1bae734cb88aec0`.
- Name-catalog blob: `d336d39809e3571d3c6fa3f5c1f3d9542e81bceb`.
- Shared PR contract blob: `d06a9b2962c9f98cdd57078dfbc1aed4896759cd`.
- Engine OpenAPI blob: `33bd1f8747249504bb1e01045fab2d909d9a6b1d`.

Source links: [Boardroom](https://github.com/neophilism/Boardroom/tree/48adab7db6a7f68fcb5461f6d1bae734cb88aec0), [Engine contract](https://github.com/neophilism/Superintelligence-Engine/blob/main/contracts/openapi.json), [Command Center](https://github.com/neophilism/Superintelligence-Command-Center).

