import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatAtomic } from "../../convex/lib/money";
import { useSession } from "../session";
import { ErrorBox, Loading, PageHeader, formatDate } from "../components/ui";
import { Icon } from "../components/icons";

const RUNNER_URL = (import.meta.env.VITE_FACTORY_RUNNER_URL as string | undefined) ?? "http://127.0.0.1:3299";

type Overview = NonNullable<ReturnType<typeof useOverview>>;
function useOverview(actor: string) {
  return useQuery(api.agentsConsole.overview, { actor });
}

const STORY = [
  { key: "a_fixed", label: "A fixed a duplicate-delivery bug", test: (o: Overview) => o.runs.some((r) => r.repo === "repo-a" && r.stage === "candidate" && r.passed) },
  { key: "shared", label: "Shared an approved, sanitized lesson", test: (o: Overview) => o.submissions.some((s) => s.status === "published") },
  { key: "found", label: "B found an applicable guide via MCP", test: (o: Overview) => o.events.some((e) => e.kind === "quote_resolution") },
  { key: "paid", label: "Test payment authorized within budget", test: (o: Overview) => o.purchases.some((p) => p.status === "test_success" || p.status === "simulated_success") },
  { key: "adapted", label: "Factory Droid adapted the fix in B", test: (o: Overview) => o.runs.some((r) => r.repo === "repo-b" && r.stage === "candidate") },
  { key: "passed", label: "B's protected tests passed", test: (o: Overview) => o.runs.some((r) => r.repo === "repo-b" && r.stage === "candidate" && r.passed) },
];

export default function Agents() {
  const { actor } = useSession();
  const o = useOverview(actor);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!o) return <Loading />;
  const job = o.jobs[0];
  const running = job && job.status === "running";

  const start = async (simulatePayment: boolean) => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${RUNNER_URL}/agent-demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actor, simulatePayment }) });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Runner responded ${res.status}`);
    } catch {
      setError("The local runner is offline. Start it with `npm run dev`.");
    } finally {
      setStarting(false);
    }
  };

  const lane = (name: "contributor" | "consumer") => o.events.filter((e) => e.lane === name).slice(0, 14);
  const security = o.events.filter((e) => e.lane === "security").slice(0, 10);
  const latest = (repo: string, stage: string) => o.runs.find((r) => r.repo === repo && r.stage === stage);
  const bCand = latest("repo-b", "candidate");

  return (
    <div className="agents">
      <PageHeader eyebrow="Agents learning from each other" title="Agent activity">
        <button className="btn primary" disabled={starting || running} onClick={() => void start(false)}>
          {running ? "Running…" : "Run two-agent demo"}
        </button>
        <button className="btn" disabled={starting || running} onClick={() => void start(true)} title="Same flow, explicit simulator instead of test USDC">
          Run with simulated payment
        </button>
      </PageHeader>
      <ErrorBox message={error} />
      {job && (
        <p className="small muted">
          Last run: <strong>{job.status}</strong>
          {job.stage ? ` · ${job.stage}` : ""} · started {formatDate(job.startedAt)}
          {job.error ? ` · ${job.error}` : ""}
        </p>
      )}

      <ol className="story" aria-label="What happened">
        {STORY.map((s) => {
          const done = s.test(o);
          return (
            <li key={s.key} className={done ? "done" : ""}>
              <span className="story-dot" aria-hidden>{done ? <Icon name="check" size={14} /> : null}</span>
              {s.label}
            </li>
          );
        })}
      </ol>

      <div className="lanes">
        {(["contributor", "consumer"] as const).map((name) => (
          <section key={name} className="card lane" aria-label={name === "contributor" ? "Contributor agent" : "Buyer agent"}>
            <div className="lane-head">
              <h2>{name === "contributor" ? "Agent A · contributor" : "Agent B · buyer"}</h2>
              <span className="small muted">{name === "contributor" ? "repo-a · Northstar Cloud" : "repo-b · Harbor Analytics"}</span>
            </div>
            {lane(name).length === 0 ? (
              <p className="muted small">No activity yet. Run the demo or the connector CLI.</p>
            ) : (
              <ul className="events stagger">
                {lane(name).map((e) => (
                  <li key={e._id} className={`event ev-${e.status}`}>
                    <span className="dot-s" aria-hidden />
                    <div>
                      <div className="small">
                        <code>{e.kind}</code> · {e.actor} · <span className="muted">{new Date(e.at).toLocaleTimeString()}</span> · <span className="mode">{e.mode}</span>
                      </div>
                      <div>{e.summary}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="card">
        <h2>Repair evidence (repo B)</h2>
        {!bCand ? (
          <p className="muted small">No candidate patch yet.</p>
        ) : (
          <>
            <div className="row gap wrap">
              <span className={`badge ${bCand.passed ? "ok" : "sev-high"}`}>{bCand.passed ? "Accepted" : "Rejected"}</span>
              <span className="small">
                Protected tests: before {latest("repo-b", "baseline")?.passedCount ?? "?"}/{latest("repo-b", "baseline")?.total ?? "?"} → after {bCand.passedCount}/{bCand.total}
              </span>
              <span className="small muted">Allowed file: {bCand.changedFiles.join(", ") || "src/consumer/messageConsumer.mjs"}</span>
            </div>
            <p className="small muted">{bCand.note} · checked by {bCand.toolName} · suite {bCand.protectedSuiteHash.slice(0, 18)}… · {formatDate(bCand.at)}</p>
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
            <p className="small muted">
              Factory Droid proposed the patch in an isolated copy of repo B (tools: Read/LS/ApplyPatch). The connector checked the
              changed paths, then a separate protected runner tested it. Failed candidates are discarded; repo B itself is never modified.
            </p>
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Security enforcement</h2>
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
          <p className="small muted">Values are never shown — only categories and decisions. Quarantined submissions: {o.submissions.filter((s) => s.moderation === "quarantined").length}.</p>
        </section>
        <section className="card">
          <h2>Policies</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Scopes</th>
                <th>Budget</th>
              </tr>
            </thead>
            <tbody>
              {o.principals.map((p) => (
                <tr key={p.name}>
                  <td>
                    {p.name}
                    <div className="small muted">
                      {p.orgSlug} · {p.revoked ? "revoked" : `expires ${new Date(p.expiresAt).toLocaleDateString()}`}
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
          <p className="small muted">Installed by an operator; retrieved content can never change these.</p>
        </section>
      </div>

      <section className="card">
        <h2>Receipts</h2>
        {o.purchases.length === 0 ? (
          <p className="muted small">No agent purchases yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Amount</th>
                <th>Contributor accrual (not paid out)</th>
                <th>Platform</th>
                <th>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {o.purchases.map((p) => (
                <tr key={p._id}>
                  <td>{p.status.replace("_", " ")}</td>
                  <td>{formatAtomic(p.amountAtomic)} USDC</td>
                  <td>{formatAtomic(p.contributorShareAtomic)}</td>
                  <td>{formatAtomic(p.platformShareAtomic)}</td>
                  <td className="small">
                    {p.txHash ? (
                      <a href={`https://sepolia.basescan.org/tx/${p.txHash}`} target="_blank" rel="noreferrer noopener">
                        Base Sepolia tx ↗
                      </a>
                    ) : p.provider === "demo_simulator" ? (
                      "simulator (no funds)"
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
