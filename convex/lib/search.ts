// Deterministic symptom search with plain-language match reasons.
// Similarity is a discovery aid, not proof that incidents share a cause.

export type SearchablePlaybook = {
  publicTitle: string;
  publicSummary: string;
  recognize: string;
  systemCategories: string[];
};

export type MatchResult = { score: number; reason: string; matchedTerms: string[] };

const STOPWORDS = new Set(
  "a an and are as at be been but by for from has have in into is it its of on or our that the their them then there these this to was we were when which while with after before our us my i you your seeing see".split(
    " ",
  ),
);

// Concept groups: any word in a group matches any other word in the same group.
const CONCEPTS: { name: string; words: string[] }[] = [
  { name: "authentication", words: ["auth", "authentication", "authenticate", "login", "logins", "log-in", "signin", "sign-in", "credential", "credentials", "password", "sso"] },
  { name: "failures", words: ["failure", "failures", "failed", "failing", "fail", "error", "errors", "denied", "rejected", "401", "403"] },
  { name: "deployment", words: ["deployment", "deploy", "deployed", "release", "rollout", "update", "updated", "upgrade"] },
  { name: "repeated", words: ["repeated", "repeat", "spike", "burst", "surge", "many", "flood", "increase", "lots"] },
  { name: "lockout", words: ["lockout", "locked", "throttle", "throttling", "rate-limit", "ratelimit", "brute"] },
  { name: "email", words: ["email", "mail", "bounce", "bounces", "smtp", "dns", "spf", "dkim"] },
  { name: "storage", words: ["bucket", "storage", "s3", "blob", "files", "exposed", "public", "listing"] },
  { name: "mfa", words: ["mfa", "2fa", "push", "prompt", "prompts", "otp"] },
];

const WORD_TO_CONCEPT = new Map<string, string>();
for (const c of CONCEPTS) for (const w of c.words) WORD_TO_CONCEPT.set(w, c.name);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function conceptOf(token: string): string {
  return WORD_TO_CONCEPT.get(token) ?? token;
}

export function scorePlaybook(query: string, pb: SearchablePlaybook): MatchResult {
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0) return { score: 0, reason: "", matchedTerms: [] };

  const titleConcepts = new Set(tokenize(pb.publicTitle).map(conceptOf));
  const symptomConcepts = new Set(tokenize(`${pb.publicSummary} ${pb.recognize}`).map(conceptOf));
  const categoryConcepts = new Set(tokenize(pb.systemCategories.join(" ")).map(conceptOf));

  let score = 0;
  const matchedTerms: string[] = [];
  const matchedConcepts = new Set<string>();
  const inTitle: string[] = [];
  const inSymptoms: string[] = [];
  const inCategory: string[] = [];

  for (const t of queryTokens) {
    const c = conceptOf(t);
    if (matchedConcepts.has(c)) continue;
    let hit = false;
    if (titleConcepts.has(c)) {
      score += 3;
      inTitle.push(t);
      hit = true;
    }
    if (symptomConcepts.has(c)) {
      score += 2;
      inSymptoms.push(t);
      hit = true;
    }
    if (categoryConcepts.has(c)) {
      score += 1;
      inCategory.push(t);
      hit = true;
    }
    if (hit) {
      matchedConcepts.add(c);
      matchedTerms.push(t);
    }
  }

  const coverage = matchedConcepts.size / new Set(queryTokens.map(conceptOf)).size;
  const finalScore = Math.round(score * (0.5 + coverage) * 10) / 10;

  const parts: string[] = [];
  if (inSymptoms.length) parts.push(`the listed symptoms mention ${quoteList(inSymptoms)}`);
  if (inTitle.length) parts.push(`the title covers ${quoteList(inTitle)}`);
  if (inCategory.length) parts.push(`it is filed under ${pb.systemCategories.join(", ")}`);
  const reason = parts.length
    ? `Matched ${matchedConcepts.size} of your ${new Set(queryTokens.map(conceptOf)).size} key terms: ${parts.join("; ")}.`
    : "";

  return { score: finalScore, reason, matchedTerms };
}

function quoteList(terms: string[]): string {
  const q = [...new Set(terms)].map((t) => `“${t}”`);
  return q.length <= 1 ? q.join("") : `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}
