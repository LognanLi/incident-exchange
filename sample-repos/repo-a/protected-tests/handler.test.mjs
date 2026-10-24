import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnCandidate } from "../../harness/remote.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const candidateDir = resolve(here, process.env.CANDIDATE_DIR ?? "../src");

// The candidate runs in a separate, permission-restricted process; the store
// below lives only in this (trusted) process.
function startHandler(t, store) {
  const remote = spawnCandidate({
    candidateDir,
    candidateFile: join(candidateDir, "handler.mjs"),
    factory: "createEventHandler",
    argStyle: "positional",
    deps: { store },
  });
  t.after(() => remote.close());
  return { handle: (event) => remote.call("handle", event) };
}

function makeStore({ failInsertTimes = 0 } = {}) {
  const jobs = [];
  const reserved = new Set();
  let failuresLeft = failInsertTimes;
  return {
    async insertJob(job) {
      await Promise.resolve();
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("simulated transient database failure");
      }
      jobs.push(job);
    },
    async reserve(key) {
      // Atomic: check-and-set happens synchronously before any await.
      if (reserved.has(key)) return false;
      reserved.add(key);
      await Promise.resolve();
      return true;
    },
    async release(key) {
      reserved.delete(key);
    },
    async listJobs() {
      return [...jobs];
    },
  };
}

const evt = (id) => ({ id, type: "invoice.paid", payload: { amount: 4200 } });

test("same event delivered twice creates exactly one job", async (t) => {
  const store = makeStore();
  const h = startHandler(t, store);
  await h.handle(evt("evt_1"));
  await h.handle(evt("evt_1"));
  assert.equal((await store.listJobs()).length, 1);
});

test("two different event ids create two jobs", async (t) => {
  const store = makeStore();
  const h = startHandler(t, store);
  await h.handle(evt("evt_1"));
  await h.handle(evt("evt_2"));
  assert.equal((await store.listJobs()).length, 2);
});

test("five concurrent deliveries of the same event create one job", async (t) => {
  const store = makeStore();
  const h = startHandler(t, store);
  await Promise.all(Array.from({ length: 5 }, () => h.handle(evt("evt_c"))));
  assert.equal((await store.listJobs()).length, 1);
});

test("failed first attempt does not swallow a legitimate retry", async (t) => {
  const store = makeStore({ failInsertTimes: 1 });
  const h = startHandler(t, store);
  await assert.rejects(() => h.handle(evt("evt_r")));
  await h.handle(evt("evt_r"));
  assert.equal((await store.listJobs()).length, 1);
});

test("every successful delivery is acknowledged with status 200", async (t) => {
  const store = makeStore();
  const h = startHandler(t, store);
  const results = [
    await h.handle(evt("evt_a")),
    await h.handle(evt("evt_a")),
    await h.handle(evt("evt_b")),
  ];
  for (const r of results) assert.equal(r?.status, 200);
});
