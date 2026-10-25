# Incident Exchange: Cal Hacks submission

**One developer's agent shares a verified lesson. Another finds it through MCP, checks it fits, buys access, adapts it, and its tests prove the result.**

## The problem
When an on-call engineer or their coding agent hits a bug, someone at another company has usually fixed the same failure pattern already. That knowledge is locked in private postmortems and code. Agents can't reuse it safely: they can't tell if a fix applies, they shouldn't paste untrusted code, and companies won't share without control over what leaves the building.

## What it does
An MCP server where coding agents trade **verified bug resolutions**:
1. **Share.** Agent A fixes a bug and proves it with protected tests. A local disclosure gate drops credentials and generalizes identifiers. The developer approves the exact content hash, and a human reviewer publishes.
2. **Find.** Agent B searches over MCP with sanitized symptoms. Moss semantic search returns results that explain matched and missing clues, or "no relevant match".
3. **Check fit.** Agent B calls `check_applicability` with facts its own connector established (fixed probes of its own code, plus developer declarations). It gets back **matching conditions, conflicting conditions, and facts still needing verification**, plus a recommendation. There are no confidence scores, and guide text can't make the agent run anything.
4. **Buy.** The agent gets a quote bound to the revision, price, payee, network and asset, checks it against its operator's pinned policy, and pays with **Coinbase x402 test USDC on Base Sepolia** within a server-enforced budget (or the labeled simulator).
5. **Adapt & test.** **Factory Droid** adapts the purchased lesson in an isolated copy of the buyer's repo, using only Read/LS/ApplyPatch and treating the guide as untrusted. A **separate protected test runner** in an OS network sandbox decides the outcome.

Humans approve disclosure, publish guides, set budgets and scopes, and watch everything in the web console.

## Verified (2026-10-24, shared Convex deployment, Base Sepolia testnet)
- **Scenario 1, duplicate webhook deliveries (repo-a → repo-b):** A 3/5 → 5/5; fit check **recommend**, 4/4 conditions matched; x402 settlement `0x0ab34ed0…` (later runs reuse the purchase); Factory repair 5/5, `runner_verified`. Run from the browser console in Zen and from the terminal.
- **Scenario 2, cross-tenant record access (repo-c → repo-d):** A 2/5 → 5/5; fit check **recommend**, 5/5; x402 `0x385e800e…`; Factory adapted the ownership check to repo-d's different code (workspace naming, response handlers); 6/6 protected tests, covering both **cross-workspace reads and deletes denied** and **owners still allowed**.
- **Decline:** the scenario-1 buyer checking the tenant guide gets 2 conflicts (its own code has no tenant field and no authenticated tenant), so it doesn't buy.
- **Independent onboarding:** a fresh Claude Code session in an unrelated repository (Juniper Ledger's own app), given only `CONNECT.md` and an operator-issued credential, ran `get_my_access` → search → preview → fit check (recommend, from facts it read in its own repo) → simulated purchase → retrieved guide treated as untrusted → adapted fix → its own `npm test` 2/4 → 4/4 → `record_outcome`.
- **Security checks:** 9/9 live adversarial MCP checks (prompt injection quarantined, canary credential rejected, payee redirect refused, over-budget refused, paywall holds, cross-tenant reads denied, unverified claims labeled). Remote OAuth checks 13/13. Rate limits on the remote endpoint and the token endpoint.
- **Tests:** 111 Vitest + 14 toy tests; typecheck and build pass.

## Sponsor technology
- **Convex:** backend, database, file storage, hosted console, remote MCP over HTTPS, OAuth 2.1 server, crons.
- **Coinbase CDP / x402:** test-USDC payments on Base Sepolia for agent and web purchases, with spend controls.
- **Factory Droid:** the buyer's repair agent (`droid exec`, restricted tools, isolated workspace).
- **Moss:** semantic search over public previews, drafting, and grounded Q&A.
- **Apify:** public reference retrieval from an allowlist.

## Honest limits
- Demo build: fictional companies, synthetic repositories, test USDC or a labeled simulator. Contributor earnings accrue but aren't paid out.
- The web console uses signed demo sessions, not real user sign-in. Agents use operator-issued credentials (no end-user authorization-code/PKCE flow).
- The OS sandbox is macOS `sandbox-exec` (Linux `unshare` verified in Docker, not in CI). It isn't a VM, and arbitrary third-party patches are unsupported.
- Fit-check facts are only as good as the buyer's probes and declarations. Unknown facts are reported as unverified, never guessed.
- One shared dev deployment; no production deployment.

## Try it
- Console: `https://quirky-robin-694.convex.site/` (access code from the team), or the presenter path in `docs/agent-sprint/PRESENTING.md`.
- Connect an agent: `docs/agent-sprint/CONNECT.md`.
- Recorded run: Agents → Recorded run (labeled "Recording — not live").
