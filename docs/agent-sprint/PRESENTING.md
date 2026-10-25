# Presenting the demo

## 0. Presenter quick start (verified 2026-10-24 19:01 PDT in Zen)

**Present from `http://localhost:5173` on your Mac.** The page and the runner are both local, so no browser local-network permission is involved. The console still uses the shared cloud backend (same data, Moss, x402, Factory). Remote viewers use the hosted link (§2) and see the same run live.

Three terminals in the repo root. **Don't use `npm run dev`**: it also starts `convex dev`, which pushes your working tree to the shared deployment on every save.

```bash
npm run dev:factory    # runner :3299 — wait for "Factory runner on http://127.0.0.1:3299 — ready"
npm run dev:mcp        # MCP :8787 — wait for "Incident Exchange MCP (Streamable HTTP) on http://127.0.0.1:8787/mcp"
npm run dev:frontend   # console :5173 — wait for "Local: http://localhost:5173/"
```

**Live path (rehearsed):**
1. Open `http://localhost:5173/`. The runner prints `[session] operator session minted for http://localhost:5173 (5 orgs)`.
2. Go to **Agents** (Live tab) and click **Run demo**. It starts as the Review Desk from any role. The runner prints `[agent-demo] run requested…` and then `[agent-demo] started`. The button reads *Running…*.
3. About 90 s later (rehearsal: 91 s) the runner prints `[agent-demo] finished with exit code 0`. The **Last run** line under the tabs shows *succeeded · Done* with the current time. The run goes: A 3/5 → 5/5 → disclosure gate → submit → B 2/5 → Moss search → x402 purchase (or reuse of the earlier purchase) → Factory Droid repair → 5/5 → `runner_verified`.
4. Show the story checklist, the lanes, the diff, the receipt and the security lane.

Before you start, confirm the **Last run** time changes when you click. An old *succeeded* line from an earlier run looks the same otherwise.

**Recorded fallback (clearly labeled):** Agents → **Recorded run** → **Replay**. The banner reads *Recording — not live*. It is the 19:01 PDT run started from Zen (89 s, x402 settlement `0x0ab34ed0…`). Use it if the runner, Factory or network fails. It runs no code and moves no money.

**Never click Demo → Reset demo data during a talk.** It wipes every guide, purchase and run on the shared deployment. It now asks for confirmation (an accidental reset at 18:59 PDT on 2026-10-24 removed the earlier records).

## Hosted site (for viewers, or as a presenter backup)

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
| Zen 1.23.3b (Firefox 158), your default | **Local console `http://localhost:5173`: verified end to end 2026-10-24 19:01 PDT.** The runner logged Zen's preflight and `[session] … for http://localhost:5173`, then `[agent-demo] run requested from http://localhost:5173` → `started` → `finished with exit code 0 after 91 s`. Zen showed *Last run · succeeded · Done · 7:01 PM*. **Hosted `#presenter` in Zen: not verified.** The 18:30 check never reached the runner, and Zen's saved site data had no presenter flag, so that page wasn't in presenter mode. | Live, with the runner log as evidence |
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
| Runner log shows no `[session]` line after opening the page | The page isn't in presenter mode (on the hosted site the URL needs `#presenter`; `localhost:5173` always uses the runner), or the runner isn't running. 2026-10-24 diagnosis: Zen's saved site data had no presenter flag at all, so the earlier hosted check never ran presenter mode. |
| "Presenter mode can't reach your local runner" | Runner not running, browser permission denied, or the site isn't in the runner's origins (`IX_ALLOWED_ORIGINS`). Retry, or *Continue as viewer*. |
| Run demo shows "Switch to the Review Desk role…" | Fixed 2026-10-24: Run demo now sends the Review Desk session from any role. If you still see it, a run is already in progress (wait for *Last run* to finish), or the console is an old build (reload). |
| Viewer sees "Only the demo operator can do this" | Expected: reset and live runs are operator-only. |
