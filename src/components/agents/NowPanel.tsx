// Current stage and next action, derived only from the stored job and events (or the recording).
import { useEffect, useState } from "react";
import type { AgentEvent, Overview } from "./activity";
import { kindLabel } from "./activity";

type Job = Overview["jobs"][number] | undefined;
export type RunnerState = "connected" | "unreachable" | "checking" | "not_applicable";

/** Poll the presenter's local runner health endpoint (operator on a local console only). */
export function useRunnerHealth(url: string, enabled: boolean): RunnerState {
  const [state, setState] = useState<RunnerState>(enabled ? "checking" : "not_applicable");
  useEffect(() => {
    if (!enabled) {
      setState("not_applicable");
      return;
    }
    let cancelled = false;
    const check = () =>
      fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
        .then((r) => !cancelled && setState(r.ok ? "connected" : "unreachable"))
        .catch(() => !cancelled && setState("unreachable"));
    void check();
    const t = setInterval(check, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [url, enabled]);
  return state;
}

export function NowPanel({ job, events, recorded, replaying, operator, runner, buyerPassed }: {
  job: Job; events: AgentEvent[]; recorded: boolean; replaying: boolean; operator: boolean; runner: RunnerState; buyerPassed: { passed: number; total: number } | null;
}) {
  const latest = events[0];
  const problem = events.find((e) => e.status === "denied" || e.status === "error");
  let tone: "ok" | "warn" | "bad" | "idle" = "idle";
  let now: string;
  let next: string;
  if (recorded) {
    tone = "idle";
    now = replaying ? `Replaying: ${latest ? `${kindLabel(latest.kind)} — ${latest.summary}` : "starting"}` : "Showing a recording of an earlier real run.";
    next = replaying ? "Watch the lanes fill in; open any event for its evidence." : "Press Replay to step through it, or open the Live tab.";
  } else if (!job) {
    now = "No agent run yet on this deployment.";
    next = operator ? (runner === "unreachable" ? "Start the local runner (npm run dev:factory), then press Run demo." : "Press Run demo.") : "Open the Recorded run tab, or wait for the presenter to start a run.";
  } else if (job.status === "running" || job.status === "queued") {
    tone = "warn";
    now = `Running: ${job.stage ?? "starting"}${latest ? ` · latest: ${kindLabel(latest.kind)}` : ""}`;
    next = "The agents are working (usually 30–90 s). Events appear below as they are recorded.";
  } else if (job.status === "failed") {
    tone = "bad";
    now = `Last run failed at “${job.stage ?? "unknown stage"}”${job.error ? `: ${job.error}` : ""}.`;
    next = problem ? `Open the red “${kindLabel(problem.kind)}” event below for details. A completed purchase of the same revision is reused on retry.` : "Check the runner terminal, then run again.";
  } else if (job.status === "succeeded") {
    tone = "ok";
    now = buyerPassed ? `Done: the buyer's protected tests ${buyerPassed.passed === buyerPassed.total ? "passed" : "failed"} (${buyerPassed.passed}/${buyerPassed.total}).` : "Last run finished.";
    next = "Inspect the payment and the patch below, or start another run.";
  } else {
    tone = "warn";
    now = `Last run ${job.status}.`;
    next = operator ? "Press Run demo to start again." : "Open the Recorded run tab.";
  }
  return (
    <section className={`now-panel now-${tone}`} aria-live="polite" aria-label="Current stage">
      <div className="now-row">
        <span className="now-label">Now</span>
        <span className="now-text">{now}</span>
      </div>
      <div className="now-row">
        <span className="now-label">Next</span>
        <span className="now-text">{next}</span>
      </div>
      {operator && !recorded && runner !== "not_applicable" && (
        <div className="now-row small">
          <span className="now-label">Runner</span>
          <span className={runner === "connected" ? "ok-text" : runner === "unreachable" ? "warn-text" : "muted"}>
            {runner === "connected" ? "Local runner connected" : runner === "unreachable" ? "Local runner not reachable: live runs are unavailable; you can still inspect events and replay the recording." : "Checking the local runner…"}
          </span>
        </div>
      )}
    </section>
  );
}
