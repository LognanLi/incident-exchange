import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const candidateDir = resolve(here, process.env.CANDIDATE_DIR ?? "../src");
const { makeConsumer } = await import(
  pathToFileURL(join(candidateDir, "consumer", "messageConsumer.mjs")).href
);

function makeDeps({ failPushTimes = 0 } = {}) {
  const tasks = [];
  const claimed = new Set();
  let failuresLeft = failPushTimes;
  const ledger = {
    async claim(id) {
      // Atomic: check-and-set happens synchronously before any await.
      if (claimed.has(id)) return false;
      claimed.add(id);
      await Promise.resolve();
      return true;
    },
    async unclaim(id) {
      claimed.delete(id);
    },
  };
  const queue = {
    async push(task) {
      await Promise.resolve();
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("simulated transient queue failure");
      }
      tasks.push(task);
    },
    async size() {
      return tasks.length;
    },
  };
  return { ledger, queue };
}

const msg = (messageId) => ({ messageId, kind: "order.created", body: { orderId: "ord_9", total: 1999 } });

test("same message delivered twice queues exactly one task", async () => {
  const deps = makeDeps();
  const c = makeConsumer(deps);
  await c.onMessage(msg("m_1"));
  await c.onMessage(msg("m_1"));
  assert.equal(await deps.queue.size(), 1);
});

test("two different message ids queue two tasks", async () => {
  const deps = makeDeps();
  const c = makeConsumer(deps);
  await c.onMessage(msg("m_1"));
  await c.onMessage(msg("m_2"));
  assert.equal(await deps.queue.size(), 2);
});

test("five concurrent deliveries of the same message queue one task", async () => {
  const deps = makeDeps();
  const c = makeConsumer(deps);
  await Promise.all(Array.from({ length: 5 }, () => c.onMessage(msg("m_c"))));
  assert.equal(await deps.queue.size(), 1);
});

test("failed first attempt does not swallow a legitimate redelivery", async () => {
  const deps = makeDeps({ failPushTimes: 1 });
  const c = makeConsumer(deps);
  await assert.rejects(() => c.onMessage(msg("m_r")));
  await c.onMessage(msg("m_r"));
  assert.equal(await deps.queue.size(), 1);
});

test("every successful delivery is acknowledged", async () => {
  const deps = makeDeps();
  const c = makeConsumer(deps);
  const results = [
    await c.onMessage(msg("m_a")),
    await c.onMessage(msg("m_a")),
    await c.onMessage(msg("m_b")),
  ];
  for (const r of results) assert.equal(r?.ack, true);
  assert.deepEqual(results.map((r) => r.result), ["queued", "skipped_duplicate", "queued"]);
});
