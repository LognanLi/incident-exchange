// Screenshot key screens at desktop/laptop/mobile widths: node e2e/viewports.mjs [baseUrl] [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = process.argv[3] ?? "/tmp/ix-viewports";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const QUERY = "The queue fills again after restarting workers, and identical webhook event IDs create two jobs";
for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1024, 768], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem("incident-exchange.actor", "harbor"));
  await page.goto(BASE);
  await page.screenshot({ path: `${OUT}/${name}-home.png`, fullPage: false });
  await page.goto(`${BASE}/playbooks?q=${encodeURIComponent(QUERY)}`);
  await page.locator(".result").first().waitFor();
  await page.screenshot({ path: `${OUT}/${name}-search.png`, fullPage: false });
  await page.locator(".result").first().getByRole("link").first().click();
  await page.getByText("Does this fit your incident?").waitFor();
  await page.screenshot({ path: `${OUT}/${name}-guide.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${name}: horizontal overflow on guide page = ${overflow}`);
  await page.close();
}
await browser.close();
