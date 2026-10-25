import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { EVIDENCE_INFO, EVIDENCE_LEVELS, SYSTEM_CATEGORIES, type EvidenceLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { TLP_INFO } from "../../../convex/lib/license";
import { Empty, ErrorBox, EvidenceBadge, Money, PageHeader, RoleGate, errorMessage } from "../../components/ui";
import { Icon } from "../../components/icons";

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

  const args = { actor, query: q, category: category || undefined, evidenceLevel: evidence || undefined, maxPriceAtomic: maxPrice || undefined };
  // Browsing (no query) stays a live query; a symptom query goes through Moss semantic search.
  const browse = useQuery(api.playbooks.search, q.trim() ? "skip" : args);
  const semanticSearch = useAction(api.semanticSearch.buyerSearch);
  const [found, setFound] = useState<{ key: string; data: FunctionReturnType<typeof api.semanticSearch.buyerSearch>; failed?: string } | null>(null);
  const key = JSON.stringify(args);
  useEffect(() => {
    if (!q.trim()) return;
    let live = true;
    semanticSearch(JSON.parse(key))
      .then((data) => live && setFound({ key, data }))
      .catch((e) => live && setFound({ key, data: { retrieval: { engine: "keyword_fallback", index: "", fallbackReason: "Search failed" }, results: [] }, failed: errorMessage(e) }));
    return () => {
      live = false;
    };
  }, [key, q, semanticSearch]);
  const current = q.trim() ? (found?.key === key ? found.data : undefined) : undefined;
  const results = q.trim() ? current?.results : browse;
  const failed = q.trim() && found?.key === key ? found.failed : undefined;
  const retrieval = failed ? undefined : current?.retrieval;

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
      <PageHeader eyebrow="Find a fix" title="What’s going wrong?" />
      <form
        className="search-bar card"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: input.trim() });
        }}
        role="search"
      >
        <label htmlFor="q" className="sr-only">
          Describe what you are seeing
        </label>
        <div className="search-row">
          <Icon name="search" size={20} />
          <input
            id="q"
            className="grow"
            placeholder="e.g. orders are created twice and the queue keeps filling up"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
          <button className="btn primary" type="submit">
            Search
          </button>
        </div>
        <div className="chips">
          <span className="small muted">Try:</span>
          {SCENARIOS.map((s) => (
            <button
              type="button"
              key={s}
              className="chip"
              title={s}
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

      <div className="results-meta" aria-live="polite">
        <span>{results === undefined ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}</span>
        {retrieval?.engine === "moss_semantic" && <span className="badge ok">Semantic search · Moss</span>}
        {retrieval?.engine === "keyword_fallback" && (
          <span className="badge warn" title={retrieval.fallbackReason}>
            Keyword fallback (Moss unavailable: {retrieval.fallbackReason})
          </span>
        )}
        <span>Ranked by fit, never by price</span>
      </div>

      {failed ? (
        <ErrorBox message={`The search didn’t complete (${failed}). Try again in a moment; your filters are kept.`} />
      ) : results === undefined ? (
        <div className="results" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Empty title="No guide fits yet">Try different words or fewer filters.</Empty>
      ) : (
        <div className="results stagger">
          {results.map((r) => (
            <article key={r._id} className="card result">
              <div className="result-head">
                <div>
                  <div className="eyebrow">
                    {r.contributorAlias} · {r.trackRecord.guides} guide{r.trackRecord.guides === 1 ? "" : "s"}
                    {r.trackRecord.outcomes > 0 ? ` · ${r.trackRecord.resolved}/${r.trackRecord.outcomes} resolved` : ""} ·{" "}
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
                  <div className="match-cols">
                    <div>
                      <h4>Matches your description ({r.match.matchedClues.length})</h4>
                      {r.match.matchedClues.length > 0 ? (
                        <ul className="clue-list ok-list">
                          {r.match.matchedClues.slice(0, 4).map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="small muted">None of the guide’s signs yet.</p>
                      )}
                    </div>
                    <div>
                      <h4>Key signs to confirm ({r.match.missingChecks.length})</h4>
                      {r.match.missingChecks.length > 0 ? (
                        <ul className="clue-list open-list">
                          {r.match.missingChecks.slice(0, 4).map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="small muted">Nothing missing.</p>
                      )}
                    </div>
                  </div>
                  {r.match.conflictingClues.length > 0 && (
                    <div>
                      <h4 className="conflict-h">May not apply</h4>
                      <ul className="clue-list warn-list">
                        {r.match.conflictingClues.map((c) => (
                          <li key={c.label}>
                            {c.label} — <span className="muted">{c.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {r.publicSummary.trim() !== r.publicTitle.trim() && <p>{r.publicSummary}</p>}
              {r.evidenceScope && <p className="small muted">{r.evidenceScope}</p>}
              {!r.match && r.semanticScore !== null && (
                <div className="small muted">Similar in meaning to your description. Check the signs in the preview before relying on it.</div>
              )}
              {!r.match && r.mismatchSignals[0] && (
                <div className="small muted">May not apply if: {r.mismatchSignals[0].label}</div>
              )}
              <div className="result-foot">
                <div className="row gap wrap">
                  <span className={`tlp tlp-${r.tlp}`}>{TLP_INFO[r.tlp].label}</span>
                  <EvidenceBadge level={r.evidenceLevel} />
                  <span className="small muted">
                    {r.environment.slice(0, 3).join(" · ")}
                    {r.feedback.count > 0 && ` · ${r.feedback.resolved}/${r.feedback.count} resolved`}
                  </span>
                </div>
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
