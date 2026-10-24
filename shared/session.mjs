// Signed demo sessions (HMAC-SHA256). Minted only by local trusted processes (runner/orchestrator)
// that hold DEMO_SESSION_SECRET; verified by Convex. Replaces trusting a bare org slug.
const enc = new TextEncoder();
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
 * kind "operator": minted by the presenter's local runner/orchestrator (may reset demo data and start agent runs).
 * kind "viewer": minted by the hosted deployment for the shared access code (everything else in the demo).
 */
export async function mintSession(secret, slug, ttlMs = 12 * 3600_000, kind = "operator") {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error("bad slug");
  if (kind !== "operator" && kind !== "viewer") throw new Error("bad kind");
  const k = kind === "operator" ? "o" : "v";
  const exp = Date.now() + ttlMs;
  return `ixs2.${slug}.${exp}.${k}.${await hmacHex(secret, `ixs2.${slug}.${exp}.${k}`)}`;
}
/** Returns { slug, operator } if the token is authentic and unexpired, else null. Constant-time compare. */
export async function verifySessionInfo(secret, token) {
  const m = /^ixs2\.([a-z0-9-]{2,40})\.(\d{10,16})\.([ov])\.([0-9a-f]{64})$/.exec(token ?? "");
  if (!m || !secret) return null;
  const [, slug, exp, k, sig] = m;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmacHex(secret, `ixs2.${slug}.${exp}.${k}`);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? { slug, operator: k === "o" } : null;
}
/** Returns the slug if the token is authentic and unexpired, else null. */
export async function verifySession(secret, token) {
  return (await verifySessionInfo(secret, token))?.slug ?? null;
}
