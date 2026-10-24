import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSession } from "../../session";
import { ErrorBox, IntegrationBadge, Loading, formatDate, useAction } from "../../components/ui";

const STEP_LABEL = { before: "Check before fix", fix: "Defensive fix", after: "Check after fix" } as const;
const RUNNER_URL = (import.meta.env.VITE_FACTORY_RUNNER_URL as string | undefined) ?? "http://127.0.0.1:3299";

/** Is the local Factory runner (scripts/factory-runner.mjs) up and configured? */
function useFactoryRunner() {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${RUNNER_URL}/health`)
      .then((r) => r.json())
      .then((b: { ready?: boolean }) => !cancelled && setReady(!!b.ready))
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

async function runFactoryPatch(actor: string, draftId: string, toyCase: string): Promise<{ summary: string }> {
  const res = await fetch(`${RUNNER_URL}/patch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, draftId, toyCase }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; summary?: string };
  if (!res.ok) throw new Error(body.error ?? `Factory runner responded ${res.status}`);
  return { summary: body.summary ?? "" };
}

export function ValidationPanel({ draftId }: { draftId: Id<"incidentDrafts"> }) {
  const { actor } = useSession();
  const data = useQuery(api.validation.panel, { actor, draftId });
  const runCheck = useAction(useMutation(api.validation.runCheck));
  const applyFix = useAction(useMutation(api.validation.applyFix));
  const factory = useAction(runFactoryPatch);
  const runnerReady = useFactoryRunner();
  const integrations = useQuery(api.integrations.status);
  const factoryState = integrations?.find((i) => i.key === "factory")?.state;
  const armadinState = integrations?.find((i) => i.key === "armadin")?.state;

  if (!data) return <Loading />;
  const t = data.target;
  const runs = data.runs;
  const lastBefore = [...runs].reverse().find((r) => r.step === "before");
  const lastFix = [...runs].reverse().find((r) => r.step === "fix");
  const lastFixIdx = runs.map((r) => r.step).lastIndexOf("fix");
  const lastAfter = lastFixIdx >= 0 ? runs.slice(lastFixIdx + 1).find((r) => r.step === "after") : undefined;
  const busy = runCheck.pending || applyFix.pending || factory.pending;

  return (
    <section className="card validation">
      <div className="toolbar">
        <h3>Validation panel</h3>
        <div className="toolbar-actions">
          {factoryState && <IntegrationBadge state={runnerReady === false && factoryState !== "unavailable" ? "error" : factoryState} name="Factory Droid" />}
          {armadinState && <IntegrationBadge state={armadinState} name="Armadin" />}
        </div>
      </div>
      {!data.toyCase ? (
        <p className="muted small">This incident has no bundled sample app, so it cannot be test-reproduced. Use “Evidence reviewed” or “Contributor reported”.</p>
      ) : !t ? (
        <ErrorBox message="Sample app missing. Reset demo data from the Demo menu." />
      ) : (
        <>
          <div className={`target ${t.authorized ? "authorized" : "unauthorized"}`}>
            <div>
              <strong>{t.name}</strong>
              <span className={`badge ${t.authorized ? "ok" : "sev-high"}`}>
                {t.authorized ? "Authorized local demo target" : "Not authorized"}
              </span>
            </div>
            <div className="small muted">{t.authorizationNote}</div>
            <code className="small">current implementation: {t.variant === "fixed" ? "patched (reference fix)" : "original (vulnerable)"}</code>
          </div>
          <div className="state state-info small">
            <strong>In plain words:</strong> we run automatic tests on a tiny copy of an app with fake data. Step 1 should
            show the problem. Step 2 applies the fix. Step 3 proves the problem is gone and normal use still works.
          </div>
          <p className="small muted">
            Check: <strong>{data.checkName}</strong>. Protected assertions run against the sample app with synthetic data,
            including checks that legitimate behavior still works. No network or real system is touched.
          </p>
          <div className="steps3">
            <StepCard n={1} title={STEP_LABEL.before} run={lastBefore}>
              <button className="btn sm" disabled={busy} onClick={() => void runCheck.run({ actor, draftId, step: "before" })}>
                Run check
              </button>
            </StepCard>
            <StepCard n={2} title={STEP_LABEL.fix} run={lastFix}>
              {runnerReady && (
                <button className="btn sm primary" disabled={busy || !lastBefore} onClick={() => data.toyCase && void factory.run(actor, draftId, data.toyCase)}>
                  {factory.pending ? "Factory Droid working…" : "Apply fix with Factory Droid"}
                </button>
              )}
              <button className="btn sm" disabled={busy || !lastBefore} onClick={() => void applyFix.run({ actor, draftId })}>
                {runnerReady ? "Use local demo adapter" : "Apply defensive fix"}
              </button>
              {runnerReady === false && <span className="small muted">Factory runner offline — local demo adapter only.</span>}
            </StepCard>
            <StepCard n={3} title={STEP_LABEL.after} run={lastAfter}>
              {lastFix?.toolName.startsWith("Factory") ? (
                <span className="small muted">Re-checked by the protected evaluator against Factory’s candidate code.</span>
              ) : (
                <button className="btn sm" disabled={busy || !lastFix} onClick={() => void runCheck.run({ actor, draftId, step: "after" })}>
                  Re-run check
                </button>
              )}
            </StepCard>
          </div>
          {lastFix?.patchSummary && (
            <pre className="diff" aria-label="Applied configuration patch">
              {lastFix.patchSummary}
            </pre>
          )}
          <ErrorBox message={runCheck.error ?? applyFix.error ?? factory.error} />
          {runs.length > 0 && (
            <details className="run-log">
              <summary>Run log ({runs.length})</summary>
              {runs.map((r) => (
                <div key={r._id} className="run-entry">
                  <div className="small">
                    <strong>{STEP_LABEL[r.step]}</strong> · {formatDate(r.runAt)} · tool: {r.toolName}
                  </div>
                  <pre>{r.outputLines.join("\n")}</pre>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}

type Run = { step: string; passed?: boolean; resultSummary: string; toolName: string; outputLines: string[] };

function StepCard({ n, title, run, children }: { n: number; title: string; run?: Run; children: React.ReactNode }) {
  const state = !run ? "pending" : run.step === "fix" ? "applied" : run.passed ? "pass" : "fail";
  return (
    <div className={`step-card step-${state}`}>
      <div className="step-num">{n}</div>
      <div className="step-title">{title}</div>
      <div className={`step-result result-${state}`}>
        {state === "pending" ? "Not run" : state === "applied" ? "Applied" : state === "pass" ? "PASS" : "FAIL"}
      </div>
      {run && (
        <>
          <div className="small">{run.resultSummary}</div>
          <div className="small muted">Tool: {run.toolName}</div>
        </>
      )}
      {children}
    </div>
  );
}
