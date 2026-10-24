// Shared public-preview search index (one Moss index for web search and MCP search).
// Only fields buyers can already read for free go into it. Private draft fields (notes, evidence,
// identifying terms) and paid sections (Check, Contain, Recover, Verify, failed attempts) never do.

import type { RelevanceLabel } from "./matching";

export const PUBLIC_INDEX_NAME = "ix-public-previews";
/**
 * Moss scores below this are treated as unrelated. Calibrated on the seeded catalog: paraphrases of a
 * guide scored 0.34–0.38, off-topic queries scored 0.00.
 */
export const MIN_SEMANTIC_SCORE = 0.2;
export const SEMANTIC_TOP_K = 8;

/** The free, approved preview fields of an active playbook. */
export type PublicPreviewSource = {
  _id: string;
  revision: number;
  publicTitle: string;
  publicSummary: string;
  previewRecognize: string;
  publicLimitations: string;
  systemCategories: string[];
  environment: string[];
};

export type IndexDoc = { id: string; text: string; metadata: { revision: string } };

export function publicPreviewDoc(pb: PublicPreviewSource): IndexDoc {
  const text = [
    pb.publicTitle,
    pb.publicSummary,
    pb.previewRecognize,
    `Systems: ${[...pb.systemCategories, ...pb.environment].join(", ")}`,
    `May not apply: ${pb.publicLimitations}`,
  ]
    .join("\n")
    .slice(0, 3000);
  return { id: pb._id, text, metadata: { revision: String(pb.revision) } };
}

/** True when the remote index already holds exactly these documents. */
export function sameDocs(remote: { id: string; text: string; metadata?: Record<string, string> }[], wanted: IndexDoc[]): boolean {
  if (remote.length !== wanted.length) return false;
  const byId = new Map(remote.map((d) => [d.id, d]));
  return wanted.every((w) => {
    const r = byId.get(w.id);
    return !!r && r.text === w.text && r.metadata?.revision === w.metadata.revision;
  });
}

export type SemanticCandidate = { id: string; score: number };
export type SearchEngine = "moss_semantic" | "keyword_fallback";

const TIER: Record<RelevanceLabel, number> = { strong_overlap: 3, some_overlap: 2, needs_evidence: 1 };

/**
 * Rank key for one guide. With Moss candidates, meaning-based similarity leads and clue overlap
 * breaks ties; without them, clue overlap alone (the labeled keyword fallback). Price never counts.
 * Returns null when the guide should not be shown.
 */
export function rankKey(label: RelevanceLabel | null, lexicalScore: number, semantic: number | undefined, semanticMode: boolean): number | null {
  if (!semanticMode) return label === null ? null : lexicalScore;
  const sem = semantic ?? 0;
  if (sem < MIN_SEMANTIC_SCORE && (label === null || label === "needs_evidence")) return null;
  return sem * 100 + (label ? TIER[label] * 5 : 0) + lexicalScore / 100;
}
