// End-to-end browser run of the three-minute demo against a running `npm run dev`.
// Uses your installed Google Chrome via playwright-core (no browser download).
//   node e2e/demo-flow.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:5173";
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.setDefaultTimeout(15000);

let n = 0;
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: true });
const step = (msg) => console.log(`✔ ${msg}`);
const actAs = async (orgName) => {
  await page.goto(`${BASE}/demo`);
  await page.getByRole("button", { name: new RegExp(orgName) }).click();
  await page.locator(".identity-name", { hasText: orgName }).waitFor();
};

const started = Date.now();
try {
  await page.goto(BASE);
  await page.getByRole("heading", { name: /Turn a hard-won incident/ }).waitFor();
  await shot("home");
  step("Home loads");

  await page.goto(`${BASE}/demo`);
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page.getByText("Demo data restored").waitFor();
  await shot("demo-menu");
  step("Demo data reset");

  // ---- Contributor: a brand-new report saves as a draft (validation first)
  await actAs("Northstar Cloud");
  await page.goto(`${BASE}/contribute/new`);
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Give the incident an internal title.").waitFor();
  await page.getByLabel("Internal title").fill("E2E: certificate expiry on internal API");
  await page.getByLabel("Symptoms").fill("Clients started failing TLS handshakes overnight.");
  await page.getByLabel("Public title").fill("TLS handshake failures after certificate expiry");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved.").waitFor();
  await page.waitForURL(/\/contribute\/drafts\/.+\/report/);
  await shot("new-incident");
  step("New incident report validated and saved as a draft");

  // ---- Contributor: seeded Northstar report
  await page.goto(`${BASE}/contribute`);
  await page.getByRole("row", { name: /Login service failures/ }).getByRole("link", { name: "Open" }).click();
  await page.getByRole("button", { name: "Draft with Moss" }).click();
  await page.getByText(/^Drafted by (Moss|the deterministic fallback)\.$/).waitFor({ timeout: 60000 });
  const engine = (await page.getByText(/^Drafted by (Moss|the deterministic fallback)\.$/).textContent()).replace(/\.$/, "");
  await page.getByRole("button", { name: "Accept all sections" }).click();
  await page.getByText("6 of 6 sections accepted").waitFor();
  await shot("playbook-editor");
  step(`Six-part playbook ${engine.toLowerCase()} and accepted`);

  await page.getByRole("link", { name: /Next: privacy review/ }).click();
  await page.getByRole("button", { name: "Run privacy scan" }).click();
  await page.locator(".findings .sev-high").first().waitFor();
  const highCount = await page.locator(".findings .sev-high").count();
  await shot("privacy-findings");
  step(`Privacy scan flagged ${highCount} high-severity identifiers`);
  await page.getByRole("button", { name: "Apply all recommended generalizations" }).click();
  await page.getByText("No identifiers found in the buyer-visible version.").waitFor();
  await page.getByLabel(/I approve exactly the buyer-facing version/).check();
  await shot("privacy-clean");
  await page.getByRole("button", { name: "Approve & submit for human review" }).click();
  await page.locator(".lead-status", { hasText: "In human review" }).waitFor();
  step("Contributor approved sanitized version and submitted");

  // ---- Reviewer
  await actAs("Incident Exchange Review Desk");
  await page.getByRole("link", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Fetch references" }).click();
  await page.getByText(/seeded references|Retrieved \d+ allowlisted|Apify request failed/).waitFor({ timeout: 150000 });
  const refMsg = await page.locator(".state-info.small").first().textContent();
  step(`Public references: ${refMsg}`);
  await page.getByRole("button", { name: "Run check", exact: true }).click();
  await page.waitForTimeout(500); // let the runner health probe settle
  await page.locator(".step-fail .result-fail", { hasText: "FAIL" }).waitFor();
  const factoryBtn = page.getByRole("button", { name: "Apply fix with Factory Droid" });
  let fixTool = "local demo adapter";
  if (await factoryBtn.isVisible().catch(() => false)) {
    await factoryBtn.click();
    fixTool = "Factory Droid";
  } else {
    await page.getByRole("button", { name: "Apply defensive fix" }).click();
  }
  await page.locator(".result-applied", { hasText: "Applied" }).waitFor({ timeout: 200000 });
  await page.getByRole("button", { name: "Re-run check" }).click();
  await page.locator(".step-pass .result-pass", { hasText: "PASS" }).waitFor();
  await shot("validation");
  step(`Validation: FAIL before fix, PASS after (fix by ${fixTool}; checks by local validator)`);
  for (const cb of await page.locator(".decision input[type=checkbox]").all()) await cb.check();
  await page.getByLabel(/Test reproduced/).check();
  await page.getByLabel("Note to contributor").fill("Evidence and reproduction check out.");
  await shot("decision");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("heading", { name: "Decision recorded" }).waitFor();
  step("Reviewer approved with “Test reproduced”");

  // ---- Contributor final approval
  await actAs("Northstar Cloud");
  await page.getByRole("row", { name: /Login service failures/ }).getByRole("link", { name: "Open" }).click();
  await page.getByLabel(/I approve publishing this final/).check();
  await page.getByRole("button", { name: "Publish guide" }).click();
  await page.getByText("Published and searchable.").waitFor();
  step("Contributor gave final approval; guide published");

  // ---- Buyer
  await actAs("Harbor Analytics");
  await page.getByLabel("Describe what you are seeing").fill("repeated authentication failures after a deployment");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const first = page.locator(".result").first();
  await first.getByText("Investigating repeated authentication failures after a deployment").waitFor();
  await first.getByText("Why this matched:").waitFor();
  await shot("search");
  step("Buyer search ranks the guide first with a match reason");
  await first.getByRole("link", { name: "Open free preview" }).click();
  await page.locator(".tag-locked").waitFor();
  await page.locator(".price-big", { hasText: "$49.00" }).waitFor();
  await page.getByText("Limitations").first().waitFor();
  await shot("playbook-preview");
  step("Free preview shows evidence, limitations, price; details locked");
  await page.getByRole("link", { name: "Continue to demo checkout" }).click();
  await page.getByText("DEMO PAYMENT — SIMULATED").waitFor();
  await page.getByRole("button", { name: "Start demo checkout" }).click();
  await page.getByLabel(/I understand this is a simulated payment/).check();
  await shot("checkout");
  await page.getByRole("button", { name: "Complete simulated payment" }).click();
  await page.getByRole("heading", { name: "Playbook unlocked" }).waitFor();
  await page.getByText("$39.20").waitFor();
  await page.getByText("$9.80").waitFor();
  await shot("receipt");
  step("Simulated purchase recorded: $49.00 → $39.20 contributor / $9.80 platform");
  await page.getByRole("link", { name: "Read the playbook" }).click();
  await page.locator(".tag-unlocked").waitFor();
  await page.getByLabel("Question").fill("How do I confirm the lockout test works?");
  await page.getByRole("button", { name: "Ask" }).click();
  await page.locator(".answer").waitFor({ timeout: 90000 });
  const qaEngine = await page.locator(".answer .muted").last().textContent();
  const cites = await page.locator(".answer .cite").allTextContents();
  await shot("unlocked");
  step(`Unlocked guide readable; Q&A — ${qaEngine}; citations: ${cites.join(" ") || "none"}`);
  await page.getByRole("link", { name: "Report your outcome" }).click();
  await page.getByLabel("Very relevant").check();
  await page.getByLabel("Resolved our issue").check();
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await page.getByText("Thanks — feedback saved").waitFor();
  step("Buyer feedback saved");

  // ---- Reviewer sees feedback
  await actAs("Incident Exchange Review Desk");
  await page.goto(`${BASE}/review/feedback`);
  await page.getByText("Resolved our issue").waitFor();
  await shot("feedback-inbox");
  step("Reviewer sees buyer feedback");

  // ---- Buyer cannot open contributor screens
  await actAs("Harbor Analytics");
  await page.goto(`${BASE}/contribute`);
  await page.getByText("This screen is for the contributor role").waitFor();
  step("Role gate shown to buyer on contributor route");

  console.log(`\nDemo flow completed in ${((Date.now() - started) / 1000).toFixed(1)}s (automated).`);
  if (consoleErrors.length) {
    console.log("Browser console errors:\n" + consoleErrors.join("\n"));
    process.exitCode = 1;
  }
} catch (err) {
  await shot("failure");
  console.error("✘ E2E failed:", err.message);
  if (consoleErrors.length) console.error("Console errors:\n" + consoleErrors.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
