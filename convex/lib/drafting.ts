// Deterministic fallback that structures contributor form input into the six-part playbook.
// Used whenever the Moss adapter is not connected. It only rearranges the contributor's own
// words; it does not invent facts.

import type { SectionKey } from "./domain";

export type DraftSource = {
  symptoms: string;
  detectionClues: string;
  attemptedActions: string;
  containmentSteps: string;
  recoverySteps: string;
  verificationSteps: string;
  limitations: string;
};

export type GeneratedSection = { body: string; sourceFields: string[] };

export const FIELD_LABELS: Record<keyof DraftSource, string> = {
  symptoms: "Symptoms",
  detectionClues: "Detection clues",
  attemptedActions: "Investigation & attempted actions",
  containmentSteps: "Containment",
  recoverySteps: "Recovery",
  verificationSteps: "Verification",
  limitations: "Limitations",
};

const SECTION_SOURCES: Record<SectionKey, (keyof DraftSource)[]> = {
  recognize: ["symptoms", "detectionClues"],
  check: ["detectionClues", "attemptedActions"],
  contain: ["containmentSteps"],
  recover: ["recoverySteps"],
  verify: ["verificationSteps"],
  limitations: ["limitations"],
};

const STANDARD_LIMITATION =
  "Similar symptoms can have different causes; treat this guide as a discovery aid and confirm each step against your own environment and change history.";

/** Split free text into clean, de-duplicated statements. */
export function toStatements(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])|;\s+/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => (/[.!?]$/.test(s) ? s : s + "."))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

function bullets(statements: string[]): string {
  const seen = new Set<string>();
  return statements
    .filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((s) => `- ${s}`)
    .join("\n");
}

export function draftSectionsFallback(src: DraftSource): Record<SectionKey, GeneratedSection> {
  const out = {} as Record<SectionKey, GeneratedSection>;
  for (const [key, fields] of Object.entries(SECTION_SOURCES) as [SectionKey, (keyof DraftSource)[]][]) {
    const used = fields.filter((f) => src[f].trim().length > 0);
    const statements = used.flatMap((f) => toStatements(src[f]));
    if (key === "limitations") statements.push(STANDARD_LIMITATION);
    out[key] = {
      body: statements.length ? bullets(statements) : "",
      sourceFields: used.map((f) => FIELD_LABELS[f]),
    };
  }
  return out;
}
