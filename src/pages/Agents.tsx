import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { formatAtomic } from "../../convex/lib/money";
import { useSession } from "../session";
import { ErrorBox, Loading, PageHeader, formatDate } from "../components/ui";
import { Icon } from "../components/icons";
import { STORY_SENTENCE, StoryStrip } from "../components/StoryStrip";
import recordingFile from "../recordings/two-agent-run.json";

const RUNNER_URL = (import.meta.env.VITE_FACTORY_RUNNER_URL as string | undefined) ?? "http://127.0.0.1:3299";

type Overview = NonNullable<ReturnType<typeof useOverview>>;
type Check = Overview["applicabilityChecks"][number];
function useOverview(actor: string) {
  return useQuery(api.agentsConsole.overview, { actor });
}

/** A real earlier run captured by scripts/record-run.mjs. Viewing it executes nothing. */
const recording = recordingFile as unknown as { recordedAt: number; run: { startedAt: number; finishedAt: number; durationMs: number }; source: { deployment: string; commit: string }; overview: Overview };
const REPLAY_SPEED = 2;

/** Applicability checks, if this overview has them (recordings and older deployments don't). */
const checksOf = (o: Overview): Check[] => (o as Partial<Overview>).applicabilityChecks ?? [];

/** Recorded data up to a point in the run's own timeline (for replay). */
function recordedUntil(t: number): Overview {
  const o = recording.overview;
  return { ...o, events: o.events.filter((e) => e.at <= t), runs: o.runs.filter((r) => r.at <= t), outcomes: o.outcomes.filter((x) => x.at <= t), purchases: t >= recording.run.finishedAt ? o.purchases : o.purchases.filter((p) => o.events.some((e) => e.at <= t && e.refs.includes(p._id))), applicabilityChecks: checksOf(o).filter((c) => c.at <= t) };
}

/** Which agent is the contributor and which the buyer, by their operator-granted scopes. */
function roles(o: Overview) {
  const sellers = new Set(o.principals.filter((p) => p.scopes.includes("submit")).map((p) => p.name));
  const buyers = new Set(o.principals.filter((p) => p.scopes.includes("acquire")).map((p) => p.name));
  const isSellerRun = (r: Overview["runs"][number]) => sellers.has(r.principalName) || (!sellers.size && r.repo === "repo-a");
  const isBuyerRun = (r: Overview["runs"][number]) => buyers.has(r.principalName) || (!buyers.size && r.repo === "repo-b");
  return { sellers, buyers, isSellerRun, isBuyerRun };
}

const fitEvent = (o: Overview) => o.events.find((e) => e.kind === "applicability_checked" || e.kind === "check_applicability");

type StepState = boolean | "declined";
const STORY: { key: string; label: string; test: (o: Overview) => StepState }[] = [
  { key: "a_fixed", label: "A fixed a bug; its protected tests passed", test: (o) => o.runs.some((r) => roles(o).isSellerRun(r) && r.stage === "candidate" && r.passed) },
  { key: "shared", label: "Shared an approved, sanitized lesson", test: (o) => o.submissions.some((s) => s.status === "published") },
  { key: "found", label: "B found a candidate guide via MCP", test: (o) => o.events.some((e) => e.kind === "quote_resolution" || e.kind === "search_resolutions") },
  {
    key: "fit",
    label: "Checked fit against B’s environment",
    test: (o) => {
      const c = checksOf(o)[0];
      if (c) return c.recommendation === "decline" ? "declined" : true;
      // Older console data: only the event exists.
      const e = fitEvent(o);
      return !e ? false : /declin/i.test(e.summary) || e.status === "denied" ? "declined" : true;
    },
  },
  { key: "paid", label: "Paid within budget (or reused an earlier purchase)", test: (o) => o.purchases.some((p) => p.status === "test_success" || p.status === "simulated_success") || o.events.some((e) => e.kind === "entitlement_reused") },
  { key: "adapted", label: "Factory Droid adapted the fix in B’s code", test: (o) => o.runs.some((r) => roles(o).isBuyerRun(r) && r.stage === "candidate") },
  { key: "passed", label: "B’s protected tests passed", test: (o) => o.runs.some((r) => roles(o).isBuyerRun(r) && r.stage === "candidate" && r.passed) },
];

const KIND_LABEL: Record<string, string> = {
  search_resolutions: "Search",
  quote_resolution: "Quote",
  check_applicability: "Fit check",
  applicability_checked: "Fit check",
  get_my_access: "Access check",
  acquire_resolution: "Purchase",
  acquire_denied: "Purchase denied",
  budget_exceeded: "Over budget",
  entitlement_granted: "Access granted",
  entitlement_reused: "Earlier purchase reused",
  retrieve_resolution: "Retrieve",
  record_outcome: "Outcome",
  submit_resolution: "Submit",
  submit_denied: "Submit denied",
  needs_approval: "Waiting for developer",
  developer_approval: "Developer approved",
  submission_quarantined: "Quarantined",
  sensitive_content_detected: "Sensitive content",
  local_disclosure_gate: "Local privacy gate",
  baseline_tests: "Tests before",
  candidate_tests: "Tests after",
  factory_repair_started: "Adapting",
  repair_run_rejected: "Repair rejected",
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const MODE_LABEL: Record<string, string> = { live: "live", local: "local", testnet: "testnet", simulated: "simulated", recorded: "recorded" };

const REC_TEXT = { recommend: "Recommend", verify_first: "Verify first", decline: "Declined" } as const;
const REC_CLASS = { recommend: "ok", verify_first: "warn", decline: "sev-high" } as const;

export default function Agents() {
  const session = useSession();
  const { actor } = session;
  const live = useOverview(actor);
  const [mode, setMode] = useState<"live" | "recorded">("live");
  const [replayAt, setReplayAt] = useState<number | null>(null); // null = show the whole recording
  useEffect(() => {
    if (mode !== "recorded" || replayAt === null || replayAt >= recording.run.finishedAt) return;
    const t = setTimeout(() => setReplayAt((x) => (x === null ? null : Math.min(recording.run.finishedAt, x + 500 * REPLAY_SPEED))), 500);
    return () => clearTimeout(t);
  }, [mode, replayAt]);
  const recorded = mode === "recorded";
  const o = recorded ? recordedUntil(replayAt ?? recording.run.finishedAt) : live;
  const reviewerSlug = session.slugForRole("reviewer");
  const reviewerOrg = session.orgs?.find((x) => x.slug === reviewerSlug);
  const [starting, setStarting] = useState(false);
  const [scenario, setScenario] = useState<"dedupe" | "tenant">("dedupe");
  const [error, setError] = useState<string | null>(null);
  if (!o) return <Loading />;
  const job = o.jobs[0];
  const running = !recorded && job && job.status === "running";

  // Runs are a reviewer action. The presenter's operator session holds every org's token, so start as the
  // Review Desk whichever role is on screen; the backend still checks the reviewer role and operator session.
  const runActor = (reviewerSlug && session.actorFor(reviewerSlug)) || actor;
  const start = async (simulatePayment: boolean) => {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`${RUNNER_URL}/agent-demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor: runActor, simulatePayment, scenario }) });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `The local runner refused the request (HTTP ${res.status}).`);
    } catch {
      setError(["localhost", "127.0.0.1"].includes(window.location.hostname) ? "The local runner is offline. Start it with `npm run dev`." : "Agent runs start from the presenter’s machine (local runner), not from the hosted site. Results appear here when they run.");
    } finally {
      setStarting(false);
    }
  };

  const { sellers, buyers, isBuyerRun } = roles(o);
  const orgName = (slug: string) => session.orgs?.find((x) => x.slug === slug)?.displayName ?? slug;
  const laneMeta = (name: "contributor" | "consumer") => {
    const all = name === "contributor" ? sellers : buyers;
    const active = new Set(o.events.filter((e) => e.lane === name && all.has(e.actor)).map((e) => e.actor));
    const names = active.size ? active : all;
    const repos = [...new Set(o.runs.filter((r) => names.has(r.principalName)).map((r) => r.repo))];
    const orgs = [...new Set(o.principals.filter((p) => names.has(p.name)).map((p) => orgName(p.orgSlug)))];
    return [...repos, ...orgs].join(" · ");
  };
  const lane = (name: "contributor" | "consumer") => o.events.filter((e) => e.lane === name).slice(0, 14);
  const security = o.events.filter((e) => e.lane === "security").slice(0, 10);
  const buyerRuns = o.runs.filter(isBuyerRun);
  const bCand = buyerRuns.find((r) => r.stage === "candidate");
  const bBase = bCand ? buyerRuns.find((r) => r.stage === "baseline" && r.repo === bCand.repo) : undefined;
  const checks = checksOf(o);
  const latestCheck = checks[0];

  return (
    <div className="agents">
      <PageHeader eyebrow="Agents" title="Agents sharing fixes" sub={STORY_SENTENCE}>
        {!recorded && session.operator && (
          <>
            <label className="scenario-pick">
              <span className="sr-only">Scenario</span>
              <select value={scenario} onChange={(e) => setScenario(e.target.value as "dedupe" | "tenant")} disabled={starting || running} aria-label="Scenario">
                <option value="dedupe">Duplicate deliveries (repo-a → repo-b)</option>
                <option value="tenant">Cross-tenant access (repo-c → repo-d)</option>
              </select>
            </label>
            <button className="btn primary" disabled={starting || running} onClick={() => void start(false)}>
              {running ? "Running…" : "Run demo"}
            </button>
            <button className="btn" disabled={starting || running} onClick={() => void start(true)} title="Same flow, with a payment simulator instead of test USDC">
              Simulated payment
            </button>
          </>
        )}
        {recorded && (
          <button className="btn primary" onClick={() => setReplayAt(recording.run.startedAt)} disabled={replayAt !== null && replayAt < recording.run.finishedAt}>
            {replayAt !== null && replayAt < recording.run.finishedAt ? "Replaying…" : "Replay"}
          </button>
        )}
      </PageHeader>
      <StoryStrip sentence={false} />
      <div className="mode-tabs" role="tablist" aria-label="Live or recorded">
        <button role="tab" aria-selected={!recorded} className={!recorded ? "active" : ""} onClick={() => setMode("live")}>
          Live
        </button>
        <button role="tab" aria-selected={recorded} className={recorded ? "active" : ""} onClick={() => { setMode("recorded"); setReplayAt(null); }}>
          Recorded run
        </button>
      </div>
      {recorded && (
        <div className="recording-banner" role="note">
          <strong>Recording — not live.</strong> Captured from a real run on {formatDate(recording.run.startedAt)} ({Math.round(recording.run.durationMs / 1000)} s, deployment {recording.source.deployment}, commit {recording.source.commit}).
          Viewing or replaying it runs no code and moves no money.{replayAt !== null && replayAt < recording.run.finishedAt ? ` Replay at ${REPLAY_SPEED}× · ${Math.round((replayAt - recording.run.startedAt) / 1000)} s into the run.` : ""}
        </div>
      )}
      {!recorded && !session.operator && (
        <div className="role-note">
          <span>Live runs are started by the presenter on their machine. Watch here, or open the recorded run.</span>
        </div>
      )}
      {!recorded && session.operator && session.role !== "reviewer" && reviewerOrg && (
        <div className="role-note">
          <span>Run demo starts as the reviewer ({reviewerOrg.displayName}).</span>
          <button className="btn sm" onClick={() => session.setActor(reviewerOrg.slug)}>
            Switch to {reviewerOrg.displayName}
          </button>
        </div>
      )}
      {!recorded && <ErrorBox message={error} />}
      {job && !recorded && (
        <p className="stage-line" aria-live="polite">
          <span className={`badge ${job.status === "succeeded" ? "ok" : job.status === "failed" ? "sev-high" : job.status === "running" ? "" : "warn"}`}>
            {job.status === "running" ? "Running" : job.status === "succeeded" ? "Last run finished" : job.status === "failed" ? "Last run failed" : `Last run ${job.status}`}
          </span>
          {job.stage && <span className="stage-text">{job.stage}</span>}
          <span>
            started {formatDate(job.startedAt)}
            {job.finishedAt ? ` · took ${Math.max(1, Math.round((job.finishedAt - job.startedAt) / 1000))} s` : ""}
          </span>
          {job.error && <span className="warn-text">What went wrong: {job.error}</span>}
        </p>
      )}

      <h2 className="section-title story-title">{recorded ? "In this recording" : "This run"}</h2>
      <ol className="story" aria-label="What happened">
        {STORY.map((s) => {
          const state = s.test(o);
          return (
            <li key={s.key} className={state === "declined" ? "declined" : state ? "done" : ""}>
              <span className="story-dot" aria-hidden>{state === true ? <Icon name="check" size={14} /> : null}</span>
              {state === "declined" ? "Fit check: declined (a condition conflicts)" : s.label}
            </li>
          );
        })}
      </ol>

      <div className="lanes">
        {(["contributor", "consumer"] as const).map((name) => (
          <section key={name} className="card lane" aria-label={name === "contributor" ? "Contributor agent" : "Buyer agent"}>
            <div className="lane-head">
              <h2>{name === "contributor" ? "Agent A · contributor" : "Agent B · buyer"}</h2>
              <span className="small muted">{laneMeta(name)}</span>
            </div>
            {lane(name).length === 0 ? (
              <p className="muted small">No activity yet.</p>
            ) : (
              <ul className="events stagger">
                {lane(name).map((e) => (
                  <li key={e._id} className={`event ev-${e.status}`}>
                    <span className="dot-s" aria-hidden />
                    <div>
                      <div>
                        <strong className="ev-kind">{kindLabel(e.kind)}</strong> {e.summary}
                      </div>
                      <div className="small">
                        {e.status !== "ok" && <>{e.status} · </>}
                        {e.actor} · {new Date(e.at).toLocaleTimeString()} · <span className="mode">{MODE_LABEL[e.mode] ?? e.mode}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="card" aria-labelledby="fit-h">
        <h2 id="fit-h">Check fit</h2>
        {!latestCheck && fitEvent(o) ? (
          <p className="small">
            {fitEvent(o)!.summary} <span className="muted">({fitEvent(o)!.actor} · {formatDate(fitEvent(o)!.at)}; the full condition lists appear once this deployment’s console is updated.)</span>
          </p>
        ) : !latestCheck ? (
          <p className="muted small">
            {recorded ? (checksOf(recording.overview).length ? "The replay hasn’t reached the fit check yet." : "This recording was captured before fit checks existed.") : "No fit check yet. The buyer’s agent calls check_applicability with facts its connector established before buying."}
          </p>
        ) : (
          <FitCheck c={latestCheck} />
        )}
        {checks.length > 1 && (
          <details className="small">
            <summary>Earlier checks ({checks.length - 1})</summary>
            <ul className="plain-list">
              {checks.slice(1).map((c) => (
                <li key={c._id}>
                  <span className={`badge ${REC_CLASS[c.recommendation]}`}>{REC_TEXT[c.recommendation]}</span> {c.title} · {c.principalName} · {formatDate(c.at)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card">
        <h2>Repair in the buyer’s code{bCand ? ` (${bCand.repo})` : ""}</h2>
        {!bCand ? (
          <p className="muted small">No candidate patch yet.</p>
        ) : (
          <>
            <div className="row gap wrap">
              <span className={`badge ${bCand.passed ? "ok" : "sev-high"}`}>{bCand.passed ? "Accepted" : "Rejected"}</span>
              <span className="small">
                Protected tests: before {bBase?.passedCount ?? "?"}/{bBase?.total ?? "?"} → after {bCand.passedCount}/{bCand.total}
              </span>
              {bCand.changedFiles.length > 0 && <span className="small muted">Changed: {bCand.changedFiles.join(", ")}</span>}
            </div>
            <p className="small muted">{bCand.note ? `${bCand.note} · ` : ""}checked by {bCand.toolName} · suite {bCand.protectedSuiteHash.slice(0, 18)}… · {formatDate(bCand.at)}</p>
            <div className="grid-2">
              <ul className="plain-list small">
                {bCand.tests.map((t) => (
                  <li key={t.name}>
                    <span className={t.ok ? "ok-text" : "warn-text"}>{t.ok ? "PASS" : "FAIL"}</span> {t.name}
                  </li>
                ))}
              </ul>
              {bCand.diff && <pre className="diff-view" aria-label="Proposed diff">{bCand.diff}</pre>}
            </div>
            <p className="small muted">Factory Droid patched an isolated copy; protected tests decided. The buyer’s repository itself is never modified.</p>
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Security</h2>
          {security.length === 0 ? (
            <p className="muted small">No denials yet.</p>
          ) : (
            <ul className="plain-list small">
              {security.map((e) => (
                <li key={e._id}>
                  <span className={`badge ${e.status === "denied" ? "warn" : "ok"}`}>{e.status}</span> {e.summary}
                </li>
              ))}
            </ul>
          )}
          <p className="small muted">Only categories are shown, never values · {o.submissions.filter((s) => s.moderation === "quarantined").length} quarantined</p>
        </section>
        <section className="card">
          <h2>Policies</h2>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Scopes</th>
                <th>Budget (test USDC)</th>
              </tr>
            </thead>
            <tbody>
              {o.principals.map((p) => (
                <tr key={p.name}>
                  <td>
                    {p.name}
                    <div className="small muted">
                      {orgName(p.orgSlug)} · {p.revoked ? "revoked" : `expires ${new Date(p.expiresAt).toLocaleDateString()}`}
                    </div>
                  </td>
                  <td className="small">{p.scopes.join(", ")}</td>
                  <td className="small">
                    {p.policy.maxPurchases === 0 ? "No spending" : `≤ ${formatAtomic(p.policy.maxPerPurchaseAtomic)} per guide, ≤ ${formatAtomic(p.policy.sessionMaxAtomic)} per session, ${p.policy.maxPurchases} max`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="small muted">
            Set by an operator. Retrieved content can’t change them. <Link to="/connect">Connect your own agent</Link>
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Receipts</h2>
        {o.purchases.length === 0 ? (
          <p className="muted small">No agent purchases yet.</p>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Amount</th>
                <th>Contributor share</th>
                <th>Platform</th>
                <th>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {o.purchases.map((p) => {
                const sim = p.provider === "demo_simulator";
                return (
                  <tr key={p._id}>
                    <td>
                      <span className={`badge ${p.status.endsWith("success") ? "ok" : p.status === "pending" ? "warn" : ""}`}>
                        {p.status === "test_success" ? "Settled · x402 testnet" : p.status === "simulated_success" ? "Simulated" : p.status === "pending" ? "Pending" : "Cancelled"}
                      </span>
                      <div className="small muted">revision {p.revision}</div>
                    </td>
                    <td>{formatAtomic(p.amountAtomic)} {sim ? "USDC (simulated)" : "test USDC"}</td>
                    <td className="small">
                      {formatAtomic(p.contributorShareAtomic)}
                      <div className="muted">{p.status === "test_success" ? "accrued, not paid out" : sim ? "not counted" : "—"}</div>
                    </td>
                    <td className="small">{formatAtomic(p.platformShareAtomic)}</td>
                    <td className="small">
                      {p.txHash ? (
                        <a href={`https://sepolia.basescan.org/tx/${p.txHash}`} target="_blank" rel="noreferrer noopener">
                          Base Sepolia tx <code>{p.txHash.slice(0, 10)}…</code> ↗
                        </a>
                      ) : sim ? (
                        "simulated, no funds moved"
                      ) : p.status === "pending" ? (
                        "not settled yet"
                      ) : (
                        "no transaction"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FitCheck({ c }: { c: Check }) {
  return (
    <>
      <div className="fit-verdict">
        <span className={`badge ${REC_CLASS[c.recommendation]}`}>{REC_TEXT[c.recommendation]}</span>
        <strong>{c.title}</strong>
        <span className="small muted">
          revision {c.revision} · {c.principalName} · {formatDate(c.at)}
        </span>
      </div>
      <p className="small">{c.reason}</p>
      <div className="fit-lists">
        <div>
          <h3>Matches ({c.matched.length})</h3>
          {c.matched.length === 0 ? (
            <p className="small muted">None.</p>
          ) : (
            <ul>
              {c.matched.map((m) => (
                <li key={m.fact}>
                  {m.label}: {m.observed ? "yes" : "no"}
                  <span className="src">{m.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Conflicts ({c.conflicts.length})</h3>
          {c.conflicts.length === 0 ? (
            <p className="small muted">None.</p>
          ) : (
            <ul>
              {c.conflicts.map((m) => (
                <li key={m.fact}>
                  {m.label}
                  <div className="small">
                    guide expects <strong>{m.expected ? "yes" : "no"}</strong>, observed <strong>{m.observed ? "yes" : "no"}</strong>
                  </div>
                  <span className="src">{m.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Needs verification ({c.needsVerification.length})</h3>
          {c.needsVerification.length === 0 ? (
            <p className="small muted">None.</p>
          ) : (
            <ul>
              {c.needsVerification.map((m, i) => (
                <li key={m.fact ?? `free-${i}`}>
                  {m.label}
                  {m.expected !== null && <span className="src">guide expects {m.expected ? "yes" : "no"}; not established</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
