import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { EVIDENCE_INFO, EVIDENCE_LEVELS, SYSTEM_CATEGORIES, type EvidenceLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { TLP_INFO } from "../../../convex/lib/license";
import { Empty, EvidenceBadge, Money, PageHeader, RoleGate } from "../../components/ui";

const SCENARIOS = [
  "The queue fills again after restarting workers, and identical webhook event IDs create two jobs",
  "A signed-in customer can see export data outside their workspace",
  "Valid signed events are rejected right after the provider rotated keys",
];

const LABEL_CLASS = { strong_overlap: "rel-strong", some_overlap: "rel-some", needs_evidence: "rel-weak" } as const;

export default function SearchPage() {
  return (
    <RoleGate role="buyer">
      <Search />
    </RoleGate>
  );
}

function Search() {
  const { actor } = useSession();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const evidence = (params.get("evidence") ?? "") as EvidenceLevel | "";
  const maxPrice = params.get("max") ?? "";
  const [input, setInput] = useState(q);
  // Keep the box in sync when the query changes from elsewhere (e.g. the ⌘K palette).
  useEffect(() => setInput(q), [q]);

  const results = useQuery(api.playbooks.search, {
    actor,
    query: q,
    category: category || undefined,
    evidenceLevel: evidence || undefined,
    maxPriceAtomic: maxPrice || undefined,
  });

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader eyebrow="Describe it in your own words" title="Find guidance" />
      <form
        className="search-bar card"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: input.trim() });
        }}
        role="search"
      >
        <label htmlFor="q" className="label">
          Describe what you are seeing
        </label>
        <div className="row gap">
          <input
            id="q"
            className="grow"
            placeholder="e.g. orders are being created twice and the queue keeps filling up"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn primary" type="submit">
            Search
          </button>
        </div>
        <div className="chips">
          <span className="small muted">Try a scenario:</span>
          {SCENARIOS.map((s) => (
            <button
              type="button"
              key={s}
              className="chip"
              onClick={() => {
                setInput(s);
                update({ q: s });
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="filters">
          <label>
            <span className="label">Category</span>
            <select value={category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">Any</option>
              {SYSTEM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Evidence</span>
            <select value={evidence} onChange={(e) => update({ evidence: e.target.value })}>
              <option value="">Any</option>
              {EVIDENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {EVIDENCE_INFO[l].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Max price</span>
            <select value={maxPrice} onChange={(e) => update({ max: e.target.value })}>
              <option value="">Any</option>
              <option value="250000">0.25 USDC</option>
              <option value="500000">0.50 USDC</option>
              <option value="1000000">1.00 USDC</option>
            </select>
          </label>
        </div>
      </form>

      <p className="small muted">Results are ranked by overlap with what you described — never by price. Overlap labels are discovery aids, not proof that incidents share a cause.</p>

      {results === undefined ? (
        <div className="results" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="card skeleton-card" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Empty title="No guide fits what you described">
          Try describing the symptom differently, remove filters, or check related public sources. We never force a weak match.
        </Empty>
      ) : (
        <div className="results">
          {results.map((r) => (
            <article key={r._id} className="card result">
              <div className="result-head">
                <div>
                  <div className="eyebrow">
                    {r.contributorAlias} · {r.trackRecord.guides} guide{r.trackRecord.guides === 1 ? "" : "s"}
                    {r.trackRecord.outcomes > 0 ? ` · ${r.trackRecord.resolved}/${r.trackRecord.outcomes} buyers resolved` : ""} · updated{" "}
                    {new Date(r.publishedAt).toLocaleDateString()}
                  </div>
                  <h2>
                    <Link to={`/playbooks/${r._id}`}>{r.publicTitle}</Link>
                  </h2>
                </div>
                <div className="price-tag">{r.unlocked ? <span className="badge ok">Unlocked</span> : <Money atomic={r.priceAtomic} />}</div>
              </div>
              {r.match && (
                <div className={`match-panel ${LABEL_CLASS[r.match.relevanceLabel]}`}>
                  <div className="row gap match-top">
                    <div className="match-label" title={r.match.relevanceExplanation}>
                      {r.match.relevance}
                    </div>
                    <div className="meter fit-meter" aria-hidden>
                      <span style={{ width: `${Math.min(100, Math.round(((r.keyClueCount - r.match.missingChecks.length) / Math.max(1, r.keyClueCount)) * 100))}%` }} />
                    </div>
                    <span className="small muted">
                      {r.keyClueCount - r.match.missingChecks.length}/{r.keyClueCount} key signs match
                    </span>
                  </div>
                  {r.match.matchedClues.length > 0 && (
                    <div>
                      <strong>Why this may match:</strong>
                      <ul className="clue-list ok-list">
                        {r.match.matchedClues.slice(0, 3).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.match.conflictingClues.length > 0 && (
                    <div>
                      <strong>May not apply:</strong>
                      <ul className="clue-list warn-list">
                        {r.match.conflictingClues.map((c) => (
                          <li key={c.label}>
                            {c.label} — <span className="muted">{c.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.match.missingChecks.length > 0 && r.match.conflictingClues.length === 0 && (
                    <div className="small muted">What to check first: {r.match.missingChecks.slice(0, 2).join("; ")}</div>
                  )}
                </div>
              )}
              <p>{r.publicSummary}</p>
              <div className="row gap wrap">
                <span className={`tlp tlp-${r.tlp}`}>{TLP_INFO[r.tlp].label}</span>
                <EvidenceBadge level={r.evidenceLevel} />
                <span className="small muted">{r.evidenceScope}</span>
              </div>
              {!r.match && r.mismatchSignals[0] && (
                <div className="small">
                  <strong>Key mismatch:</strong> {r.mismatchSignals[0].label}
                </div>
              )}
              <div className="result-foot">
                <span className="small muted">
                  {r.environment.slice(0, 4).join(" · ")}
                  {r.feedback.count > 0 && ` · ${r.feedback.resolved} of ${r.feedback.count} buyers reported resolved`}
                </span>
                <Link className="btn sm primary" to={`/playbooks/${r._id}`}>
                  {r.unlocked ? "Open guide" : "Open free preview"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
