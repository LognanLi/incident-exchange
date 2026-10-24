// Shared contract for seeded incident scenarios (polish sprint). Content lives in scenarios.ts.
// All organizations, people, hosts, and outcomes are FICTIONAL demonstration content.

import type { EvidenceLevel } from "./domain";

/** Money is stored as integer atomic units of a token. USDC has 6 decimals: "500000" = 0.50 USDC. */
export type Price = { amountAtomic: string; currency: "USDC"; decimals: 6 };

export type ToyCase = "webhook" | "tenant" | "keycache";

export type Clue = {
  id: string;
  /** Short buyer-facing label, e.g. "Same webhook event ID creates two jobs". */
  label: string;
  /** Lowercase words/phrases that indicate this clue in a buyer's description. */
  terms: string[];
  /** Key clues drive "Strong overlap"; supporting clues add context. */
  weight: "key" | "supporting";
};

export type MismatchSignal = {
  id: string;
  label: string;
  terms: string[];
  /** Why this guide may NOT apply when the signal is present. */
  explanation: string;
};

export type GuideSections = {
  recognize: string; // free preview
  check: string; // paid
  contain: string; // paid
  recover: string; // paid
  verify: string; // paid
  limitations: string; // free preview
};

export type ScenarioGuide = {
  key: string;
  family: "webhook_idempotency" | "tenant_export_authz" | "signing_key_cache";
  contributorSlug: "northstar" | "cobalt" | "juniper";
  publicTitle: string;
  publicSummary: string;
  systemCategories: string[];
  environment: string[];
  clues: Clue[];
  mismatchSignals: MismatchSignal[];
  /** Free applicability checklist: what to confirm before relying on this guide. */
  checksBeforeUse: string[];
  /** Exactly what the evidence covers, e.g. "Reproduced in a toy webhook service; not tested on buyer systems." */
  evidenceScope: string;
  sections: GuideSections;
  /** Paid: what the contributor tried that did not work, and why. Bullet list ("- ..."). */
  failedAttempts: string;
  evidenceLevel: EvidenceLevel;
  price: Price;
  toyCase?: ToyCase;
  publishedDaysAgo: number;
};

/** The primary case is seeded as a contributor DRAFT (not published) so the demo can walk the full lifecycle. */
export type PrimaryDraftSeed = {
  title: string;
  publicTitle: string;
  sanitizedSummary: string;
  systemCategories: string[];
  environment: string[];
  privateNotes: string;
  evidenceSummary: string;
  identifyingTerms: string[];
  symptoms: string;
  detectionClues: string;
  attemptedActions: string;
  failedAttempts: string;
  containmentSteps: string;
  recoverySteps: string;
  verificationSteps: string;
  limitations: string;
  clues: Clue[];
  mismatchSignals: MismatchSignal[];
  checksBeforeUse: string[];
  evidenceScope: string;
  price: Price;
  toyCase: ToyCase;
};
