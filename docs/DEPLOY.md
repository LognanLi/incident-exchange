# Deploy the submission

The only authorized target is the existing Convex **dev** deployment `quirky-robin-694`: API `https://quirky-robin-694.convex.cloud`, site `https://quirky-robin-694.convex.site`. It hosts the backend, web files, remote MCP/OAuth and crons. Factory repair and the local MCP service still run on the presenter’s Mac. There is no production deployment; do not provision or switch targets for this submission.

## 1. Inspect and merge

```bash
git status --short --branch
git fetch origin
gh pr list --state open
```

Preserve uncommitted work and other worktrees. The owner merges PRs manually. Do not deploy an unmerged feature branch. Once the required PR is merged and the working tree is clean:

```bash
git switch main
git pull --ff-only origin main
git rev-parse HEAD
npm run typecheck
npm test
npm run build
```

Check CI for that commit. The `.env.local` target must still be `quirky-robin-694`; inspect public URLs and configuration names only. Leave existing secret values and credentials untouched. Stop any unintended `convex dev` watcher before a controlled deployment.

## 2. Deploy both cloud surfaces

```bash
npx convex dev --once   # replace functions/schema on the configured shared dev target
npm run deploy:web     # build + upload dist files + prune superseded web assets
```

Log the commit, time, target and result in the release evidence. GitHub pushes do not deploy. Uploading web files does not deploy backend functions. The Convex CLI has no application Git build ID exposed here, so a controlled deployment log supports the backend source claim; verify schemas and behavior independently.

Do not run `npm run setup`, `npm run agents:setup`, `npm run x402:setup`, Reset or `npm run e2e` during a release. They can switch local setup, rotate tokens, fund wallets or reset data. No data migration or secret change is required by the submission synchronization fix.

## 3. Synchronize local processes

Check `/health` on `http://127.0.0.1:3299` for `busy: false` and `demoRunning: false`. Confirm no current cloud job is queued/running. Restart only the known Factory runner / MCP processes after relevant source merges; preserve old logs and leave unrelated processes alone. Starting them again while old listeners remain will fail with a port conflict.

```bash
npm run dev:factory
npm run dev:mcp
npm run dev:frontend
```

Use separate terminals. Vite reloads frontend edits, but the Node runner and MCP service do not hot-reload their imported modules. Record their start times and the source commit used. Do not start `npm run dev` for presentation: it also launches the cloud watcher.

## 4. Verify the release, not just local files

- Fetch the hosted `/index.html` with cache bypass; compare it with `dist/index.html`. Fetch every `dist` file and compare SHA-256 bytes, including JS/CSS, `/connect-check.mjs` and `/ix-token-header.sh`. Deep link `/agents` must serve the same app. The helpers must match `public/` and be downloadable without a console session.
- Run `node connector/protocol-check.mjs` and `npm run remote:check`. Both local and remote must list 11 tools; compare tool schemas. Verify actual Moss search, paywall/scope denials, OAuth audience rules and the remote refusal of long-lived secrets as bearer tokens.
- Download the helpers into an unrelated directory. Use an **existing** credential privately for discovery, token exchange, `get_my_access` and search. Capture the headers helper’s stdout in memory; it contains a bearer token and must never enter logs.
- Open hosted Agents as a viewer: viewer explanation and **Enable presenter mode** must be visible; the session remains server-side restricted. Connect presenter mode on the Mac and confirm **Run demo**. Run the existing dedupe scenario and inspect the new job, events, Factory candidate, protected tests and `runner_verified` outcome. Verify the tenant scenario as needed for changed paths.
- Capture a purchase/earnings baseline before rehearsal. `node e2e/agent-ledger-check.mjs <baseline.json>` checks unchanged purchases/accruals and both actual Base Sepolia receipts. No new payment is needed.
- Check Recorded run and replay. Refresh `src/recordings/two-agent-run.json` only if it materially misrepresents the flow, not just because a newer run exists. Screenshot/video evidence must state its capture time and live/recorded mode.

Use [SUBMISSION_AUDIT.md](agent-sprint/SUBMISSION_AUDIT.md) for the dated baseline and [PRESENTING.md](agent-sprint/PRESENTING.md) for browser-specific behavior. A blocked browser permission is different from a stale bundle or a missing local service.

## Limits before real customers

Signed demo identity is not production sign-in; operator-issued agent credentials are not end-user PKCE. Testnet settlement is not mainnet money. Accrual is not payout. The local repair environment is not a VM, arbitrary third-party patches are unsupported, and Linux execution is not covered by CI. These are submission limits, not claims of completed production work.
