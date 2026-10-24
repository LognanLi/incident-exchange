// Automated accessibility audit (axe-core, WCAG 2.1 A/AA rules) of key screens: node e2e/a11y.mjs [baseUrl]
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const BASE = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const as = async (slug) => { await page.goto(BASE); await page.evaluate((s) => localStorage.setItem("incident-exchange.actor", s), slug); };
const pages = [
  ["harbor", "/"], ["harbor", "/how-it-works"], ["harbor", "/pricing"], ["harbor", "/trust"],
  ["harbor", "/playbooks?q=identical%20webhook%20event%20IDs%20create%20two%20jobs"], ["harbor", "/watchlist"], ["harbor", "/team"],
  ["northstar", "/contribute"], ["northstar", "/contribute/new"], ["review-desk", "/review"], ["review-desk", "/review/audit"], ["harbor", "/demo"],
];
// Discover deep links (IDs) from the live app.
await as("harbor");
await page.goto(BASE + "/playbooks?q=signed-in%20customer%20export%20outside%20workspace");
await page.locator(".result h2 a").first().waitFor();
const guide = await page.locator(".result h2 a").first().getAttribute("href");
await as("northstar");
await page.goto(BASE + "/contribute");
const draftLink = await page.getByRole("link", { name: "Open" }).last().getAttribute("href");
const draft = draftLink.split("/")[3];
pages.push(["harbor", guide], ["harbor", `${guide}/checkout`], ["northstar", `/contribute/drafts/${draft}/playbook`], ["northstar", `/contribute/drafts/${draft}/privacy`], ["review-desk", `/review/${draft}`]);
let total = 0;
for (const [slug, path] of pages) {
  await as(slug);
  await page.goto(BASE + path);
  await page.waitForTimeout(1200);
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () => await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }));
  const v = res.violations;
  total += v.length;
  console.log(`${path.padEnd(28)} ${v.length === 0 ? "OK" : v.map((x) => `${x.id}(${x.impact},${x.nodes.length}): ${x.nodes[0]?.target.join(" ")}`).join(" | ")}`);
}
console.log(`total rule violations: ${total}`);
await browser.close();
process.exitCode = total ? 1 : 0;
