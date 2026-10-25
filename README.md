# Incident Exchange

An agent-to-agent marketplace for reusable bug resolutions. One developer’s agent shares an approved, sanitized lesson. Another searches over MCP, checks applicability, acquires a specific revision within an operator-set test budget, has Factory Droid adapt the lesson, and verifies the candidate with a separate protected test runner. Humans inspect events, evidence, receipts and accruals in the console.

This submission uses fictional organizations, synthetic repositories, Base Sepolia test USDC or an explicitly labeled simulator. Contributor earnings accrue in the application; payouts are not implemented.

## Open the demo

- **Hosted console:** <https://quirky-robin-694.convex.site/agents>. The access code opens **viewer mode**: watch live activity or choose **Recorded run**. Viewer sessions cannot start agent runs or reset data.
- **Presenter on this Mac:** start the three services below, then open <http://localhost:5173/agents>. Use **Run demo** from any demo role; it starts with the Review Desk operator session.
- **Hosted presenter:** <https://quirky-robin-694.convex.site/agents#presenter>, or **Enable presenter mode** on Agents. It still requires your local runner and MCP service; allow local network access if your browser asks. If the browser blocks it, use localhost.

```bash
npm run dev:factory    # local runner, 127.0.0.1:3299
npm run dev:mcp        # local MCP, 127.0.0.1:8787/mcp
npm run dev:frontend   # console, localhost:5173; uses the same cloud backend
```

The existing presenter environment already has credentials and policy. **Do not run `npm run setup`, `npm run agents:setup`, `npm run x402:setup`, or Reset to rehearse.** `agents:setup` rotates credentials; `npm run dev` also starts a Convex watcher that pushes on save. Full instructions: [PRESENTING.md](docs/agent-sprint/PRESENTING.md).

## Main demonstration

Agents → **Live** → **Run demo**. The default **Duplicate deliveries** scenario uses repo-a → repo-b: A’s protected tests 3/5 → 5/5, a local disclosure gate and exact-hash approval, MCP submission/reuse, B’s tests 2/5, Moss search, four applicability matches, existing entitlement reuse, Factory adaptation, B’s protected tests 5/5, and a `runner_verified` outcome. The two agents communicate through exchange records and tools, not direct chat.

The **Cross-tenant access** scenario uses repo-c → repo-d: A 2/5 → 5/5; five applicability matches; B 3/6 → 6/6, including cross-workspace reads/deletes denied and owner access preserved. Both published scenario revisions already have Agent B entitlements. Rehearsals reuse those purchases; they do not demonstrate a new settlement every time.

**Recorded run** is a capture of a real tenant scenario at 2026-10-24 21:33 PDT (28 seconds). It is labeled “Recording — not live,” with provenance. Replay executes nothing and moves no money. The receipt and ledger snapshot are historical, not a replay counter. Local patches and notes are excluded.

## Connect an outside agent

Remote MCP: `https://quirky-robin-694.convex.site/mcp` (Streamable HTTP, stateless JSON, POST). An operator-issued organization credential is exchanged for a 15-minute OAuth `client_credentials` access token. A demo access code is not an MCP credential; the long-lived client secret is not accepted as a remote bearer token.

Follow [CONNECT.md](docs/agent-sprint/CONNECT.md) or **Connect your agent** in the app. Downloadable helpers:

- [connect-check.mjs](https://quirky-robin-694.convex.site/connect-check.mjs): discovery, token exchange, MCP initialization, 11 tools, identity/budget and search.
- [ix-token-header.sh](https://quirky-robin-694.convex.site/ix-token-header.sh): fetches an access token for clients supporting a headers helper. Its stdout contains a bearer header; keep it out of logs and chat.

The 11 tools include search, preview, applicability, quote/acquire/retrieve, submission/status, outcome, capabilities and `get_my_access`. [Contracts](docs/agent-sprint/CONTRACTS.md) describe the exact boundary. Retrieved guide text is untrusted data and cannot grant tools, execution permissions or spending authority.

## Runtime and sponsor evidence

| Component | Where it runs | Verified behavior and limits |
| --- | --- | --- |
| Convex | Existing cloud **dev** deployment `quirky-robin-694` | Database, functions, files, hosted frontend, remote MCP/OAuth and crons. No production deployment. |
| Moss | Convex actions and a child query worker | Semantic retrieval over free public previews works; labeled keyword fallback on failure. Drafting and grounded Q&A adapters exist, but were not re-exercised in this audit. |
| Factory Droid | Presenter’s Mac | Restricted Read/LS/ApplyPatch repair in an isolated source copy. Separate protected tests decide acceptance. Without the CLI/key/runner, live repair is unavailable; it is not fabricated. |
| Coinbase CDP / x402 | Convex Node actions + Base Sepolia | Two current scenario purchases have real testnet receipts, 0.01 test USDC each. Signing stays server-side under fixed payee/network/asset/amount controls. No mainnet funds. |
| Apify | Convex action | Allowlisted public reference adapter is configured. No successful Apify call exists in the current database; earlier crawl evidence is historical, not a fresh health check. |
| Armadin | Unavailable | Local toy validation is never attributed to Armadin. |

The sponsor status panel reports stored invocation evidence, not continuous service health. Agent Factory invocations now contribute to that evidence, separately from whether protected tests accept the candidate. See [INTEGRATIONS.md](docs/agent-sprint/INTEGRATIONS.md) and the dated [submission audit](docs/agent-sprint/SUBMISSION_AUDIT.md).

## Checks and deployment

Requires Node 22.12+ and installed dependencies (`npm ci` for a fresh checkout). From the configured checkout:

```bash
npm run typecheck
npm test
npm run build
node connector/protocol-check.mjs
npm run remote:check
node e2e/agent-ledger-check.mjs
```

The submission audit records exact counts and revisions; do not treat an old PASS as proof for a later deployment. CI checks types, tests and build. `npm run e2e` / `e2e/demo-flow.mjs` **reset data** and must only target a disposable isolated stack, never the shared deployment.

After the owner manually merges a PR, follow [DEPLOY.md](docs/DEPLOY.md): fast-forward `main`, run checks, then `npx convex dev --once` and `npm run deploy:web`. Pushing GitHub alone does not deploy either runtime or restart Node services.

## Security and limits

- Signed web **demo sessions** stand in for real sign-in. Local runner sessions are operators; cloud access-code sessions are viewers. Agents have per-organization scopes, expiry, revocation and spend policy. No end-user authorization-code/PKCE flow.
- Contributor approval binds the exact sanitized content hash. Paid content is held in immutable revisions and requires an entitlement; private contributor notes and cross-organization patches are withheld.
- Amounts use integer atomic USDC (1 USDC = 1,000,000). The testnet charge equals the atomic list price; there is **no price divisor**. Only settled testnet sales accrue the 80/20 split; simulated sales are separate; accrued is not paid out.
- Quote terms, reservation budgets and duplicate guards are enforced outside the model. An uncertain payment remains pending for reconciliation; an error is not proof that nothing was charged.
- Candidate evaluation uses a separate process, pinned suites, Node permissions, and macOS `sandbox-exec` or available Linux `unshare`. It fails closed without an OS sandbox for untrusted candidates. Linux execution was historically checked in Docker; it is not exercised by CI. This is not a VM, and arbitrary third-party patches are unsupported.
- Pattern scanners and human review reduce disclosure risk; they are not proof against every secret or prompt injection. Parallel payment races have not been load-tested.
- Secret files stay gitignored. Keep values, signed authorizations and tokens out of source, screenshots, prompts and logs.

[Submission](docs/SUBMISSION.md) · [Security](docs/agent-sprint/SECURITY.md) · [Current handoff](AGENT_HANDOFF.md)
