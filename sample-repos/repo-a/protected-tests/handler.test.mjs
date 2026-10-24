import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const candidateDir = resolve(here, process.env.CANDIDATE_DIR ?? "../src");
const { createEventHandler } = await import(
  pathToFileURL(join(candidateDir, "handler.mjs")).href
);

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

test("same event delivered twice creates exactly one job", async () => {
  const store = makeStore();
  const h = createEventHandler(store);
  await h.handle(evt("evt_1"));
  await h.handle(evt("evt_1"));
  assert.equal((await store.listJobs()).length, 1);
});

test("two different event ids create two jobs", async () => {
  const store = makeStore();
  const h = createEventHandler(store);
  await h.handle(evt("evt_1"));
  await h.handle(evt("evt_2"));
  assert.equal((await store.listJobs()).length, 2);
});

test("five concurrent deliveries of the same event create one job", async () => {
  const store = makeStore();
  const h = createEventHandler(store);
  await Promise.all(Array.from({ length: 5 }, () => h.handle(evt("evt_c"))));
  assert.equal((await store.listJobs()).length, 1);
});

test("failed first attempt does not swallow a legitimate retry", async () => {
  const store = makeStore({ failInsertTimes: 1 });
  const h = createEventHandler(store);
  await assert.rejects(() => h.handle(evt("evt_r")));
  await h.handle(evt("evt_r"));
  assert.equal((await store.listJobs()).length, 1);
});

test("every successful delivery is acknowledged with status 200", async () => {
  const store = makeStore();
  const h = createEventHandler(store);
  const results = [
    await h.handle(evt("evt_a")),
    await h.handle(evt("evt_a")),
    await h.handle(evt("evt_b")),
  ];
  for (const r of results) assert.equal(r?.status, 200);
});
