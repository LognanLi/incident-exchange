import { describe, expect, it } from "vitest";
import { splitRevenue } from "../convex/lib/money";
import { applyGeneralizations, scanForPrivacyIssues } from "../convex/lib/privacy";
import { DEFENSIVE_FIX, MISCONFIGURED, runThrottlingCheck } from "../convex/lib/toyAuth";
import { scorePlaybook } from "../convex/lib/search";
import { NOT_ENOUGH_INFO, answerFromSections } from "../convex/lib/qa";
import { draftSectionsFallback } from "../convex/lib/drafting";
import { NORTHSTAR_DRAFT } from "../convex/lib/seedData";

describe("revenue split", () => {
  it("splits 80/20 in integer minor units that sum to the amount", () => {
    expect(splitRevenue(4900)).toEqual({ contributorShareMinorUnits: 3920, platformShareMinorUnits: 980 });
    for (const amt of [0, 1, 99, 501, 2999, 50000]) {
      const s = splitRevenue(amt);
      expect(s.contributorShareMinorUnits + s.platformShareMinorUnits).toBe(amt);
      expect(Number.isInteger(s.contributorShareMinorUnits)).toBe(true);
    }
  });
  it("rejects non-integer amounts", () => {
    expect(() => splitRevenue(10.5)).toThrow();
    expect(() => splitRevenue(-1)).toThrow();
  });
});

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
    for (const k of ["secret", "email", "ip_address", "hostname", "customer_id", "ticket_id", "org_or_person"]) {
      expect(kinds, k).toContain(k);
    }
  });

  it("generalizes organization and person names differently", () => {
    const out = applyGeneralizations("Priya Raman at Northstar Cloud", terms, orgTerms);
    expect(out).toBe("[name removed] at [the organization]");
  });

  it("never stores the raw match in the excerpt", () => {
    for (const f of scanForPrivacyIssues(fields, terms, orgTerms)) {
      expect(f.excerpt).toContain("•");
      expect(f.excerpt).not.toContain("nsk_live_9fA2kQ7xLm3P");
      expect(f.excerpt).not.toContain("10.24.8.17");
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

describe("toy validation", () => {
  it("fails before the defensive fix", () => {
    const r = runThrottlingCheck(MISCONFIGURED);
    expect(r.passed).toBe(false);
    expect(r.outputLines.some((l) => l.startsWith("FAIL"))).toBe(true);
  });
  it("passes after the defensive fix", () => {
    const r = runThrottlingCheck(DEFENSIVE_FIX);
    expect(r.passed).toBe(true);
    expect(r.outputLines.some((l) => l.startsWith("FAIL"))).toBe(false);
  });
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
