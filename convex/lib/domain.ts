// Shared, framework-free domain constants. Imported by Convex functions and the browser UI.

export const ROLES = ["contributor", "buyer", "reviewer"] as const;
export type Role = (typeof ROLES)[number];

export const DRAFT_STATUSES = [
  "draft",
  "submitted",
  "changes_requested",
  "rejected",
  "approved",
  "published",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  submitted: "In human review",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  approved: "Reviewer approved — awaiting your final approval",
  published: "Published",
};

/** Draft states in which the contributor may edit content. */
export const EDITABLE_STATUSES: readonly DraftStatus[] = ["draft", "changes_requested"];

export const EVIDENCE_LEVELS = ["contributor_reported", "evidence_reviewed", "test_reproduced"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_INFO: Record<EvidenceLevel, { label: string; explanation: string }> = {
  contributor_reported: {
    label: "Contributor reported",
    explanation: "The contributor states this response helped. No independent check is claimed.",
  },
  evidence_reviewed: {
    label: "Evidence reviewed",
    explanation: "A human reviewer inspected the contributor's supporting evidence.",
  },
  test_reproduced: {
    label: "Test reproduced",
    explanation:
      "The defensive fix passed a safe test against the local demo target or another explicitly authorized target.",
  },
};

export const SECTION_KEYS = ["recognize", "check", "contain", "recover", "verify", "limitations"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_INFO: Record<SectionKey, { title: string; hint: string }> = {
  recognize: { title: "Recognize", hint: "Observable signs that may indicate a similar problem." },
  check: { title: "Check", hint: "Defensive evidence to collect and safe checks to perform." },
  contain: { title: "Contain", hint: "Steps to limit additional harm." },
  recover: { title: "Recover", hint: "Corrective and restoration steps." },
  verify: { title: "Verify", hint: "Checks to confirm the issue is resolved." },
  limitations: {
    title: "Limitations",
    hint: "Where the guidance may not apply, possible side effects, and uncertainty.",
  },
};

/** Sections a buyer can read before paying. Everything else is locked. */
export const FREE_SECTIONS: readonly SectionKey[] = ["recognize", "limitations"];
export const LOCKED_SECTIONS: readonly SectionKey[] = ["check", "contain", "recover", "verify"];

export const SYSTEM_CATEGORIES = [
  "Identity & access",
  "Authentication service",
  "Deployment & CI/CD",
  "Cloud storage",
  "Email & DNS",
  "Network edge",
  "Logging & monitoring",
] as const;

export const SHARING_LEVELS = ["anonymous", "industry_alias"] as const;
export type SharingLevel = (typeof SHARING_LEVELS)[number];
export const SHARING_LABELS: Record<SharingLevel, string> = {
  anonymous: "Anonymous contributor",
  industry_alias: "Industry alias (e.g. “A mid-size SaaS provider”)",
};

export const RELEVANCE_OPTIONS = ["very_relevant", "somewhat_relevant", "not_relevant"] as const;
export const OUTCOME_OPTIONS = ["resolved", "partially_resolved", "not_resolved", "not_tried_yet"] as const;

export const FEEDBACK_LABELS: Record<string, string> = {
  very_relevant: "Very relevant",
  somewhat_relevant: "Somewhat relevant",
  not_relevant: "Not relevant",
  resolved: "Resolved our issue",
  partially_resolved: "Partially resolved",
  not_resolved: "Did not resolve",
  not_tried_yet: "Not tried yet",
};

/** Prototype revenue split. A demo assumption, not finalized commercial policy. */
export const CONTRIBUTOR_SHARE_PERCENT = 80;
export const PLATFORM_SHARE_PERCENT = 20;

export const URGENT_SAFETY_ADVICE = [
  "If you suspect an active compromise, involve your incident response lead or provider now — do not wait for a playbook.",
  "Preserve logs and evidence before making changes, and record what you change and when.",
  "Rotate any credential you believe may be exposed, starting with administrative and service accounts.",
  "Notify affected internal owners and follow your legal and regulatory notification obligations.",
];

export const SHARING_NOTE =
  "Buyers see a pseudonymous alias. The platform privately keeps the source relationship for review and earnings.";
