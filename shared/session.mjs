// Signed demo sessions (HMAC-SHA256). Minted only by local trusted processes (runner/orchestrator)
// that hold DEMO_SESSION_SECRET; verified by Convex. Replaces trusting a bare org slug.
const enc = new TextEncoder();
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function mintSession(secret, slug, ttlMs = 12 * 3600_000) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) throw new Error("bad slug");
  const exp = Date.now() + ttlMs;
  return `ixs1.${slug}.${exp}.${await hmacHex(secret, `ixs1.${slug}.${exp}`)}`;
}
/** Returns the slug if the token is authentic and unexpired, else null. Constant-time compare. */
export async function verifySession(secret, token) {
  const m = /^ixs1\.([a-z0-9-]{2,40})\.(\d{10,16})\.([0-9a-f]{64})$/.exec(token ?? "");
  if (!m || !secret) return null;
  const [, slug, exp, sig] = m;
  if (Number(exp) < Date.now()) return null;
  const expected = await hmacHex(secret, `ixs1.${slug}.${exp}`);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? slug : null;
}
