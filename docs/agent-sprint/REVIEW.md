# Independent adversarial review (Worker F) — 2026-10-24

Scope: branch `agent-sprint`, cloud deployment as configured in `.env.local`, MCP on 127.0.0.1:8787, runner on 127.0.0.1:3299.
Method: code reading plus non-destructive probes (scripts in /tmp, not in the repo). No source edits, no funds spent, no reset.

Checks run:
- `npm test`: 7 vitest files / 64 tests pass; `toy-apps/toy.test.mjs` 14/14 pass.
- `node connector/attack-check.mjs`: 9/9 PASS (first attempt got ECONNREFUSED because the MCP server was restarting; the rerun passed).

Overall: the MCP path (`convex/mcp.ts` behind the service secret) is mostly sound. The serious problems are (a) every non-MCP public Convex function trusts a public org slug as identity, which bypasses the paywall, tenant isolation and demo administration, and (b) the protected test runner runs candidate code in the same process as the tests, with no sandbox.

---

## Defects (prioritized)

### D1 — CRITICAL — S5 (also S4): protected tests can be defeated from inside the candidate; "runner_verified" can be forged
- Expected: the candidate cannot change test outcomes. Only a real fix passes.
- Observed: `sample-repos/run-protected-tests.mjs` runs `node --test protected-tests/*.test.mjs`. The test file `import`s the candidate module into the same process, with no `--permission` and full filesystem/network access. A candidate in the only editable file can overwrite `node:assert` methods, which the test file shares. It still passes `enforceCandidate` because only the editable file changed. `findTampering` only looks for `*.test.mjs` / `protected-tests` names.
- Reproducer (done, local only, no network):
  ```
  cp -R sample-repos/repo-b/src /tmp/ixprobe/cand
  # prepend to /tmp/ixprobe/cand/consumer/messageConsumer.mjs:
  #   import a from "node:assert/strict"; import b from "node:assert";
  #   for (const o of [a,b]) for (const k of Object.keys(o)) if (typeof o[k]==="function" && k!=="AssertionError") o[k]=()=>{};
  # and wrap queue.push in try{}catch{} (NOT idempotent; no real fix)
  node -e 'import("./sample-repos/run-protected-tests.mjs").then(async m=>console.log((await m.runProtectedTests({repo:"repo-b",candidateDir:"/tmp/ixprobe/cand"})).passed))'
  ```
  Result: unmodified vulnerable source = 2/5 FAIL. Assert-neutered candidate = **5/5 passed: true**. Through agentB this becomes `recordRepairRun(passed:true)` and then `record_outcome` → `runner_verified`.
- Other ways in: the candidate can `process.exit(0)` or rewrite `sample-repos/repo-b/protected-tests/*.test.mjs` on disk at import time (it has write access). That change persists into later runs. `protectedSuiteHash` is computed *after* the run and is never compared with a pinned value.
- Fix: run the tests in a child process that cannot write to the suite. Use `node --permission --allow-fs-read=<suite>,<candidate>` with no `--allow-fs-write` and no `--allow-child-process`, as `scripts/factory-runner.mjs` already does for toy apps. Load assertions from a module the candidate cannot reach. Better: run the candidate in a separate process from the assertions. Pin and verify `protectedSuiteHash` *before* the run (manifest-stored hash). Treat runner_verified as "tests passed under sandbox X", not as proof of a fix.

### D2 — CRITICAL — M4, S7: paid content readable by anyone through public Convex queries (slug identity)
- Expected: paid detail only goes to an entitled principal. Role and org cannot be chosen by the caller.
- Observed: the whole web API (`convex/lib/access.ts:getActor`) authenticates with a caller-supplied org slug. `demo.listOrgs` (public, no args) lists every slug and role. `playbooks.get({actor:"review-desk", playbookId})` returns `lockedSteps` (check/contain/recover/verify) for any playbook because `entitledRevision` returns `pb.revision` for reviewers.
- Reproducer (done, read-only): `/tmp/ixprobe/pub.mjs` with ConvexHttpClient → `listOrgs` → `northstar:contributor harbor:buyer review-desk:reviewer cobalt juniper`. `playbooks.get` as harbor → `unlocked:false`; as `review-desk` → `unlocked:true`, recover body 1025 chars.
- Also, code-verified: `purchases.startCheckout({actor:"harbor", preference:"demo_simulator", acceptLicense:true})` + `purchases.completeSimulated({confirmed:true})` grants a buyer entitlement with no payment. `business.setBudget` (public, buyer slug) raises the budget first.
- Fix: put real auth (Convex Auth/Clerk) on every web function, or at minimum gate demo identities behind a server-side presenter secret and disable `demo_simulator` checkout when x402 is configured. SECURITY.md must state this boundary; today it does not mention it.

### D3 — HIGH — S2, S1: `agentsConsole.overview` leaks cross-tenant data, including unscanned diffs, to any slug
- Expected: the oversight console is limited to an operator/reviewer and redacted.
- Observed: `overview` only calls `getActor` (any role, any public slug). It returns, across all orgs: 80 events, all principals (name, org, scopes, spend policy, expiry), all agent submissions (title, moderation reasons, bundleHash), all agent purchases (amount, tx), outcomes, and `repairRuns` including the full `diff` (up to 8000 chars). The consumer's diff is derived from the paid resolution, so this also leaks paid content (M4).
- Reproducer (done): `overview({actor:"harbor"})` → events 33, principals agent-a (northstar) / agent-b (harbor) with policies, 6 runs with diffs, 3 submissions, 1 purchase.
- Also: `recordRepairRun` never runs `scanSecrets` on `diff`/`note`/`tests[].name`, unlike `logConnectorEvent`. A canary written into a candidate by the repair agent would be stored and publicly served (S1: "absent from server/logs/artifacts"). agentB also writes `diff` to `connector/.staging/agent-b-result.json` unscanned.
- Fix: `requireRole(…,"reviewer")` plus real auth. Drop `diff` from overview, or restrict it to the owning principal. Run `scanSecrets` over diff/note/test names in `recordRepairRun` and reject on any hit.

### D4 — HIGH — S7, C3: the platform buyer wallet can be spent by anyone with the Convex URL
- Expected: payment initiation requires an authenticated buyer.
- Observed: `x402Node.payWithX402({actor, purchaseId})` and `reconcilePayment` are public actions authorized only by `purchaseForBuyer` → `requireRole(actor,"buyer")` (public slug "harbor"). Chain: `setBudget(harbor, 100 USDC)` → `startCheckout(harbor, …)` → `payWithX402(harbor, id)`. The shared CDP buyer wallet signs and pays test USDC to the receiver, repeatedly, once per playbook.
- Reproducer: code path `convex/x402Node.ts:160-210`, `convex/x402State.ts:purchaseForBuyer`, `convex/business.ts:setBudget`. NOT executed (would spend).
- Fix: same as D2. In addition, require a server-side presenter/operator secret for any action that signs with the CDP wallet, and add a global daily cap.

### D5 — HIGH — S7: demo administration is public
- Observed: `demo.reset` is a public `mutation({args:{}})`. Its only guard is `DEMO_MODE !== "off"`. Anyone with the deployment URL can wipe all demo data, rotate the generation and invalidate in-flight runs. `agentsConsole.cancelJob` (reviewer slug) and `reviews.decide` (reviewer slug → approve and auto-publish) are equally open. The reviewer-only publication gate (M3) therefore holds only against callers who don't read `listOrgs`.
- Reproducer: code `convex/demo.ts:151`. NOT executed (forbidden; destructive).
- Fix: make `reset` internal (CLI) or require an operator secret. Gate reviewer mutations behind real auth.

### D6 — HIGH — M4, C3, S8: agents can always choose the free simulator; x402 silently downgrades
- Expected: when x402 is configured, entitlement requires settled payment.
- Observed: `acquire` accepts caller-controlled `simulate`. `paymentMode:"simulator"` → `completeSimulated` grants entitlement with no funds, even when CDP is configured. Any principal with the `acquire` scope gets paid content free (bounded only by its own spend policy count). Also `useX402 = !simulate && cdpCredentialsPresent() && payTo!=="simulator"`: an agent that asked for `x402_testnet` is silently given a simulated (free) entitlement when credentials are missing. That entitlement is still `PAID` for retrieval, and the contributor accrues earnings from it (`submissionStatus` counts `simulated_success`).
- Reproducer: `convex/mcp.ts` acquire/completeSimulated; `mcp/server.mjs:82`. NOT executed live (would add purchase records). attack-check uses this path.
- Fix: add a per-principal flag `allowSimulator` set by the operator (default false when CDP is present). Fail with `PROVIDER_UNAVAILABLE` instead of downgrading when the request was `x402_testnet`. Exclude simulated purchases from earnings accrual.

### D7 — HIGH — S3, S4: candidate code runs with full user privileges; patch content is not policy-checked
- Observed: the rules "no network calls, eval, dynamic imports" are only in the Droid prompt (`factoryRepair.mjs:buildPrompt`). `enforceCandidate` checks *which* file changed, not *what* it contains. The protected runner (D1) executes the result unsandboxed (`env` trimmed, but fs/network unrestricted). So a resolution with injected instructions that steers Droid gives code execution on the developer machine. Droid's `--cwd` restriction for Read is Droid's own control, so reading files outside the workspace (e.g. `.secrets.local`) and embedding them in the patch is NOT VERIFIED either way.
- Fix: sandbox the runner (D1 fix). Add a host-side static check on the diff (deny `child_process`, `fetch`, `net`, `http`, `eval`, `Function(`, `import(`, `process.exit`, `node:assert`, `fs` writes) before execution. Run `scanSecrets` on the diff.

### D8 — MEDIUM — S7: runner `/agent-demo` and `/patch` accept any public slug; comment and code disagree
- Observed: `agentsConsole.canRunDemo` allows `["reviewer","buyer","contributor"]`, i.e. every org, while the comment says "only … reviewer/operator identity". Requests without an `Origin` header are accepted (curl, any local process, any non-browser client), and Content-Type is not checked. Any local process can start `connector/demo.mjs` (real x402 spend + Factory credits) with `{"actor":"harbor"}`, repeatedly (one at a time). `/patch` similarly needs only `review-desk` + a draftId.
- Reproducer (done, safe): `curl -X POST -H 'Content-Type: text/plain' -d '{"actor":"no-such-org"}' http://127.0.0.1:3299/agent-demo` → 403 from canRunDemo, not a transport rejection, so `{"actor":"harbor"}` would start it (NOT executed). An evil Origin is correctly rejected with 403.
- Fix: require a runner-local presenter token (not a slug), require `Content-Type: application/json` plus an allowed Origin, restrict `canRunDemo` to reviewer, and default to `--simulate-payment` unless explicitly confirmed.

### D9 — MEDIUM — S5: evidence runs are reusable and not bound to the purchased revision
- Observed: `recordOutcome` accepts `evidenceRunId` if `run.stage==="candidate" && principalName===p.name && playbookId===pb._id && passed===passed`. It does not check `run.revision === purchase.revision`, run freshness, or single use. One passing run can back unlimited `runner_verified` outcomes, including for later revisions. Each call also inserts `outcomeFeedback` as `relevance:"very_relevant"`, which inflates public `feedbackSummary`. Matching is by `principalName` string, which the runner chooses.
- Fix: bind the run to the revision and the purchaseId, mark it consumed, allow one outcome per purchase, and key on principalId.

### D10 — MEDIUM — S8: "approval" is self-attested by the submitting agent
- Observed: `submit` only checks `bundle.contentHash === approval.contentHash === recomputed hash`. The agent computes all three, and `approval.kind/reference` are never verified or stored. This proves integrity (no edit after hashing) but not that a developer approved. SECURITY.md/CONTRACTS describe it as approval coverage. `publicationConsent:true` from the agent then makes a reviewer approve auto-publish.
- Fix: issue a server-signed approval (or a separate connector key the model never sees) over the hash. Or document honestly that it is a hash-integrity check, not developer consent.

### D11 — MEDIUM — C4: no double-purchase guard server-side
- Observed: `acquire` dedupes only on `clientRequestId`. A second quote plus a new clientRequestId for a resolution the principal is already entitled to creates (and with x402, pays for) a second purchase. The "never pay twice" check lives only in `connector/agentB.mjs` (client-side `get_resolution` probe). Pending x402 purchases that fail stay `pending` forever and count against `maxPurchases`/`sessionMaxAtomic` (self-DoS).
- Fix: in `acquire`, return the existing entitlement when the principal already holds the quoted revision. Expire or cancel stale pending purchases.

### D12 — LOW — C1: quote does not bind asset; acceptance does not re-check contentHash
- `quotes` stores network/payTo/price/revision/contentHash but not the asset. `approved` has no asset field. `acquire` checks `pb.revision === qt.revision` but not that the current `playbookRevisions.contentHash` equals `qt.contentHash`, so an in-place revision row edit is undetected.
- Fix: store and compare the asset, and compare contentHash at acquire time.

### D13 — LOW — M2, S6: injection scan is only applied to agent submissions; quarantine is sticky only for that path
- Web-authored drafts (`drafts.ts`) never run `scanInjection`, so the M3/S6 protection there is reviewer judgment only. For agent submissions edited later through the web (after `request_changes`), content is not rescanned for secrets (`scanSecrets`) or injection. `moderation` keeps its original value ("clean" stays clean).
- Fix: rescan on every content change in `approveAndSubmit`/`publishApprovedDraft`.

### D14 — LOW — MCP transport
- The rate limit is keyed on the raw bearer *before* auth, and the `hits` Map is never pruned. Random tokens bypass the limit and each one triggers a Convex `authCheck` query (cost amplification plus unbounded memory).
- `authCheck` returns ok for a valid principal whose org was deleted, so the later tool call fails with PROVIDER_UNAVAILABLE. This is a minor inconsistency.
- Fix: add an IP-level limit before auth, prune the Map, and cap its size.

### D15 — LOW — S4: `safeRead` deny list is case-sensitive on a case-insensitive FS
- `DENIED` uses case-sensitive regexes for `.git`, `.ssh`, `id_rsa`, `package.json`, `.github`, `.test.mjs`, `protected-tests`. On macOS (APFS, case-insensitive), `safeRead(root, ".GIT/config")` resolves via `realpathSync` and preserves the input case, so the deny may be bypassed. `safeRead` currently has no callers in connector/scripts, so impact is latent. NOT VERIFIED by execution.
- Fix: lowercase the path before matching (or use `realpathSync.native`) and add `/i` to all patterns.

---

## Verified as holding
- MCP service secret: every `convex/mcp.ts` public function checks `MCP_SERVICE_SECRET` (`generation` is public but harmless). `upsertPrincipal`/`revokePrincipal` are internal.
- Token handling: only the sha256 is stored; `overview` omits tokenHash; invalid token → HTTP 401 (probed); disallowed Origin → 403 (probed on 8787 and 3299).
- Quote binding to principal, single use, expiry, revision; payee/network/price mismatch → FORBIDDEN, no purchase (attack-check). Spend reservation counts pending + settled.
- `getResolution` requires a principal-owned PAID purchase and returns the purchased revision; search/preview use `previewOf` (no paid fields).
- `submissionStatus`/`purchaseForAgent`/`completeSimulated` check ownership by principalId.
- Server-side secret scan rejects canary with categories only (attack-check). `logConnectorEvent` scans summaries.
- Quarantined agent submission cannot be approved through `reviews.decide`.
- x402 seller takes price/payee from the stored purchase, checks the amount, and blocks double settlement via the nonce in `markSettling`; `recordSuccess` is idempotent.
- Host patch policy: added/removed files, symlinks, and non-allowlisted writes are rejected (unit tests). No `dangerouslySetInnerHTML` in `src/`; React 19 neutralizes `javascript:` hrefs.
- `npm test` 64 + 14 pass; attack-check 9/9.

## NOT VERIFIED
- Whether Droid `exec --auto low --only-tools Read,LS,ApplyPatch --cwd` can Read or patch absolute paths outside cwd (D7).
- Live exploitation of D4, D5, D6, D8 (would spend funds, wipe data, or start demos; code paths only).
- Concurrent acquire races (Convex OCC assumed).
- The x402 facilitator's own verification of signature, amount and payee (third-party).
- attack-check's "cross-tenant submission read" case returns FORBIDDEN from the *scope* check, so it does not exercise the principalId ownership check. The ownership check is code-verified only.
- The `case-insensitive` bypass in D15 was not executed.
