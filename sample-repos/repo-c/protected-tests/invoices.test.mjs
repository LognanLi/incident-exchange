import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCandidate } from "../../harness/remote.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const candidateDir = resolve(here, process.env.CANDIDATE_DIR ?? "../src");

// The candidate runs in a separate, permission-restricted process; the invoice
// table below lives only in this (trusted) process.
function startService(t, db) {
  const remote = spawnCandidate({
    candidateDir,
    candidateFile: join(candidateDir, "invoices.mjs"),
    factory: "createInvoiceService",
    argStyle: "positional",
    deps: { db },
  });
  t.after(() => remote.close());
  return {
    getInvoice: (caller, id) => remote.call("getInvoice", caller, id),
    voidInvoice: (caller, id) => remote.call("voidInvoice", caller, id),
  };
}

function makeDb() {
  const rows = new Map([
    ["inv_1001", { id: "inv_1001", tenantId: "t_acme", customer: "Acme Rockets", amountCents: 125000, status: "open" }],
    ["inv_2001", { id: "inv_2001", tenantId: "t_globex", customer: "Globex Holdings", amountCents: 987600, status: "open" }],
  ]);
  const writes = [];
  return {
    db: {
      async findInvoiceById(id) {
        await Promise.resolve();
        const r = rows.get(id);
        return r ? { ...r } : null;
      },
      async updateInvoiceStatus(id, status) {
        await Promise.resolve();
        writes.push({ id, status });
        const r = rows.get(id);
        if (r) rows.set(id, { ...r, status });
      },
    },
    rows,
    writes,
  };
}

const ACME = { userId: "u_ana", tenantId: "t_acme" };
const GLOBEX = { userId: "u_gus", tenantId: "t_globex" };
const leaks = (value) => /Globex Holdings|987600|t_globex/.test(JSON.stringify(value ?? null));

test("same-tenant read returns the caller's own invoice", async (t) => {
  const { db } = makeDb();
  const s = startService(t, db);
  const r = await s.getInvoice(ACME, "inv_1001");
  assert.equal(r?.ok, true);
  assert.equal(r.invoice.id, "inv_1001");
  assert.equal(r.invoice.customer, "Acme Rockets");
  assert.equal(r.invoice.amountCents, 125000);
});

test("cross-tenant read is denied with not_found and leaks no invoice data", async (t) => {
  const { db } = makeDb();
  const s = startService(t, db);
  const r = await s.getInvoice(ACME, "inv_2001");
  assert.equal(r?.ok, false);
  assert.equal(r.error, "not_found");
  assert.equal(leaks(r), false, "response must not contain another tenant's invoice data");
});

test("another tenant's invoice is indistinguishable from a missing id", async (t) => {
  const { db } = makeDb();
  const s = startService(t, db);
  const foreign = await s.getInvoice(ACME, "inv_2001");
  const missing = await s.getInvoice(ACME, "inv_9999");
  assert.deepEqual(missing, { ok: false, error: "not_found" });
  assert.deepEqual(foreign, missing);
});

test("cross-tenant void is denied and leaves the invoice unchanged", async (t) => {
  const { db, rows, writes } = makeDb();
  const s = startService(t, db);
  const r = await s.voidInvoice(ACME, "inv_2001");
  assert.deepEqual(r, { ok: false, error: "not_found" });
  assert.equal(writes.length, 0, "a denied attempt must not write");
  assert.equal(rows.get("inv_2001").status, "open");
  const owner = await s.getInvoice(GLOBEX, "inv_2001");
  assert.equal(owner?.ok, true);
  assert.equal(owner.invoice.status, "open");
});

test("same-tenant void still works; a missing id is not_found without a write", async (t) => {
  const { db, rows, writes } = makeDb();
  const s = startService(t, db);
  const r = await s.voidInvoice(GLOBEX, "inv_2001");
  assert.equal(r?.ok, true);
  assert.equal(r.invoice.status, "void");
  assert.equal(rows.get("inv_2001").status, "void");
  const missing = await s.voidInvoice(GLOBEX, "inv_nope");
  assert.deepEqual(missing, { ok: false, error: "not_found" });
  assert.equal(writes.length, 1);
});
