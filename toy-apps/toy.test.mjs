import { test } from "node:test";
import assert from "node:assert/strict";
import { CASES } from "./index.mjs";

// "Deny / skip everything" stubs: secure-looking but break legitimate behavior. They must NOT pass.
const STUBS = {
  webhook: { createWebhookService: () => ({ handleDelivery: async () => ({ status: 200, outcome: "duplicate" }) }) },
  tenant: { createExportService: () => ({ getExport: async (s) => (s ? { status: 404 } : { status: 401 }) }) },
  keycache: { createVerifier: () => ({ verify: async () => ({ ok: false, reason: "denied" }) }) },
};

for (const [id, c] of Object.entries(CASES)) {
  test(`${id}: vulnerable fails`, async () => {
    const r = await c.evaluate(c.vulnerable);
    assert.equal(r.passed, false, r.summary);
    assert.ok(r.assertions.some((a) => !a.ok));
  });
  test(`${id}: fixed passes`, async () => {
    const r = await c.evaluate(c.fixed);
    assert.equal(r.passed, true, JSON.stringify(r.assertions.filter((a) => !a.ok)));
  });
  test(`${id}: deny-everything stub fails`, async () => {
    assert.equal((await c.evaluate(STUBS[id])).passed, false);
  });
  test(`${id}: empty / throwing module fails without throwing`, async () => {
    assert.equal((await c.evaluate({})).passed, false);
    assert.equal((await c.evaluate(null)).passed, false);
  });
}

test("keycache: refresh-on-every-request stub fails the rate-limit check", async () => {
  const stub = {
    createVerifier: (ks, o) => ({
      async verify({ kid, signature, body }) {
        const keys = await ks.fetchKeys();
        return keys[kid] && o.mac(keys[kid], body) === signature ? { ok: true, reason: "ok" } : { ok: false, reason: "no" };
      },
    }),
  };
  const r = await CASES.keycache.evaluate(stub);
  assert.equal(r.passed, false);
  assert.deepEqual(r.assertions.filter((a) => !a.ok).map((a) => a.name), ["Key refresh is rate-limited (not on every request)"]);
});

test("webhook: non-atomic has-then-insert fails the concurrency check", async () => {
  const stub = {
    createWebhookService: (store) => ({
      async handleDelivery(e) {
        if (await store.has(e.id)) return { status: 200, outcome: "duplicate" };
        await store.enqueueJob(e);
        await store.insertIfAbsent(e.id);
        return { status: 200, outcome: "enqueued" };
      },
    }),
  };
  const r = await CASES.webhook.evaluate(stub);
  assert.equal(r.passed, false);
  assert.ok(r.assertions.find((a) => a.name.startsWith("Five concurrent")).ok === false);
});
