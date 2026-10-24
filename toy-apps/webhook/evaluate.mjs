// PROTECTED evaluator for the toy webhook case. The candidate module is passed in; never imported here.
// Uses only the documented API: mod.createWebhookService(store) and service.handleDelivery(event).
//
// The store yields (microtasks) inside every call, so a non-atomic "has() then insert" check races
// under concurrent deliveries — only the atomic insertIfAbsent is safe.

// Microtask-only yield (no timers), so this also runs inside Convex queries/mutations.
const tick = async () => {
  for (let i = 0; i < 3; i++) await null;
};

function makeStore() {
  const keys = new Set();
  const jobs = [];
  return {
    jobs,
    async insertIfAbsent(key) {
      const k = String(key);
      const isNew = !keys.has(k);
      if (isNew) keys.add(k);
      await tick();
      return isNew;
    },
    async has(key) {
      await tick();
      return keys.has(String(key));
    },
    async enqueueJob(job) {
      await tick();
      jobs.push(job && typeof job === "object" ? { id: job.id, type: job.type } : { id: undefined });
    },
  };
}

function event(id) {
  return { id, type: "invoice.paid", payload: { invoice: `inv_${id}`, amount: 1200 } };
}

export async function evaluate(mod) {
  const assertions = [];
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      assertions.push({ name, ok: detail === true, detail: detail === true ? "ok" : String(detail) });
    } catch (e) {
      assertions.push({ name, ok: false, detail: `threw: ${String(e && e.message ? e.message : e).slice(0, 160)}` });
    }
  };
  const create = (store) => {
    if (!mod || typeof mod.createWebhookService !== "function") throw new Error("createWebhookService is not exported");
    const svc = mod.createWebhookService(store);
    if (!svc || typeof svc.handleDelivery !== "function") throw new Error("service.handleDelivery missing");
    return svc;
  };
  const acked = (r) => r && r.status === 200;

  await check("Same event delivered twice creates exactly one job", async () => {
    const store = makeStore();
    const svc = create(store);
    await svc.handleDelivery(event("evt_1001"));
    await svc.handleDelivery(event("evt_1001"));
    const n = store.jobs.filter((j) => j.id === "evt_1001").length;
    return store.jobs.length === 1 && n === 1 ? true : `expected 1 job, got ${store.jobs.length}`;
  });

  await check("Two different events create two jobs (legitimate deliveries still processed)", async () => {
    const store = makeStore();
    const svc = create(store);
    await svc.handleDelivery(event("evt_2001"));
    await svc.handleDelivery(event("evt_2002"));
    const ids = store.jobs.map((j) => j.id).sort().join(",");
    return ids === "evt_2001,evt_2002" ? true : `expected jobs evt_2001,evt_2002, got [${ids}]`;
  });

  await check("Five concurrent duplicate deliveries create one job", async () => {
    const store = makeStore();
    const svc = create(store);
    await Promise.all([1, 2, 3, 4, 5].map(() => svc.handleDelivery(event("evt_3001"))));
    return store.jobs.length === 1 ? true : `expected 1 job, got ${store.jobs.length}`;
  });

  await check("Redelivery after restart (new service, same store) creates no new job", async () => {
    const store = makeStore();
    await create(store).handleDelivery(event("evt_4001"));
    await create(store).handleDelivery(event("evt_4001"));
    return store.jobs.length === 1 ? true : `expected 1 job, got ${store.jobs.length}`;
  });

  await check("Every delivery is acknowledged with 200", async () => {
    const store = makeStore();
    const svc = create(store);
    const rs = [];
    rs.push(await svc.handleDelivery(event("evt_5001")));
    rs.push(await svc.handleDelivery(event("evt_5001")));
    rs.push(await svc.handleDelivery(event("evt_5002")));
    const bad = rs.filter((r) => !acked(r)).length;
    return bad === 0 ? true : `${bad} of ${rs.length} deliveries not acknowledged with 200`;
  });

  const passed = assertions.length > 0 && assertions.every((a) => a.ok === true);
  const okCount = assertions.filter((a) => a.ok === true).length;
  return { passed, summary: `${okCount}/${assertions.length} webhook assertions passed`, assertions };
}
