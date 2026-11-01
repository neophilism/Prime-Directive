# Identity and membership boundary (PD-003)

The loopback reference now supports authenticated API mode with durable membership,
revocable sessions, delegated scopes and recent MFA checks. This is implementation
evidence, not a production deployment or a live identity-provider acceptance claim.
The unconfigured visual demo remains explicitly synthetic and single-owner.

## Trusted configuration and startup

Set `PD_ACCESS_CONFIG` to an operator-owned JSON file with `issuer` (exact HTTPS
broker issuer), `audience`, `keys` (key ID to public RSA PEM), `ownerSubject`, and
`workspaceId`. Use `local-demo` for the existing synthetic workspace. Only public
verification keys belong here. Keep actual identity/account values and runtime
databases outside this public repository. First startup provisions the owner;
subsequent startup never overwrites ownership, even if configuration changes.

`npm start` loads this configuration before accepting requests. Invalid or missing
keys fail startup. Without this environment setting the existing local simulator
is unchanged. Both modes still refuse production startup and bind only to loopback.
Do not expose this reference server as a multi-tenant production service. PD-004
owns PostgreSQL transactional tenant isolation and production deployment remains
a later gate. The existing simulator UI is not a hosted login portal; authenticated
mode is currently an API integration surface for a separately configured broker.

## Verified assertion contract

`SignedIdentityVerifier` accepts only dedicated `pd-session+jwt` tokens signed with
RS256 by an operator-pinned RSA public key of at least 2048 bits. It performs no
discovery or key-URL fetch. It requires exact `iss`, single-string `aud`,
`purpose: session-exchange`, `sub`, unique 16–128 character base64url `jti`, and integer
`iat`, `exp`, `auth_time` timestamps in seconds. Token lifetime and authentication
age are at most five minutes; future issuance, future `nbf` and expired tokens fail.
Only the broker's signed `amr: [mfa]` marks MFA; the trusted broker must guarantee MFA
was performed at `auth_time`. The configured principal kind, not a JWT role/kind
claim, distinguishes humans and connectors. JWT role/workspace claims grant nothing.

This is an application-specific broker assertion, **not** a general OIDC ID-token
validator or an OAuth authorization-code flow. A real broker must verify its
provider's signature, issuer, audience, nonce/state, PKCE, authentication freshness
and MFA semantics before minting this distinct assertion. No live broker account,
provider availability, hosted login UI or production MFA enrollment was exercised.
Key rotation replaces the configured key map; removing a key prevents new exchanges.
Existing opaque sessions require explicit revocation or membership revision changes.

The verifier consumes assertion IDs durably so replay fails across restarts and
processes. Provider errors or malformed assertions create no session and do not
fall back to another identity. Store sessions contain only SHA-256 token digests,
membership revisions, authentication metadata and expiry; tokens and assertions
are never persisted. Session tokens have 256 random bits and expire within eight
hours or the delegated membership expiry, whichever is sooner.

## API and permissions

Every mutation requires the existing exact loopback Origin and `x-prime-directive:
local-ui` header. Authenticated API requests use `Authorization: Bearer <session>`.
Tokens never appear in query strings, events or activity records. A failed login
returns a generic authentication error without provider details.

- `POST /api/session`: bearer is the signed broker assertion; JSON contains only
  `workspaceId`. The response returns the opaque session token and expiry.
- `DELETE /api/session`: revoke the bearer session. Unknown tokens are idempotent;
  no operation grants membership or renews authority.
- `GET /api/memberships`: owners with MFA from the last five minutes list the
  current workspace's principal IDs, roles, revisions and delegation metadata.
- `POST /api/memberships`: the same authority creates, changes or revokes a member.
  Required fields: `principalId`, `role`, `kind`, `expectedRevision`, `active`.
  Optional fields: `scopes`, `expiresAt` (milliseconds), `delegated`. New memberships
  use revision zero; conflicts return 409. Principal IDs are SHA-256 of the exact
  JSON issuer/subject tuple, not names or emails.

| Role | Allowed scopes |
| --- | --- |
| owner | workspace.read, work.write, experience.review, membership.admin, mandate.issue |
| collaborator | workspace.read, work.write |
| observer | workspace.read |
| connector | connector.execute |

Connector authority never implies interactive workspace reads or human
administration. Connector execution itself belongs to later gateway units; this
unit implements its distinct authorization boundary. Mandate issuance likewise
uses the tested `mandate.issue` boundary; PD-006 implements the actual mandate domain.

Scopes can only narrow a role. Owners cannot narrow their administrator scopes or
remove the last persistent owner. Delegation cannot grant ownership, must expire
within eight hours, and remains dependent on the granting owner's current revision.
Owner changes or revocation therefore invalidate its delegated memberships.

Every protected request reads current membership; membership changes invalidate
old sessions permanently, including after a member is later reactivated. Commands
recheck after asynchronous body parsing. Event streams check current authority on
every server pump and close on revocation before sending more events. Authentication
selects the workspace; request parameters cannot substitute another workspace.
These checks do not claim PostgreSQL transaction-level authorization fencing for
future external actions or complete tenant isolation across every storage family.

## Evidence and operating limits

`npm run check` includes role matrix, stale-session mandate denial, delegation,
MFA age, expiry, logout, last-owner protection, revision conflicts, restart and
second-connection revocation, signed-assertion substitution/replay, API integration
and stream revocation tests. Existing UI browser tests continue to exercise the
explicit unconfigured simulator. Tests use synthetic identities and generated keys.

Before any hosted release: configure and live-test the trusted identity broker,
TLS and proxy origin handling; deliver the login and step-up UX; implement PD-004's
production storage isolation; and evaluate rate limiting, session inventory and
operational key/account recovery. None of these deployment claims follows from
passing local fixtures.

Design references: [JWT Best Current Practices, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html)
and [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html).
The narrow token type prevents an ordinary ID/access token from being accepted
under this application's assertion rules.
