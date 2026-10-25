// Read-only browser checks by default. --run explicitly rehearses the authorized fixtures using existing entitlements.
// Never resets data, creates a checkout, rotates credentials, or starts a Convex watcher.
// node e2e/agent-activity.mjs http://localhost:5173 [/tmp/ix-activity] [--run]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '/tmp/ix-activity';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'horizontal overflow');
const axe = async name => {
  await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map(x => ({ id: x.id, targets: x.nodes.map(n => n.target) })));
  assert.deepEqual(violations, [], `${name} accessibility`);
};
try {
  await page.goto(`${BASE}/agents`);
  await page.getByRole('heading', { name: 'Agents sharing fixes' }).waitFor();
  await page.getByText('Local runner connected', { exact: true }).waitFor();
  if (process.argv.includes('--run')) {
    await page.getByRole('button', { name: 'Run demo', exact: true }).click();
    await page.getByRole('button', { name: 'Running…', exact: true }).waitFor();
    await page.getByLabel('Current stage').getByText(/Done: the buyer's protected tests passed/).waitFor({ timeout: 240000 });
    console.log('Real fixture run completed through the presenter button.');
  }
  await page.getByRole('button', { name: /Reused earlier purchase/ }).first().waitFor();
  const event = page.locator('.events .ev-toggle').first();
  await event.focus();
  await page.keyboard.press('Enter');
  assert.equal(await event.getAttribute('aria-expanded'), 'true');
  await page.locator('.ev-detail').first().waitFor();
  await page.locator('.pay-item').filter({ hasText: 'Settled · testnet' }).first().click();
  const receipt = await page.locator('.pay-detail a').getAttribute('href');
  assert.match(receipt, /^https:\/\/sepolia\.basescan\.org\/tx\/0x[0-9a-f]{64}$/i);
  await axe('live');
  for (const [name, width, height] of [['desktop', 1440, 1000], ['laptop', 1024, 768], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    await overflow();
    await page.screenshot({ path: `${OUT}/${name}-live.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('checkbox', { name: /Show all recent activity/ }).check();
  const failures = page.getByRole('checkbox', { name: /Only denials and failures/ });
  assert.ok(await failures.count(), 'recorded denials are inspectable');
  await failures.first().check();
  const denial = page.locator('.events .ev-denied .ev-toggle').first();
  await denial.click();
  assert.equal(await denial.getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: `${OUT}/denials.png`, fullPage: true });
  await page.getByRole('button', { name: 'Recorded run', exact: true }).click();
  await page.getByText('Recording — not live.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
  const before = await page.locator('.events .event').count();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('.events .event').count(), before, 'pause preserves position');
  const slider = page.getByRole('slider', { name: 'Recording position' });
  await slider.focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('.events .event').count(), 0, 'start of recording has no future events');
  assert.equal(await page.locator('.pay-item').count(), 0, 'start of recording has no future receipts');
  await page.keyboard.press('End');
  await page.getByRole('button', { name: /Reused earlier purchase/ }).first().waitFor();
  await page.getByRole('button', { name: 'Show complete recording', exact: true }).click();
  assert.ok(await page.getByRole('region', { name: 'Agent A · contributor', exact: true }).locator('.event').count() >= 5, 'live failure filters cannot hide recorded contributor events');
  await axe('recording');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/recorded.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await overflow();
  await page.screenshot({ path: `${OUT}/mobile-recorded.png`, fullPage: true });
  await page.route('http://127.0.0.1:3299/health', r => r.fulfill({ status: 503, body: '{}' }));
  await page.getByRole('button', { name: 'Live', exact: true }).click();
  await page.getByText(/Local runner not reachable:/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Run demo', exact: true }).isDisabled(), true);
  await page.screenshot({ path: `${OUT}/disconnected.png`, fullPage: true });
  assert.deepEqual(errors, [], 'browser runtime errors');
  console.log(JSON.stringify({ status: 'passed', receipt, screenshots: OUT, checks: 'presenter, real events, keyboard expansion, payment receipt, failures, replay pause/seek, no future receipts, disconnected runner, responsive widths, WCAG 2.1 AA', runtimeErrors: errors.length }));
} finally { await browser.close(); }
