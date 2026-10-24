import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { EVIDENCE_INFO, EVIDENCE_LEVELS, SYSTEM_CATEGORIES, type EvidenceLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { Empty, EvidenceBadge, Loading, Money, PageHeader, RoleGate } from "../../components/ui";

const SCENARIOS = [
  "Repeated authentication failures after a deployment",
  "Employees getting MFA push prompts they didn't start",
  "Email bounces spiked after DNS change",
];

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

  const results = useQuery(api.playbooks.search, {
    actor,
    query: q,
    category: category || undefined,
    evidenceLevel: evidence || undefined,
    maxPriceMinorUnits: maxPrice ? Number(maxPrice) * 100 : undefined,
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
      <PageHeader eyebrow="Harbor Analytics · buyer" title="Find a playbook" />
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
            placeholder="e.g. repeated authentication failures after a deployment"
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
              <option value="30">$30</option>
              <option value="50">$50</option>
              <option value="100">$100</option>
            </select>
          </label>
        </div>
      </form>

      <p className="small muted">Similarity is a discovery aid, not proof that incidents share a cause.</p>

      {results === undefined ? (
        <Loading label="Searching…" />
      ) : results.length === 0 ? (
        <Empty title="No matching playbooks">Try describing the symptom differently or clearing filters.</Empty>
      ) : (
        <div className="results">
          {results.map((r) => (
            <article key={r._id} className="card result">
              <div className="result-head">
                <div>
                  <div className="eyebrow">
                    {r.contributorAlias} · {r.sourceCategory}
                  </div>
                  <h2>
                    <Link to={`/playbooks/${r._id}`}>{r.publicTitle}</Link>
                  </h2>
                </div>
                <div className="price-tag">
                  {r.unlocked ? <span className="badge ok">Unlocked</span> : <Money minor={r.priceMinorUnits} currency={r.currency} />}
                </div>
              </div>
              {r.matchReason && (
                <div className="match-reason">
                  <strong>Why this matched:</strong> {r.matchReason}
                </div>
              )}
              <p>{r.publicSummary}</p>
              <div className="row gap wrap">
                <EvidenceBadge level={r.evidenceLevel} explain />
              </div>
              <div className="row gap wrap">
                {r.systemCategories.map((c) => (
                  <span key={c} className="badge cat">
                    {c}
                  </span>
                ))}
              </div>
              <details className="limits">
                <summary>Limitations</summary>
                <pre className="plain-pre">{r.publicLimitations.replace(/^- /gm, "• ")}</pre>
              </details>
              <div className="result-foot">
                <span className="small muted">
                  {r.feedback.count === 0
                    ? "No buyer outcomes yet"
                    : `${r.feedback.resolved} of ${r.feedback.count} buyers reported it resolved their issue`}
                </span>
                <Link className="btn sm primary" to={`/playbooks/${r._id}`}>
                  {r.unlocked ? "Read playbook" : "Open free preview"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
