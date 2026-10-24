# Demo guide (presenter)

## Before the pitch (5 min, not live)
1. `npm run dev` (Vite :5173, Convex :3210/:3211, Factory runner :3299). Wait for “Factory runner … ready”.
2. `npm run x402:setup` — tops up the buyer wallet when it holds < 1 test USDC (one purchase costs 0.50).
3. Open http://localhost:5173 → **Demo menu** → **Reset demo data** (synthetic records only).
4. Optional rehearsal: `npm run e2e` runs the whole journey (~60 s; spends ~6k Factory credits and 0.50 test USDC). Reset again afterwards.

## Main three-minute journey (after reset)
| Time | Click path | Say |
| --- | --- | --- |
| 0:00 | Home | “An on-call engineer sees duplicate jobs and a queue that refills after restarts. Someone has solved this before — but the lesson is locked in their postmortem.” |
| 0:20 | Demo menu → **Northstar Cloud** → My incidents → open “Northstar: duplicate jobs…” → **2 · Six-part playbook** → **Draft with Moss** → **Accept all sections** | “Moss structures the contributor's notes; source notes stay private beside each section.” |
| 0:40 | **Next: privacy review** → **Run privacy scan** → **Apply all recommended generalizations** (show Undo) → tick approval → **Approve & submit** | “Emails, internal hosts, timestamps, customer and staff names are caught before anything is shareable.” |
| 0:55 | Demo menu → **Review Desk** → open the draft → **Run check** (FAIL) → **Apply fix with Factory Droid** (~15 s) or **Use local demo adapter** → **Re-run check** (PASS) → tick checklist → **Test reproduced** → **Approve** | “Real evidence: the same synthetic event delivered twice now creates one job — and legitimate deliveries still work.” |
| 1:15 | Demo menu → **Northstar** → open → step 4 → tick → **Publish guide** | “Nothing is published without the contributor approving this exact revision.” |
| 1:22 | Presenter controls → **Harbor Analytics** — a **live alert pops up** (“New guide matches your alert”) because Harbor saved this symptom earlier | “The moment a matching fix is published, the team that needs it is told — in real time.” |
| 1:25 | Click scenario chip 1 (or press **⌘K** and type the symptom) | “Paraphrased symptoms → **Strong overlap**, with matched clues and what to check first.” Then chip-free query `queue backlog after deploy without repeated event IDs` → near-miss ranks first. |
| 1:50 | Open guide → **Does this fit?** panel (note the **TLP:GREEN** label) → **Unlock guide** → tick the **Data Use License** → **Start x402 test checkout** → **Pay 0.50 test USDC with x402** | “Software buys knowledge in the response workflow: real x402 on Base Sepolia, exact price, receipt with BaseScan link.” |
| 2:20 | **Read the guide** → *What they tried that did not work* → tick a Verify item → **Copy as runbook** / **Download STIX 2.1** → open **Test evidence → see run** | “It tells you what failed, what worked, and how to verify — checklist saved to your account.” |
| 2:40 | **Report your outcome** → submit → Demo menu → **Northstar** → My incidents | “Contributor sees 0.40 USDC accrued (not paid out) and the buyer outcome; platform fee 0.10.” |

## Two-minute alternate (security buyer)
Harbor → chip 2 “A signed-in customer can see export data outside their workspace” → tenant-export guide (**Test reproduced** at seed time) → fit panel shows the cache mismatch → evidence run shows tenant A reads own export, cannot read tenant B's (legitimate access preserved) → unlock with the simulator (“Use demo simulator instead”) if you want to keep test USDC.

## Recovery switches
- **No network / Apify down:** “Fetch references” keeps earlier live refs (stale) or curated refs, labeled.
- **Moss down:** drafting and Q&A fall back to deterministic text, labeled “fallback”.
- **Factory runner down or slow:** “Use local demo adapter” (labeled), or show `toy-apps/artifacts/recorded-webhook-factory-run.json` (recorded run).
- **Facilitator/testnet down or wallet empty:** purchase stays locked with the error shown; click **Use demo simulator instead** (explicit switch, labeled “Demo payment”).
- **Refresh:** identity, entitlement, checklist, and drafts are server-side and survive reloads.

## Extra “wow” moments (if time allows)
- **⌘K** anywhere: jump to any page or type a problem to search.
- **Team & budget** (Harbor): monthly limit with a live meter; going over blocks checkout.
- **Audit log** (Review Desk): every submission, review, publication, purchase, and Factory run, exportable as CSV.
- **Trust & safety** and **Pricing** pages explain the business in plain language.
