import { describe, expect, it } from "vitest";
import { applyGeneralizations, scanForPrivacyIssues } from "../convex/lib/privacy";
import { CASES } from "../toy-apps/index.mjs";
import { scorePlaybook } from "../convex/lib/search";
import { NOT_ENOUGH_INFO, answerFromSections } from "../convex/lib/qa";
import { draftSectionsFallback } from "../convex/lib/drafting";
import { PRIMARY_DRAFT as NORTHSTAR_DRAFT } from "../convex/lib/scenarios";

describe("privacy scan", () => {
  const orgTerms = ["Northstar Cloud", "Northstar"];
  const terms = NORTHSTAR_DRAFT.identifyingTerms;
  const sections = draftSectionsFallback(NORTHSTAR_DRAFT);
  const fields = {
    sanitizedSummary: NORTHSTAR_DRAFT.sanitizedSummary,
    ...Object.fromEntries(Object.entries(sections).map(([k, s]) => [k, s.body])),
  };

  it("flags the identifiers planted in the seeded Northstar report", () => {
    const kinds = new Set(scanForPrivacyIssues(fields, terms, orgTerms).map((f) => f.kind));
    for (const k of ["email", "hostname", "timestamp", "org_or_person"]) {
      expect(kinds, k).toContain(k);
    }
  });

  it("generalizes organization and person names differently", () => {
    const out = applyGeneralizations("Maya Okafor at Northstar Cloud", terms, orgTerms);
    expect(out).toBe("[name removed] at [the organization]");
  });

  it("never stores the raw match in the excerpt", () => {
    for (const f of scanForPrivacyIssues(fields, terms, orgTerms)) {
      expect(f.excerpt).toContain("•");
      expect(f.excerpt).not.toContain("ops@northstar.example");
      expect(f.excerpt).not.toContain("hooks.internal.northstar.example");
    }
  });

  it("leaves no findings after applying generalizations", () => {
    const cleaned = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, applyGeneralizations(v, terms, orgTerms)]));
    expect(scanForPrivacyIssues(cleaned, terms, orgTerms)).toEqual([]);
  });

  it("does not flag standard references like CVE or SHA-256", () => {
    expect(scanForPrivacyIssues({ x: "See CVE-2024-1234 and use SHA-256 per NIST SP 800-63B." })).toEqual([]);
  });
});

describe("toy validation (protected evaluators)", () => {
  for (const id of ["webhook", "tenant", "keycache"] as const) {
    it(`${id}: fails before the defensive fix and passes after, including legitimate behavior`, async () => {
      const c = CASES[id];
      expect((await c.evaluate(c.vulnerable)).passed).toBe(false);
      const fixed = await c.evaluate(c.fixed);
      expect(fixed.passed).toBe(true);
      expect(fixed.assertions.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe("search", () => {
  const auth = {
    publicTitle: "Investigating repeated authentication failures after a deployment",
    publicSummary: "A test login service produced repeated authentication failures after an update.",
    recognize: "- Failed-login count jumped after the deployment.",
    systemCategories: ["Authentication service"],
  };
  const email = {
    publicTitle: "Spike in outbound email bounces after a DNS change",
    publicSummary: "Bounce rates rose after a DNS migration.",
    recognize: "- Bounce messages mention sender authentication failures.",
    systemCategories: ["Email & DNS"],
  };
  it("ranks the matching playbook first with a plain-language reason", () => {
    const q = "repeated authentication failures after a deployment";
    const a = scorePlaybook(q, auth);
    const e = scorePlaybook(q, email);
    expect(a.score).toBeGreaterThan(e.score * 2);
    expect(a.reason).toMatch(/Matched \d of your \d key terms/);
  });
  it("treats synonyms as matches", () => {
    expect(scorePlaybook("login errors after release", auth).score).toBeGreaterThan(0);
  });
});

describe("grounded Q&A", () => {
  const sections = { verify: "- Run the lockout test for a test account.\n- Confirm an alert fires.", recognize: "- Repeated failures." };
  it("cites sections when supported", () => {
    const r = answerFromSections("How do I run the lockout test?", sections);
    expect(r.grounded).toBe(true);
    expect(r.citations[0].section).toBe("verify");
  });
  it("says so when the playbook does not cover the question", () => {
    expect(answerFromSections("What database vendor should we buy?", sections).answer).toBe(NOT_ENOUGH_INFO);
  });
});
