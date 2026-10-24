// All organizations, people, hosts, and incidents are FICTIONAL demo content. Scenario text lives in scenarios.ts.

import type { Role } from "./domain";

export type SeedOrg = { slug: string; displayName: string; publicAlias: string; demoRole: Role; description: string; verified?: boolean; verifiedDomain?: string };

export const SEED_ORGS: SeedOrg[] = [
  { slug: "northstar", displayName: "Northstar Cloud", publicAlias: "B2B software team", demoRole: "contributor", description: "Fictional B2B software provider. Contributes the duplicate-jobs-after-webhook-retries incident." },
  { slug: "harbor", displayName: "Harbor Analytics", publicAlias: "An analytics company", demoRole: "buyer", description: "Fictional buyer running a webhook-driven workflow; on call for a confusing incident.", verified: true, verifiedDomain: "harbor-analytics.example" },
  { slug: "review-desk", displayName: "Incident Exchange Review Desk", publicAlias: "Incident Exchange reviewer", demoRole: "reviewer", description: "Fictional human review team that inspects evidence before publication." },
  { slug: "cobalt", displayName: "Cobalt Retail Systems", publicAlias: "Retail platform team", demoRole: "contributor", description: "Fictional contributor of catalog guides." },
  { slug: "juniper", displayName: "Juniper Ledger", publicAlias: "Fintech SaaS team", demoRole: "contributor", description: "Fictional contributor of catalog guides." },
];

export const TOY_AUTHORIZATION_NOTE =
  "Bundled with this repository (toy-apps/). Runs in-process with synthetic data only. No network, real systems, or customer data are touched.";
