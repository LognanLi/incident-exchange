// PROTECTED evaluator for the toy key-rotation case. The candidate module is passed in; never imported here.
// Uses only the documented API: mod.createVerifier(keySource, options) and verifier.verify(event).

// TOY signature function — a deterministic FNV-1a-style string hash. NOT cryptography; demo only.
function toyMac(secret, body) {
  const input = `${secret}|${body}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function makeWorld() {
  let t = 1_000_000;
  let keys = { kid_2026_a: "secret-alpha-FICTIONAL" };
  const world = {
    fetches: 0,
    clock: { now: () => t, advance: (ms) => (t += ms) },
    rotate() {
      keys = { kid_2026_b: "secret-bravo-FICTIONAL" };
    },
    keySource: {
      async fetchKeys() {
        world.fetches += 1;
        return { ...keys };
      },
    },
    sign(kid, secret, body) {
      return { kid, body, signature: toyMac(secret, body) };
    },
  };
  return world;
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
  const create = (w) => {
    if (!mod || typeof mod.createVerifier !== "function") throw new Error("createVerifier is not exported");
    const v = mod.createVerifier(w.keySource, { mac: toyMac, now: w.clock.now, minRefreshIntervalMs: 10_000 });
    if (!v || typeof v.verify !== "function") throw new Error("verifier.verify missing");
    return v;
  };
  const accepted = (r) => !!r && r.ok === true;

  // Shared scenario: valid event before rotation, rotation, valid event with the new kid.
  const w = makeWorld();
  let v = null;
  await check("Valid event signed with the current key is accepted", async () => {
    v = create(w);
    const r = await v.verify(w.sign("kid_2026_a", "secret-alpha-FICTIONAL", '{"event":"payout.created","n":1}'));
    return accepted(r) ? true : `rejected: ${r && r.reason}`;
  });

  await check("After key rotation, valid event signed with the new kid is accepted", async () => {
    if (!v) v = create(w);
    w.rotate();
    w.clock.advance(60_000);
    const r = await v.verify(w.sign("kid_2026_b", "secret-bravo-FICTIONAL", '{"event":"payout.created","n":2}'));
    return accepted(r) ? true : `rejected: ${r && r.reason}`;
  });

  await check("Tampered signature with a valid kid is rejected", async () => {
    const w2 = makeWorld();
    const v2 = create(w2);
    const evt = w2.sign("kid_2026_a", "secret-alpha-FICTIONAL", '{"event":"payout.created","n":3}');
    const r1 = await v2.verify({ ...evt, body: '{"event":"payout.created","n":3000}' });
    const r2 = await v2.verify({ ...evt, signature: "0000000000000000" });
    return !accepted(r1) && !accepted(r2) ? true : "tampered event was accepted";
  });

  await check("Unknown kid is rejected (even after a refresh)", async () => {
    const w3 = makeWorld();
    const v3 = create(w3);
    w3.clock.advance(60_000);
    const r = await v3.verify(w3.sign("kid_attacker_zz", "attacker-secret", '{"event":"payout.created","n":4}'));
    return !accepted(r) ? true : "event with unknown kid was accepted";
  });

  await check("Key refresh is rate-limited (not on every request)", async () => {
    const w4 = makeWorld();
    const v4 = create(w4);
    for (let i = 0; i < 20; i++) {
      await v4.verify(w4.sign(`kid_unknown_${i}`, "attacker-secret", `{"n":${i}}`));
    }
    return w4.fetches <= 2 ? true : `fetchKeys called ${w4.fetches} times for 20 requests in the same instant`;
  });

  const passed = assertions.length > 0 && assertions.every((a) => a.ok === true);
  const okCount = assertions.filter((a) => a.ok === true).length;
  return { passed, summary: `${okCount}/${assertions.length} key-rotation assertions passed`, assertions };
}
