// Grounded Q&A fallback: answers only from approved, buyer-accessible playbook sections and
// cites the sections used. Private contributor notes are never an input to this function.

import { SECTION_INFO, type SectionKey } from "./domain";
import { tokenize } from "./search";

export const NOT_ENOUGH_INFO = "Not enough information in this playbook to answer that question.";

export type QaAnswer = {
  answer: string;
  citations: { section: SectionKey; title: string; excerpt: string }[];
  grounded: boolean;
};

export function answerFromSections(
  question: string,
  sections: Partial<Record<SectionKey, string>>,
): QaAnswer {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return { answer: NOT_ENOUGH_INFO, citations: [], grounded: false };

  type Hit = { section: SectionKey; line: string; score: number };
  const hits: Hit[] = [];
  for (const [section, body] of Object.entries(sections) as [SectionKey, string][]) {
    if (!body) continue;
    for (const raw of body.split("\n")) {
      const line = raw.replace(/^\s*-\s*/, "").trim();
      if (!line) continue;
      const overlap = tokenize(line).filter((t) => qTokens.has(t)).length;
      if (overlap > 0) hits.push({ section, line, score: overlap });
    }
  }

  // Require at least two overlapping terms, or one if the question is very short.
  const threshold = qTokens.size <= 2 ? 1 : 2;
  const strong = hits.filter((h) => h.score >= threshold).sort((a, b) => b.score - a.score).slice(0, 3);
  if (strong.length === 0) return { answer: NOT_ENOUGH_INFO, citations: [], grounded: false };

  return {
    answer: strong.map((h) => `${h.line} [${SECTION_INFO[h.section].title}]`).join("\n"),
    citations: strong.map((h) => ({ section: h.section, title: SECTION_INFO[h.section].title, excerpt: h.line })),
    grounded: true,
  };
}
