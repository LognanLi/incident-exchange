// Builds the web console and publishes it to the Convex deployment's HTTP actions
// (https://<deployment>.convex.site/). Uses the Convex CLI's existing deploy credentials; prints no secrets.
//   node scripts/deploy-web.mjs
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".webp": "image/webp" };
const run = (fn, args = {}) => JSON.parse(execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString().trim() || "null");

const env = Object.fromEntries(readFileSync(join(ROOT, ".env.local"), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const site = env.VITE_CONVEX_SITE_URL?.replace(/\/$/, "");
if (!env.VITE_CONVEX_URL || !site) throw new Error("VITE_CONVEX_URL / VITE_CONVEX_SITE_URL missing from .env.local");

console.log("building…");
execFileSync("npx", ["vite", "build"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });

const files = [];
const walk = (d) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : files.push(join(d, n))));
walk(DIST);
const deployId = randomBytes(6).toString("hex");
for (const f of files) {
  const path = "/" + relative(DIST, f).split(sep).join("/");
  const contentType = TYPES[extname(f)] ?? "application/octet-stream";
  const uploadUrl = run("webHosting:generateUploadUrl");
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: readFileSync(f) });
  if (!res.ok) throw new Error(`upload failed for ${path}: HTTP ${res.status}`);
  const { storageId } = await res.json();
  run("webHosting:recordAsset", { path, storageId, contentType, deployId });
  console.log(`  ${path}`);
}
const { removed } = run("webHosting:pruneExcept", { deployId });
console.log(`published ${files.length} files (${removed} old removed) → ${site}/`);
