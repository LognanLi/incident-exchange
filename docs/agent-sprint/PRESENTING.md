# Presenting the hosted demo

Hosted console: **https://quirky-robin-694.convex.site/** (Convex dev deployment).

| Who | How they get in | Can do | Can't do |
| --- | --- | --- | --- |
| **Operator** (you, the presenter) | Hosted site in *presenter mode*: your browser gets a session from **your local runner** | Everything, plus **live agent runs** and **reset demo data** | — |
| **Viewer** (anyone with the access code) | `https://quirky-robin-694.convex.site/#access=<DEMO_ACCESS_CODE>` | Browse, search, simulated purchases, x402 test checkout (≤ 1 test USDC per payment), watch live runs, open the recorded run | Reset demo data; start agent runs (both refused server-side) |

The session kind is part of the HMAC-signed session token, so a viewer can't upgrade their own session (`tests/session.test.ts`).

## 1. Start the local runner (operator machine)

Requirements in the repo root: `.env.local` (Convex URL), `.secrets.local` (runner, session and Factory secrets), `.agent-tokens.local` (from `npm run agents:setup`).

```bash
cd incident-exchange
npm run dev:factory   # runner on http://127.0.0.1:3299 — needed for presenter mode, Factory "Apply fix", live agent runs
npm run dev:mcp       # MCP server on http://127.0.0.1:8787 — needed by the agents during a live run
```

The runner prints the browser origins it accepts. Check that the hosted site is listed:

```
Runner accepts browser origins: http://localhost:5173, http://127.0.0.1:5173, https://quirky-robin-694.convex.site
```

Avoid `npm run dev` while presenting from the hosted site: it also starts `convex dev`, which pushes your working tree to the shared deployment on every save.

## 2. Open the hosted site in presenter mode

1. Open **https://quirky-robin-694.convex.site/#presenter** (or use Demo controls → *I'm the presenter — use my local runner*).
2. The browser asks whether this site may access your **local network**. Click **Allow**.
3. The runner terminal should print:
   `[session] operator session minted for https://quirky-robin-694.convex.site (5 orgs)`
4. In the app, Demo controls shows *Presenter mode*. On Agents, **Run demo** appears (switch to the Review Desk role first).

To hand the screen to a viewer session, go to Demo controls → *Switch to viewer mode*.

### Browser check (2026-10-24, this Mac)

| Browser | Result | How it was checked |
| --- | --- | --- |
| Chrome 155 | **Works after you allow local network access.** Without permission it's blocked ("Permission was denied … loopback address space"). With permission the runner minted an operator session for the hosted origin. | Automated, installed Chrome, fresh profile. Permission granted programmatically, standing in for the prompt click. |
| Zen 1.23.3b (Firefox 158), your default | **2026-10-24 18:30 PDT manual check: the user saw *Presenter mode* after a hard reload, but the runner logged no `[preflight]` or `[session]` request from the browser** (a `curl` to the same runner logged normally, and the hosted bundle targets `http://127.0.0.1:3299`). So this is user-reported, not confirmed from the runner side. Before presenting, watch the runner output for `[session] operator session minted for https://quirky-robin-694.convex.site` after reloading. Background: Zen ships Firefox's Local Network Access set to ask (`permissions.default.local-network = 0`; the prompt waits 5 min; Allow lasts 24 h). Headless Zen didn't load pages in this environment, even for a screenshot, so it couldn't be automated. | Inspected Zen's built-in prefs. **Do the 30-second manual check below before presenting.** |
| Safari 26.6 | Not checked. | — |

**Manual check (Zen or any browser):** with the runner running, open `https://quirky-robin-694.convex.site/#presenter`, click Allow when asked, and confirm the runner prints the `[session] operator session minted …` line. If it doesn't, the page offers *Retry* and *Continue as viewer*. You can also present from `http://localhost:5173` (`npm run dev:frontend`), which never needs the permission.

## 3. Live run vs recorded run

- **Live** (Agents → *Live*): the operator clicks **Run demo**. This executes Agent A's fix, the disclosure gate, MCP submission or reuse, Agent B's search, the payment or reused purchase, Factory Droid's repair in the sandbox, and the protected tests. Everyone watching the hosted site sees events stream in through Convex subscriptions.
- **Recorded** (Agents → *Recorded run*): a capture of a real earlier run, marked *Recording — not live* with its date, duration, deployment and commit. **Replay** steps through its real timeline at 2×. Viewing or replaying runs no code and moves no money. Use it for remote viewers when your runner isn't available.

Refresh the recording after a good live run:

```bash
node connector/demo.mjs && node scripts/record-run.mjs && npm run deploy:web
```

`scripts/record-run.mjs` keeps only the redacted data the live console already shows, and refuses to write if anything matches a secret pattern.

## 4. Rehearsals are idempotent

Agent A's bundle has no run ids or timestamps, and its request id is derived from the content hash. The exchange returns the existing submission for identical content from the same agent, and the orchestrator skips review when the guide is already published. Agent B reuses its existing purchase. Repeated rehearsals therefore reuse one guide. Verified: four consecutive runs left the guide count unchanged after the first run with the new content. The attack check's quarantined test submission is deduplicated the same way.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Presenter mode can't reach your local runner" | Runner not running, browser permission denied, or the site isn't in the runner's origins (`IX_ALLOWED_ORIGINS`). Retry, or *Continue as viewer*. |
| Run demo shows "Switch to the Review Desk role…" | Live runs need the reviewer role **and** an operator session. |
| Viewer sees "Only the demo operator can do this" | Expected: reset and live runs are operator-only. |
