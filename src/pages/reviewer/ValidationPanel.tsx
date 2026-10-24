import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useSession } from "../../session";
import { ErrorBox, IntegrationBadge, Loading, formatDate, useAction } from "../../components/ui";

const STEP_LABEL = { before: "Check before fix", fix: "Defensive fix", after: "Check after fix" } as const;

export function ValidationPanel({ draftId }: { draftId: Id<"incidentDrafts"> }) {
  const { actor } = useSession();
  const data = useQuery(api.validation.panel, { actor, draftId });
  const runCheck = useAction(useMutation(api.validation.runCheck));
  const applyFix = useAction(useMutation(api.validation.applyFix));

  if (!data) return <Loading />;
  const t = data.target;
  const runs = data.runs;
  const lastBefore = [...runs].reverse().find((r) => r.step === "before");
  const lastFix = [...runs].reverse().find((r) => r.step === "fix");
  const lastAfter = [...runs].reverse().find((r) => r.step === "after");
  const busy = runCheck.pending || applyFix.pending;

  return (
    <section className="card validation">
      <div className="toolbar">
        <h3>Validation panel</h3>
        <div className="toolbar-actions">
          <IntegrationBadge state="unavailable" name="Factory Droid" />
          <IntegrationBadge state="unavailable" name="Armadin" />
        </div>
      </div>
      {!t ? (
        <ErrorBox message="Demo target missing. Reset demo data from the Demo menu." />
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
            <code className="small">
              config v{t.configVersion}: maxFailedAttempts={t.config.maxFailedAttempts}, lockoutWindowSeconds=
              {t.config.lockoutWindowSeconds}, alertOnRepeatedFailures={String(t.config.alertOnRepeatedFailures)}
            </code>
          </div>
          <p className="small muted">
            Check: <strong>{data.checkName}</strong>. Simulates a burst of failed sign-ins for a fictional test account
            inside the toy service and asserts they are throttled and alerted. No network or real system is touched.
          </p>
          <div className="steps3">
            <StepCard n={1} title={STEP_LABEL.before} run={lastBefore}>
              <button className="btn sm" disabled={busy} onClick={() => void runCheck.run({ actor, draftId, step: "before" })}>
                Run check
              </button>
            </StepCard>
            <StepCard n={2} title={STEP_LABEL.fix} run={lastFix}>
              <button className="btn sm" disabled={busy || !lastBefore} onClick={() => void applyFix.run({ actor, draftId })}>
                Apply defensive fix
              </button>
            </StepCard>
            <StepCard n={3} title={STEP_LABEL.after} run={lastAfter}>
              <button className="btn sm" disabled={busy || !lastFix} onClick={() => void runCheck.run({ actor, draftId, step: "after" })}>
                Re-run check
              </button>
            </StepCard>
          </div>
          {lastFix?.patchSummary && (
            <pre className="diff" aria-label="Applied configuration patch">
              {lastFix.patchSummary}
            </pre>
          )}
          <ErrorBox message={runCheck.error ?? applyFix.error} />
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
