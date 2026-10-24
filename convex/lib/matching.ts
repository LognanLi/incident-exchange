// Explainable symptom matching. Candidates qualify only by overlap between the buyer's described
// symptoms/environment and a guide's observable clues — never by price or platform fee.
// Labels are discovery aids, not calibrated probabilities that incidents share a cause.

import type { Clue, MismatchSignal } from "./scenarioTypes";
import { scorePlaybook, tokenize } from "./search";

export type RelevanceLabel = "strong_overlap" | "some_overlap" | "needs_evidence";

export const RELEVANCE_INFO: Record<RelevanceLabel, { label: string; explanation: string }> = {
  strong_overlap: { label: "Strong overlap", explanation: "A key symptom plus corroborating detail you described match this case, and nothing you said contradicts it." },
  some_overlap: { label: "Some overlap", explanation: "Part of what you described matches. Confirm the missing checks before relying on it." },
  needs_evidence: { label: "Needs more evidence", explanation: "Weak or conflicting overlap. Read the mismatch notes before using this guide." },
};

export type MatchableGuide = {
  publicTitle: string;
  publicSummary: string;
  recognize: string;
  systemCategories: string[];
  environment: string[];
  clues: Clue[];
  mismatchSignals: MismatchSignal[];
};

export type GuideMatch = {
  matchedClues: string[];
  conflictingClues: { label: string; explanation: string }[];
  missingChecks: string[];
  relevanceLabel: RelevanceLabel;
  score: number;
};

const NEGATORS = new Set(["no", "not", "without", "never", "none", "nor", "isn't", "aren't", "doesn't", "don't", "didn't", "wasn't", "weren't"]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Words of the query, each flagged if it falls within 3 words after a negator ("without repeated event ids"). */
function analyze(query: string): { words: string[]; negated: boolean[] } {
  const words = normalize(query).split(" ").filter(Boolean);
  const negated = words.map(() => false);
  words.forEach((w, i) => {
    if (NEGATORS.has(w)) for (let j = i + 1; j <= i + 3 && j < words.length; j++) negated[j] = true;
  });
  return { words, negated };
}

// Small domain synonym table so paraphrases ("outside their workspace", "identical event IDs") still match.
const CANON: Record<string, string> = {
  another: "other", outside: "other", different: "other", foreign: "other", someone: "other",
  tenant: "workspace", tenants: "workspace", org: "workspace", organization: "workspace", account: "workspace",
  identical: "duplicate", same: "duplicate", twice: "duplicate", duplicated: "duplicate", double: "duplicate", repeated: "duplicate",
  retried: "retry", retrie: "retry", retrying: "retry", redelivery: "retry", redelivered: "retry", resend: "retry", resent: "retry",
  rotation: "rotate", rotated: "rotating", rejected: "reject", rejecting: "reject", rejection: "reject",
  restarted: "restart", restarting: "restart", reboot: "restart", fills: "fill", filling: "fill", backlog: "queue", backed: "queue",
  see: "view", seeing: "view", visible: "view", read: "view", download: "export", downloads: "export", exported: "export",
  signed: "signature", signing: "signature", sig: "signature", key: "key", keys: "key", kid: "key",
};
const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are", "was", "were", "be", "it", "its", "their", "our", "we", "they", "after", "before", "from", "at", "by", "can", "that", "this", "s"]);

function canon(word: string): string {
  const w = word.replace(/'s$/, "");
  if (CANON[w]) return CANON[w];
  const stemmed = w.replace(/(ies|es|s)$/, "");
  return CANON[stemmed] ?? stemmed;
}

/**
 * A term matches when all of its content words appear (synonym-normalized, any order) in the query
 * outside a negated span. Single-word terms must match a non-negated query word.
 */
function termMatches(term: string, q: { words: string[]; negated: boolean[] }): boolean {
  const parts = normalize(term).split(" ").filter((w) => w && !STOP.has(w)).map(canon);
  if (parts.length === 0) return false;
  const available = new Set(q.words.filter((_, i) => !q.negated[i]).map(canon));
  return parts.every((p) => available.has(p));
}

function signalMatched(terms: string[], q: { words: string[]; negated: boolean[] }): boolean {
  return terms.some((t) => termMatches(t, q));
}

export function matchGuide(query: string, guide: MatchableGuide): GuideMatch | null {
  const q = analyze(query);
  if (q.words.length === 0) return null;

  const matchedKey = guide.clues.filter((c) => c.weight === "key" && signalMatched(c.terms, q));
  const matchedSupporting = guide.clues.filter((c) => c.weight === "supporting" && signalMatched(c.terms, q));
  const conflicts = guide.mismatchSignals.filter((m) => signalMatched(m.terms, q));
  const lexical = scorePlaybook(query, {
    publicTitle: guide.publicTitle,
    publicSummary: guide.publicSummary,
    recognize: guide.recognize,
    systemCategories: [...guide.systemCategories, ...guide.environment],
  });

  const clueCount = matchedKey.length + matchedSupporting.length;
  if (clueCount === 0 && conflicts.length === 0 && lexical.score < 4) return null;

  let relevanceLabel: RelevanceLabel;
  if (conflicts.length > 0) relevanceLabel = "needs_evidence";
  else if (matchedKey.length >= 2 || (matchedKey.length >= 1 && matchedSupporting.length >= 1)) relevanceLabel = "strong_overlap";
  else if (matchedKey.length >= 1 || matchedSupporting.length >= 2) relevanceLabel = "some_overlap";
  else relevanceLabel = "needs_evidence";

  // Ranking: clue overlap dominates; lexical overlap breaks ties; conflicts push a guide down.
  const score = matchedKey.length * 10 + matchedSupporting.length * 4 + Math.min(lexical.score, 20) * 0.25 - conflicts.length * 8;

  return {
    matchedClues: [...matchedKey, ...matchedSupporting].map((c) => c.label),
    conflictingClues: conflicts.map((m) => ({ label: m.label, explanation: m.explanation })),
    missingChecks: guide.clues.filter((c) => c.weight === "key" && !matchedKey.includes(c)).map((c) => c.label),
    relevanceLabel,
    score: Math.round(score * 10) / 10,
  };
}

/** Clues for a contributor guide without curated clues: one key clue per Recognize statement. */
export function deriveClues(recognize: string): Clue[] {
  return recognize
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((line, i) => ({
      id: `derived-${i}`,
      label: line.length > 90 ? `${line.slice(0, 87)}…` : line,
      terms: [...new Set(tokenize(line).filter((t) => t.length > 3))].slice(0, 8),
      weight: i < 2 ? ("key" as const) : ("supporting" as const),
    }));
}
