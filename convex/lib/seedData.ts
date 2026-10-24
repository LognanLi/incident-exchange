// All organizations, people, hosts, and incidents below are FICTIONAL demo content.
// Identifiers in Northstar's notes are deliberately planted so the privacy scan has something to catch.

import type { EvidenceLevel, Role } from "./domain";

export type SeedOrg = {
  slug: string;
  displayName: string;
  publicAlias: string;
  demoRole: Role;
  description: string;
};

export const SEED_ORGS: SeedOrg[] = [
  {
    slug: "northstar",
    displayName: "Northstar Cloud",
    publicAlias: "A mid-size SaaS provider",
    demoRole: "contributor",
    description: "Fictional software provider. Contributes the seeded authentication-failure incident.",
  },
  {
    slug: "harbor",
    displayName: "Harbor Analytics",
    publicAlias: "An analytics company",
    demoRole: "buyer",
    description: "Fictional buyer seeing repeated authentication failures after a deployment.",
  },
  {
    slug: "review-desk",
    displayName: "Incident Exchange Review Desk",
    publicAlias: "Incident Exchange reviewer",
    demoRole: "reviewer",
    description: "Fictional human review team that inspects evidence before publication.",
  },
  {
    slug: "cobalt",
    displayName: "Cobalt Retail Systems",
    publicAlias: "A retail technology company",
    demoRole: "contributor",
    description: "Fictional contributor of background catalog playbooks.",
  },
];

export const NORTHSTAR_DRAFT = {
  identifyingTerms: ["Dana Whitfield", "Priya Raman"],
  sharingLevel: "industry_alias" as const,
  title: "Login service failures after the 4.12 release",
  publicTitle: "Investigating repeated authentication failures after a deployment",
  sanitizedSummary:
    "After a routine update, a test login service at Northstar Cloud began producing repeated authentication failures. The team traced it to an unsafe configuration that disabled failed-attempt lockout, corrected it, and verified expected behavior.",
  systemCategories: ["Authentication service", "Deployment & CI/CD", "Identity & access"],
  privateNotes:
    "On-call (Dana Whitfield) paged at 2026-03-14 02:10 UTC. Ticket NSC-4471. Host auth-staging.northstar.internal (10.24.8.17) showed thousands of failed logins for acct_88231. Config diff from release 4.12 reset max_failed_attempts to 0. Escalated to ops@northstarcloud.example. Temporary service key nsk_live_9fA2kQ7xLm3P was rotated afterwards.",
  evidenceSummary:
    "Redacted auth log excerpt (counts per minute before and after fix), config diff from the release, and the passing lockout test output from staging.",
  symptoms:
    "Repeated authentication failures on auth-staging.northstar.internal right after the 4.12 deployment.\nFailed-login count jumped from a normal baseline to thousands per hour for a single account (acct_88231).\nNo lockout or alert fired even though the failures continued for hours.",
  detectionClues:
    "Auth logs from 10.24.8.17 showed the same account failing every few seconds.\nThe deployed config diff showed max_failed_attempts changed from 5 to 0.\nThe alerting rule for repeated failures had no matching events.",
  attemptedActions:
    "Compare the deployed authentication configuration with the last known-good version.\nConfirm whether failed-attempt lockout and alerting are enabled.\nReview recent deployment change logs for configuration resets; ticket NSC-4471 has the timeline.",
  containmentSteps:
    "Temporarily enable rate limiting at the edge for the login endpoint.\nPriya Raman rotated the service key nsk_live_9fA2kQ7xLm3P and any credentials that may have been exposed.\nNotify the account owner and ops@northstarcloud.example.",
  recoverySteps:
    "Restore max_failed_attempts to 5 with a 15-minute lockout window.\nRe-enable the repeated-failure alert.\nAdd a deployment check that blocks releases where lockout is disabled.",
  verificationSteps:
    "Run the lockout test: repeated failed logins for a test account must be throttled after 5 attempts.\nConfirm an alert fires for the repeated failures.\nWatch failed-login rates for 24 hours to confirm they return to baseline.",
  limitations:
    "Applies to services with configurable failed-attempt lockout.\nAggressive lockout can lock out legitimate users; pair it with self-service recovery.\nThe failure burst may have a different cause in your environment, such as a broken client or expired certificate.",
  priceMinorUnits: 4900,
  currency: "USD",
};

export type SeedPlaybook = {
  contributorSlug: string;
  publicTitle: string;
  publicSummary: string;
  publicSteps: { recognize: string; check: string; contain: string; recover: string; verify: string };
  publicLimitations: string;
  systemCategories: string[];
  evidenceLevel: EvidenceLevel;
  priceMinorUnits: number;
};

export const CATALOG_PLAYBOOKS: SeedPlaybook[] = [
  {
    contributorSlug: "cobalt",
    publicTitle: "Users report unexpected MFA push prompts",
    publicSummary:
      "Several employees received multi-factor push prompts they did not initiate. The team confirmed which accounts were affected, reset credentials, and switched to number-matching prompts.",
    publicSteps: {
      recognize:
        "- Employees report MFA push prompts they did not start.\n- Identity provider logs show password successes followed by denied MFA prompts.",
      check:
        "- Review identity provider sign-in logs for accounts with denied prompts.\n- Check whether the password step succeeded before each prompt.",
      contain:
        "- Reset passwords for affected accounts.\n- Temporarily require number-matching or phishing-resistant MFA for those accounts.",
      recover:
        "- Enable number matching for all push-based MFA.\n- Brief employees on reporting unexpected prompts.",
      verify:
        "- Confirm no further unexpected prompts over 7 days.\n- Verify new sign-ins require number matching.",
    },
    publicLimitations:
      "- Assumes a push-based MFA provider that supports number matching.\n- Unexpected prompts can also come from stale sessions on old devices.",
    systemCategories: ["Identity & access"],
    evidenceLevel: "evidence_reviewed",
    priceMinorUnits: 3500,
  },
  {
    contributorSlug: "cobalt",
    publicTitle: "Spike in outbound email bounces after a DNS change",
    publicSummary:
      "After a DNS migration, outbound mail bounce rates rose sharply. The team found a missing sender-authentication record and restored it.",
    publicSteps: {
      recognize:
        "- Bounce rate rises sharply shortly after a DNS change.\n- Bounce messages mention sender authentication failures.",
      check:
        "- Compare current DNS records with the pre-migration export.\n- Check sender authentication records for the sending domain.",
      contain: "- Pause bulk sends until authentication records are corrected.",
      recover: "- Restore the missing sender authentication record.\n- Re-send critical transactional mail.",
      verify: "- Confirm bounce rates return to baseline.\n- Validate records with your mail provider's checker.",
    },
    publicLimitations:
      "- Only applies when bounces cite authentication failures.\n- DNS propagation delays may hide the fix for several hours.",
    systemCategories: ["Email & DNS"],
    evidenceLevel: "contributor_reported",
    priceMinorUnits: 2900,
  },
  {
    contributorSlug: "cobalt",
    publicTitle: "Storage bucket listing exposed after an infrastructure refactor",
    publicSummary:
      "An infrastructure-as-code refactor dropped a block-public-access setting. The team detected public listing, restored the setting, and reviewed access logs.",
    publicSteps: {
      recognize:
        "- A storage bucket's contents can be listed without credentials.\n- An infrastructure refactor recently touched storage policies.",
      check:
        "- Review the bucket's public-access settings and policy.\n- Check access logs for anonymous list requests.",
      contain: "- Re-enable block-public-access for the bucket immediately.",
      recover:
        "- Restore the setting in infrastructure code so it cannot drift again.\n- Assess whether exposed objects contained sensitive data.",
      verify:
        "- Confirm anonymous listing is denied.\n- Add a policy check in CI that fails on public buckets.",
    },
    publicLimitations:
      "- Provider-specific setting names differ.\n- Access logs may not have been enabled before the incident.",
    systemCategories: ["Cloud storage", "Deployment & CI/CD"],
    evidenceLevel: "contributor_reported",
    priceMinorUnits: 3900,
  },
];

export const TOY_TARGET = {
  slug: "toy-auth",
  name: "Local demo login service (toy-auth)",
  authorizationNote:
    "Bundled with this repository for demonstration. Runs in-process with a fictional account only. No network or real systems are touched.",
};
