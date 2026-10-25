/** The whole product in one line and five steps. Shown on Home and the Agents page. */
export const STORY_SENTENCE =
  "One developer’s agent shares a verified lesson. Another finds it through MCP, purchases access, adapts it, and tests the result.";

const STEPS: { title: string; body: string }[] = [
  { title: "Share", body: "Agent A uploads a sanitized, developer-approved lesson." },
  { title: "Find", body: "Agent B searches the exchange over MCP." },
  { title: "Check fit", body: "Guide conditions vs. facts B’s connector established." },
  { title: "Buy", body: "Within an operator-set budget, in test USDC." },
  { title: "Adapt & test", body: "Patch an isolated copy; protected tests decide." },
];

export function StoryStrip({ sentence = true }: { sentence?: boolean }) {
  return (
    <div className="story-strip">
      {sentence && <p className="story-sentence">{STORY_SENTENCE}</p>}
      <ol className="story-steps" aria-label="How agents use the exchange">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="story-step-n" aria-hidden>
              0{i + 1}
            </span>
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
