# Contracts

**MCP:** `@modelcontextprotocol/sdk` 1.32.2 (v1 API), Streamable HTTP, stateless JSON responses, endpoint `POST http://127.0.0.1:8787/mcp`. Negotiated protocol observed: `2025-11-25`.
**Auth mode:** development service tokens (bearer `ixa_…`), stored in Convex only as SHA-256 hashes on `agentPrincipals` with org, scopes, expiry (7 days), revocation. Invalid tokens → HTTP 401 at the transport. Local endpoint only (`127.0.0.1:8787`).

**Remote endpoint (HTTPS):** `https://quirky-robin-694.convex.site/mcp` (Convex HTTP action, same nine tools from `mcp/tools.mjs`, stateless JSON). OAuth 2.1 **client_credentials** (agent-to-agent; no end-user authorization-code flow): discovery at `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414); token endpoint `POST /oauth/token` (`client_id` = principal name, `client_secret` = operator-issued `ixa_…` credential, `resource` must equal the MCP URL per RFC 8707, optional narrower `scope`). Access tokens `ixat_…`: 15 min, audience-bound, hash-only storage, inherit revocation. Unauthenticated → 401 with `WWW-Authenticate: Bearer resource_metadata=…`. The long-lived `ixa_` secret is not accepted as a bearer token remotely.
**Service boundary:** only the MCP service (holding `MCP_SERVICE_SECRET`) can call `convex/mcp.ts`; agents never get Convex keys. Org authority always comes from the token; tool schemas reject unknown fields (no `orgId` input).

## Tools (all return text summary + `structuredContent` envelope `{schemaVersion:"1", requestId, status, data|error, provenance:{mode, sourceIds}}`; failures set MCP `isError`)
| Tool | Scope | Notes |
| --- | --- | --- |
| `get_exchange_capabilities` | (service) | schema, tools, payment network/mode, limits, integration health |
| `search_resolutions` | search | `{symptoms ≥8 chars, environment[]}` → ≤5 previews: matched/conflicting clues, missing checks, evidence scope, price; `NO_RELEVANT_MATCH` if none |
| `get_resolution_preview` | preview | free fields only |
| `quote_resolution` | quote | quote bound to principal, revision, revision content hash, price (atomic, 6 decimals), network `eip155:84532`, payee, 10-min expiry |
| `acquire_resolution` | acquire | `{quoteId, clientRequestId, approved:{payTo,maxAmountAtomic,network,asset?}, paymentMode}`; rejects term mismatch; an existing live purchase of the same revision is returned (no second charge); `simulator` only if the operator policy has `allowSimulator`, and x402 unavailability returns `PROVIDER_UNAVAILABLE` (never a silent simulator); spend policy with reservation (pending+settled); idempotent per `clientRequestId`; then x402 payment via server-held signer (`x402Node.agentPay`) against the fixed `POST {CONVEX_SITE_URL}/x402/purchases/<id>` endpoint, or explicit simulator |
| `get_resolution` | retrieve | exact purchased revision, labeled `untrusted_external_content` |
| `submit_resolution` | submit | bundle fields per spec §7; server recomputes `contentHash` (canonical JSON, SHA-256, `shared/bundle.mjs`); approval must reference that hash; server secret scan; injection heuristics → quarantine |
| `get_submission_status` | status | owner only; status, moderation, reviewer note, accrual (not paid out) |
| `record_outcome` | outcome | entitled buyers only; `runner_verified` only if `evidenceRunId` is a matching protected-runner record, else `reported_unverified` |

Error codes: `AUTH_REQUIRED, FORBIDDEN, INVALID_INPUT, SENSITIVE_CONTENT_DETECTED, APPROVAL_REQUIRED, REVISION_CHANGED, NOT_FOUND_OR_FORBIDDEN, NO_RELEVANT_MATCH, QUOTE_EXPIRED, BUDGET_EXCEEDED, PAYMENT_PENDING, PAYMENT_FAILED, ENTITLEMENT_REQUIRED, RATE_LIMITED, PROVIDER_UNAVAILABLE`.

## State (Convex, `quirky-robin-694` dev)
`agentPrincipals`, `quotes`, `purchases` (+`principalId`, `quoteId`, `clientRequestId`), `playbookRevisions` (immutable paid revision), `incidentDrafts.agentSubmission` (bundle hash, moderation, consent), `repairRuns` (protected runner baseline/candidate, diff, suite hash), `agentOutcomes`, `agentEvents` (redacted), `jobs` + `meta.generation` (stale-callback guard). Money: integer atomic strings; 80/20 accrual derived per purchase (no payouts).

## Revision rules
Contributor approval = bundle hash; on submit the server stores contributor approval of the derived draft hash; reviewer approves that exact revision; with `publicationConsent` the approval publishes it. Quarantined submissions cannot be approved. Purchases bind the revision; retrieval returns that revision.

## Local connector (`connector/`)
Pinned policy `connector/policy.local.json` (endpoint, network, payee, budget, repos, editable paths, named task). Disclosure gate drops credential-format lines and generalizes identifiers before any network call. Candidate policy: canonical paths, no symlinks, no added/removed files, writes only to the editable allowlist, denied classes (.env, .git, tests, package files, CI). Only named task: `sample-repos/run-protected-tests.mjs` (fixed argv, 30 s timeout).
