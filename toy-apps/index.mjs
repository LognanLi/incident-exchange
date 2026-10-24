// Registry of toy cases. Static imports only, so this can be bundled by Convex as well as used from Node.
import * as webhookVulnerable from "./webhook/vulnerable.mjs";
import * as webhookFixed from "./webhook/fixed.mjs";
import { evaluate as webhookEvaluate } from "./webhook/evaluate.mjs";
import * as tenantVulnerable from "./tenant/vulnerable.mjs";
import * as tenantFixed from "./tenant/fixed.mjs";
import { evaluate as tenantEvaluate } from "./tenant/evaluate.mjs";
import * as keycacheVulnerable from "./keycache/vulnerable.mjs";
import * as keycacheFixed from "./keycache/fixed.mjs";
import { evaluate as keycacheEvaluate } from "./keycache/evaluate.mjs";

export const CASES = {
  webhook: {
    title: "Duplicate webhook deliveries create duplicate jobs",
    checkName: "Webhook idempotency by event id",
    editableFile: "handler.mjs",
    vulnerable: webhookVulnerable,
    fixed: webhookFixed,
    evaluate: webhookEvaluate,
  },
  tenant: {
    title: "Cross-tenant export read",
    checkName: "Tenant-scoped export authorization",
    editableFile: "handler.mjs",
    vulnerable: tenantVulnerable,
    fixed: tenantFixed,
    evaluate: tenantEvaluate,
  },
  keycache: {
    title: "Signing-key rotation rejects valid events",
    checkName: "Key refresh on unknown kid (rate-limited)",
    editableFile: "handler.mjs",
    vulnerable: keycacheVulnerable,
    fixed: keycacheFixed,
    evaluate: keycacheEvaluate,
  },
};

export const CASE_IDS = Object.keys(CASES);
