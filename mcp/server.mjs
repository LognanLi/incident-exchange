// Incident Exchange MCP service — Streamable HTTP (official @modelcontextprotocol/sdk v1).
// Auth: bearer agent token (dev service-token mode; hashed and scope-checked in Convex).
// The service holds MCP_SERVICE_SECRET; agents never receive backend admin keys.
import http from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildServer as buildToolServer } from "./tools.mjs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.MCP_PORT ?? 8787);
const MAX_BODY = 64 * 1024;
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const RATE = { windowMs: 60_000, max: 120 };

const readEnv = (f) =>
  existsSync(f)
    ? Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]))
    : {};
const secrets = readEnv(join(ROOT, ".secrets.local"));
const local = readEnv(join(ROOT, ".env.local"));
const SVC = process.env.MCP_SERVICE_SECRET ?? secrets.MCP_SERVICE_SECRET;
const CONVEX_URL = process.env.VITE_CONVEX_URL ?? local.VITE_CONVEX_URL;
if (!SVC || !CONVEX_URL) {
  console.error("MCP service not configured: run `npm run agents:setup` first.");
  process.exit(1);
}
const convex = new ConvexHttpClient(CONVEX_URL);
const hits = new Map(); // per authenticated token hash → recent request times
let authFailures = []; // global: bounds credential guessing and Convex load from unauthenticated callers
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of hits) if (!ts.some((t) => now - t < RATE.windowMs)) hits.delete(k);
}, RATE.windowMs).unref();

function buildServer(token) {
  const exec = (kind, fn, args) => (kind === "query" ? convex.query(fn, args) : kind === "mutation" ? convex.mutation(fn, args) : convex.action(fn, args));
  return buildToolServer({ token, svc: SVC, exec, deployment: "local" });
}

function deny(res, status, code, message, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...extra });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: `${code}: ${message}` }, id: null }));
}

const httpServer = http.createServer(async (req, res) => {
  if (req.url !== "/mcp") return deny(res, 404, "NOT_FOUND", "Use /mcp.");
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return deny(res, 403, "FORBIDDEN", "Origin not allowed.");
  if (req.method !== "POST") return deny(res, 405, "METHOD_NOT_ALLOWED", "Stateless server: POST only.", { Allow: "POST" });
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return deny(res, 401, "AUTH_REQUIRED", "Bearer agent token required.", { "WWW-Authenticate": 'Bearer realm="incident-exchange"' });
  if (!String(req.headers["content-type"] ?? "").includes("application/json")) return deny(res, 415, "INVALID_INPUT", "Content-Type must be application/json.");

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) return deny(res, 413, "INVALID_INPUT", "Request too large.");
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return deny(res, 400, "INVALID_INPUT", "Invalid JSON.");
  }
  const now = Date.now();
  authFailures = authFailures.filter((t) => now - t < RATE.windowMs);
  if (authFailures.length >= 30) return deny(res, 429, "RATE_LIMITED", "Too many failed authentications; retry shortly.", { "Retry-After": "60" });
  const authed = await convex.query(anyApi.mcp.authCheck, { svc: SVC, token }).catch(() => ({ ok: false }));
  if (!authed.ok) authFailures.push(now);
  // Per-token limit applies only after authentication, so unknown tokens can't grow the map.
  const key = createHash("sha256").update(token).digest("hex").slice(0, 16);
  const recent = authed.ok ? (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs) : [];
  if (authed.ok && recent.length >= RATE.max) return deny(res, 429, "RATE_LIMITED", "Too many requests; retry shortly.", { "Retry-After": "30" });
  if (authed.ok) hits.set(key, [...recent, now]);
  if (!authed.ok) return deny(res, 401, "AUTH_REQUIRED", "Invalid, expired, or revoked agent credential.", { "WWW-Authenticate": 'Bearer realm="incident-exchange", error="invalid_token"' });
  const server = buildServer(token);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
});

httpServer.listen(PORT, "127.0.0.1", () => console.log(`Incident Exchange MCP (Streamable HTTP) on http://127.0.0.1:${PORT}/mcp`));
