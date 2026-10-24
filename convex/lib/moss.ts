// Moss adapter (runtime-agnostic parts). Uses the Moss Inference REST API
// (OpenAI-compatible chat completions): https://docs.moss.dev/docs/api-reference/v1/inference/chat-completions
// Index creation needs the Node SDK and lives in convex/mossIndex.ts.

import { z } from "zod";
import { SECTION_INFO, SECTION_KEYS, type SectionKey } from "./domain";
import type { DraftSource } from "./drafting";
import { NOT_ENOUGH_INFO } from "./qa";

const INFERENCE_URL = "https://inference.moss.dev/v1/chat/completions";

export function mossCredentials(): { projectId: string; projectKey: string } | null {
  const projectId = process.env.MOSS_PROJECT_ID;
  const projectKey = process.env.MOSS_PROJECT_KEY;
  return projectId && projectKey ? { projectId, projectKey } : null;
}

export function playbookIndexName(playbookId: string, scope: "preview" | "full"): string {
  return `ix-${playbookId.toLowerCase()}-${scope}`;
}

export class MossError extends Error {}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

async function chat(opts: {
  system: string;
  user: string;
  indexes?: string[];
  json?: boolean;
  maxTokens: number;
}): Promise<string> {
  const creds = mossCredentials();
  if (!creds) throw new MossError("Moss credentials not set");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.projectId}:${creds.projectKey}`,
    "Content-Type": "application/json",
    "X-Moss-Cache": "off",
  };
  if (opts.indexes?.length) headers["X-Moss-Indexes"] = opts.indexes.join(",");
  else headers["X-Moss-Retrieve"] = "off";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(INFERENCE_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: "moss",
        temperature: 0,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    if (res.status === 429) throw new MossError("Moss rate limit reached");
    if (!res.ok) throw new MossError(`Moss responded with HTTP ${res.status}`);
    const parsed = completionSchema.safeParse(await res.json());
    if (!parsed.success) throw new MossError("Unexpected Moss response shape");
    return parsed.data.choices[0].message.content ?? "";
  } catch (err) {
    if (err instanceof MossError) throw err;
    throw new MossError(controller.signal.aborted ? "Moss request timed out" : "Could not reach Moss");
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ drafting

const DRAFT_SYSTEM = `You structure a security team's incident notes into a defensive playbook.
Return ONLY a JSON object with exactly these keys, each an array of short, standalone statements:
"recognize" (observable signs), "check" (evidence to collect and safe checks), "contain" (steps to limit harm),
"recover" (corrective steps), "verify" (how to confirm the fix), "limitations" (where it may not apply, side effects, uncertainty).
Rules:
- Use only facts present in the notes. Do not invent hosts, numbers, tools, or steps.
- Keep the contributor's wording, including any names or identifiers; a separate privacy review handles those.
- Defensive guidance only. Never include exploit payloads or attack instructions.
- Use an empty array when the notes give nothing for a key.`;

const sectionArray = z.array(z.string().trim().min(1).max(400)).max(15);
export const draftResponseSchema = z.object({
  recognize: sectionArray,
  check: sectionArray,
  contain: sectionArray,
  recover: sectionArray,
  verify: sectionArray,
  limitations: sectionArray,
});

/** Parse and validate the model's JSON. Throws MossError when unusable. */
export function parseDraftResponse(content: string): Record<SectionKey, string[]> {
  let json: unknown;
  try {
    json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new MossError("Moss returned invalid JSON");
  }
  const parsed = draftResponseSchema.safeParse(json);
  if (!parsed.success) throw new MossError("Moss draft did not match the six-section shape");
  const total = SECTION_KEYS.reduce((n, k) => n + parsed.data[k].length, 0);
  if (total === 0) throw new MossError("Moss returned an empty draft");
  return parsed.data;
}

/** Only the structured response fields are sent. Private notes, evidence, and identifying terms never are. */
export async function draftWithMoss(src: DraftSource): Promise<Record<SectionKey, string[]>> {
  const user = [
    `Symptoms:\n${src.symptoms}`,
    `Detection clues:\n${src.detectionClues}`,
    `Investigation and attempted actions:\n${src.attemptedActions}`,
    `Containment:\n${src.containmentSteps}`,
    `Recovery:\n${src.recoverySteps}`,
    `Verification:\n${src.verificationSteps}`,
    `Limitations:\n${src.limitations}`,
  ].join("\n\n");
  return parseDraftResponse(await chat({ system: DRAFT_SYSTEM, user, json: true, maxTokens: 1500 }));
}

// ---------------------------------------------------------------- grounded Q&A

const QA_SYSTEM = `You answer a buyer's question using ONLY the retrieved playbook facts.
Each fact starts with its section name in square brackets, e.g. [Verify].
Rules:
- Answer in at most 4 short sentences. After each sentence, cite the section(s) it came from, e.g. [Verify].
- Cite only section names that appear on the retrieved facts.
- If the retrieved facts do not answer the question, reply exactly: ${NOT_ENOUGH_INFO}
- Do not use outside knowledge. Defensive guidance only.`;

export type MossAnswer = {
  answer: string;
  citations: { section: SectionKey; title: string }[];
  grounded: boolean;
};

/** Extract [Section] citations, keeping only sections the viewer is allowed to read. */
export function parseCitedAnswer(content: string, allowed: readonly SectionKey[]): MossAnswer {
  const text = content.trim();
  if (!text || text.includes(NOT_ENOUGH_INFO) || /not enough information/i.test(text)) {
    return { answer: NOT_ENOUGH_INFO, citations: [], grounded: false };
  }
  const byTitle = new Map(SECTION_KEYS.map((k) => [SECTION_INFO[k].title.toLowerCase(), k]));
  const cited = new Set<SectionKey>();
  for (const m of text.matchAll(/\[([A-Za-z ]+)\]/g)) {
    const key = byTitle.get(m[1].trim().toLowerCase());
    if (key && allowed.includes(key)) cited.add(key);
  }
  return {
    answer: text,
    citations: [...cited].map((k) => ({ section: k, title: SECTION_INFO[k].title })),
    grounded: cited.size > 0,
  };
}

/** Moss retrieves from this playbook's index (built at publish time). */
export async function askWithMossIndex(question: string, indexName: string, allowed: readonly SectionKey[]): Promise<MossAnswer> {
  const content = await chat({ system: QA_SYSTEM, user: question, indexes: [indexName], maxTokens: 400 });
  return parseCitedAnswer(content, allowed);
}

/** No index available: Moss Inference answers from the viewer's allowed sections, supplied directly (retrieval off). */
export async function askWithMossContext(
  question: string,
  sections: Partial<Record<SectionKey, string>>,
  allowed: readonly SectionKey[],
): Promise<MossAnswer> {
  const facts = playbookDocuments(sections).map((d) => d.text).join("\n");
  const user = `Retrieved playbook facts:\n${facts}\n\nQuestion: ${question}`;
  const content = await chat({ system: QA_SYSTEM, user, maxTokens: 400 });
  return parseCitedAnswer(content, allowed);
}

/** Documents for a playbook index: one per statement, tagged with its section. */
export function playbookDocuments(sections: Partial<Record<SectionKey, string>>) {
  const docs: { id: string; text: string; metadata: Record<string, string> }[] = [];
  for (const key of SECTION_KEYS) {
    const body = sections[key];
    if (!body) continue;
    body
      .split("\n")
      .map((l) => l.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean)
      .forEach((line, i) => docs.push({ id: `${key}-${i}`, text: `[${SECTION_INFO[key].title}] ${line}`, metadata: { section: key } }));
  }
  return docs;
}
