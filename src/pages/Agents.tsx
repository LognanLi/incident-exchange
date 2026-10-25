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
import { EventRow, Lane, laneOf } from "../components/agents/activity";
import { EarningsPanel, PaymentInspector } from "../components/agents/payments";
import { NowPanel, useRunnerHealth } from "../components/agents/NowPanel";
import { checksOf, paymentsOf, duringRun, recordedUntil, type Recording } from "../components/agents/timeline";

const RUNNER_URL = (import.meta.env.VITE_FACTORY_RUNNER_URL as string | undefined) ?? "http://127.0.0.1:3299";

type Overview = NonNullable<ReturnType<typeof useOverview>>;
type Check = Overview["applicabilityChecks"][number];
function useOverview(actor: string) {
  return useQuery(api.agentsConsole.overview, { actor });
}

/** A real earlier run captured by scripts/record-run.mjs. Viewing it executes nothing. */
const recording = recordingFile as unknown as Recording;
const REPLAY_SPEED = 2;

/** Which agent is the contributor and which the buyer, by their operator-granted scopes. */
function roles(o: Overview) {
  const sellers = new Set(o.principals.filter((p) => p.scopes.includes("submit")).map((p) => p.name));
  const buyers = new Set(o.principals.filter((p) => p.scopes.includes("acquire")).map((p) => p.name));
  const isSellerRun = (r: Overview["runs"][number]) => sellers.has(r.principalName) || (!sellers.size && r.repo === "repo-a");
  const isBuyerRun = (r: Overview["runs"][number]) => buyers.has(r.principalName) || (!buyers.size && r.repo === "repo-b");
  return { sellers, buyers, isSellerRun, isBuyerRun };
}

/** The buyer's latest candidate test result, for the Now panel. */
function bCandNow(o: Overview) {
  const r = o.runs.find((x) => roles(o).isBuyerRun(x) && x.stage === "candidate");
  return r ? { passed: r.passedCount, total: r.total } : null;
}

const fitEvent = (o: Overview) => o.events.find((e) => ["applicability_checked", "check_applicability", "applicability_declined"].includes(e.kind));

type StepState = boolean | "declined";
const STORY: { key: string; label: string; test: (o: Overview) => StepState }[] = [
  { key: "a_fixed", label: "A fixed a bug; its protected tests passed", test: (o) => o.runs.some((r) => roles(o).isSellerRun(r) && r.stage === "candidate" && r.passed) },
  { key: "shared", label: "Shared an approved, sanitized lesson", test: (o) => o.events.some((e) => e.kind === "submit_resolution" && e.status === "ok") },
  { key: "found", label: "B found a candidate guide via MCP", test: (o) => o.events.some((e) => e.kind === "search_resolutions" && e.status === "ok") },
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
  { key: "paid", label: "Paid within budget (or reused an earlier purchase)", test: (o) => o.events.some((e) => ["payment_settled", "entitlement_granted", "entitlement_reused"].includes(e.kind) && e.status === "ok") },
  { key: "adapted", label: "An adapted patch was checked in B’s code", test: (o) => o.runs.some((r) => roles(o).isBuyerRun(r) && r.stage === "candidate") },
  { key: "passed", label: "B’s protected tests passed", test: (o) => o.runs.some((r) => roles(o).isBuyerRun(r) && r.stage === "candidate" && r.passed) },
];

const REC_TEXT = { recommend: "Recommend", verify_first: "Verify first", decline: "Declined" } as const;
const REC_CLASS = { recommend: "ok", verify_first: "warn", decline: "sev-high" } as const;

export default function Agents() {
  const session = useSession();
  const { actor } = session;
  const live = useOverview(actor);
  const [mode, setMode] = useState<"live" | "recorded">("live");
  const [replayAt, setReplayAt] = useState<number | null>(null); // null = show the whole recording
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (mode !== "recorded" || paused || replayAt === null || replayAt >= recording.run.finishedAt) return;
    const t = setTimeout(() => setReplayAt((x) => (x === null ? null : Math.min(recording.run.finishedAt, x + 500 * REPLAY_SPEED))), 500);
    return () => clearTimeout(t);
  }, [mode, replayAt, paused]);
  const recorded = mode === "recorded";
  const [history, setHistory] = useState(false);
  const o = recorded ? recordedUntil(recording, replayAt ?? recording.run.finishedAt) : live && !history && live.jobs[0] ? duringRun(live, live.jobs[0]) : live;
  const reviewerSlug = session.slugForRole("reviewer");
  const reviewerOrg = session.orgs?.find((x) => x.slug === reviewerSlug);
  const [starting, setStarting] = useState(false);
  const [scenario, setScenario] = useState<"dedupe" | "tenant">("dedupe");
  const [error, setError] = useState<string | null>(null);
  const runner = useRunnerHealth(RUNNER_URL, session.operator && !session.hosted && !recorded);
  if (!o) return <Loading />;
  const job = o.jobs[0];
  const running = !recorded && job && (job.status === "running" || job.status === "queued");

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
      setError("Can’t reach your local runner. Start `npm run dev:factory` and `npm run dev:mcp` on this machine. For the hosted console, allow local network access if your browser asks, or present from http://localhost:5173.");
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
  const laneEvents = (name: "contributor" | "consumer") => o.events.filter((e) => laneOf(e, sellers, buyers) === name);
  const payments = paymentsOf(o).filter((p) => recorded || history || !job || o.events.some((e) => e.refs.includes(p.quoteId) || (p.purchaseId && e.refs.includes(p.purchaseId))));
  const titles = new Map<string, string>([...payments.map((p) => [p.resolutionId, p.title] as const), ...checksOf(o).map((c) => [c.playbookId as string, c.title] as const)]);
  const titleOf = (id: string) => titles.get(id);
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
            <button className="btn primary" disabled={starting || running || runner === "unreachable"} title={runner === "unreachable" ? "The local runner isn't reachable (npm run dev:factory)" : undefined} onClick={() => void start(false)}>
              {running ? "Running…" : "Run demo"}
            </button>
            <button className="btn" disabled={starting || running || runner === "unreachable"} onClick={() => void start(true)} title="Same flow, with a payment simulator instead of test USDC">
              Simulated payment
            </button>
          </>
        )}
        {recorded && (
          <button className="btn primary" onClick={() => { setPaused(false); setReplayAt(recording.run.startedAt); }} disabled={replayAt !== null && replayAt < recording.run.finishedAt}>
            {replayAt !== null && replayAt < recording.run.finishedAt ? "Replaying…" : "Replay"}
          </button>
        )}
      </PageHeader>
      <StoryStrip sentence={false} />
      <div className="mode-tabs" role="group" aria-label="Live or recorded">
        <button aria-pressed={!recorded} className={!recorded ? "active" : ""} onClick={() => setMode("live")}>
          Live
        </button>
        <button aria-pressed={recorded} className={recorded ? "active" : ""} onClick={() => { setMode("recorded"); setReplayAt(null); }}>
          Recorded run
        </button>
      </div>
      {recorded && (
        <div className="recording-banner" role="note">
          <strong>Recording — not live.</strong> Captured from a real run on {formatDate(recording.run.startedAt)} ({Math.round(recording.run.durationMs / 1000)} s, deployment {recording.source.deployment}, commit {recording.source.commit}{recording.source.workingTree ? ` + ${recording.source.workingTree}` : ""}).
          Viewing or replaying it runs no code and moves no money.{replayAt !== null && replayAt < recording.run.finishedAt ? ` Replay at ${REPLAY_SPEED}× · ${Math.round((replayAt - recording.run.startedAt) / 1000)} s into the run.` : ""}
        </div>
      )}
      {recorded && <div className="replay-controls row gap wrap">
        <button className="btn sm" disabled={replayAt === null || replayAt >= recording.run.finishedAt} onClick={() => setPaused((x) => !x)}>{paused ? "Resume replay" : "Pause replay"}</button>
        <label className="small">Recording position <input type="range" min={recording.run.startedAt} max={recording.run.finishedAt} step={100} value={replayAt ?? recording.run.finishedAt} onChange={(e) => { setPaused(true); setReplayAt(Number(e.target.value)); }} aria-label="Recording position" /></label>
        <button className="btn sm" onClick={() => { setPaused(false); setReplayAt(null); }}>Show complete recording</button>
        <span className="small muted">{paused && replayAt !== null ? "Paused · " : ""}{Math.round(((replayAt ?? recording.run.finishedAt) - recording.run.startedAt) / 1000)} / {Math.round(recording.run.durationMs / 1000)} s</span>
      </div>}
      {!recorded && !session.operator && (
        <div className="role-note">
          <span><strong>Viewer mode.</strong> Run demo requires the presenter’s local runner. Watch live activity here, or open Recorded run. Presenting from this machine? Start <code>npm run dev:factory</code> and <code>npm run dev:mcp</code>, then connect below.</span>
          <button className="btn sm" onClick={() => session.setPresenterMode(true)}>Enable presenter mode</button>
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
      <NowPanel
        job={recorded ? recording.overview.jobs[0] : job}
        events={o.events}
        recorded={recorded}
        replaying={recorded && replayAt !== null && replayAt < recording.run.finishedAt}
        operator={session.operator}
        runner={runner}
        buyerPassed={bCandNow(!recorded && live?.jobs[0] ? duringRun(live, live.jobs[0]) : o)}
      />
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

      {!recorded && <label className="small lane-filter"><input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /> Show all recent activity, including earlier failures</label>}
      <h2 className="section-title story-title">{recorded ? "In this recording" : history ? "Recent activity" : "Latest run"}</h2>
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
        <Lane key={`${mode}-contributor`} name="contributor" heading="Agent A · contributor" meta={laneMeta("contributor")} events={laneEvents("contributor")} recorded={recorded} title={titleOf} />
        <Lane key={`${mode}-consumer`} name="consumer" heading="Agent B · buyer" meta={laneMeta("consumer")} events={laneEvents("consumer")} recorded={recorded} title={titleOf} />
      </div>
      <p className="small muted lanes-note">
        The agents never talk to each other directly. Agent A's approved resolution is stored by the exchange; Agent B finds and buys it later through MCP
        tools, so A doesn't need to be online. Select an event to see the tool, sanitized inputs, result and evidence.
      </p>

      <PaymentInspector payments={payments} recorded={recorded} />
      <EarningsPanel e={(o as Partial<Overview>).earnings} recorded={recorded} />

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
            {bCand.detailsHidden && <p className="small muted">{recorded ? "Local patches and notes are excluded from the shareable recording." : "Patch details and local notes are hidden for this organization."}</p>}
              {bCand.diff && <pre className="diff-view" tabIndex={0} aria-label="Proposed diff">{bCand.diff}</pre>}
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
            <ul className="events">
              {security.map((e) => <EventRow key={e._id} e={e} recorded={recorded} title={titleOf} />)}
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
