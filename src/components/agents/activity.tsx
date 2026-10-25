// Two-agent activity lanes. Every row is a stored event (agentEvents); nothing here is generated or animated
// as if live. Rows expand to the sanitized technical evidence recorded with the event.
import { useId, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type Overview = FunctionReturnType<typeof api.agentsConsole.overview>;
export type AgentEvent = Overview["events"][number];

const KIND_LABEL: Record<string, string> = {
  search_resolutions: "Searched the exchange",
  quote_resolution: "Requested a quote",
  check_applicability: "Checked fit",
  applicability_checked: "Checked fit",
  applicability_declined: "Fit check declined",
  applicability_unavailable: "Fit check unavailable",
  get_my_access: "Checked access",
  acquire_resolution: "Requested access",
  acquire_denied: "Purchase refused",
  budget_exceeded: "Refused: over budget",
  payment_settled: "Payment settled",
  payment_failed: "Payment failed",
  payment_unconfirmed: "Payment unconfirmed",
  entitlement_granted: "Access granted",
  entitlement_reused: "Reused earlier purchase",
  retrieve_resolution: "Retrieved the revision",
  record_outcome: "Recorded the outcome",
  submit_resolution: "Submitted a resolution",
  submit_denied: "Submission refused",
  needs_approval: "Waiting for the developer",
  developer_approval: "Developer approved",
  submission_quarantined: "Submission quarantined",
  sensitive_content_detected: "Sensitive content refused",
  local_disclosure_gate: "Local privacy gate",
  staging_blocked: "Local gate blocked upload",
  baseline_tests: "Protected tests (before)",
  candidate_tests: "Protected tests (after)",
  factory_repair_started: "Adapting the fix",
  factory_repair_finished: "Patch proposed",
  factory_unavailable: "Repair agent unavailable",
  patch_rejected: "Patch rejected by policy",
  repair_run_rejected: "Run record refused",
  quote_rejected: "Quote rejected by policy",
  abstain: "Abstained",
};
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const MODE_INFO: Record<string, { label: string; title: string }> = {
  local: { label: "local", title: "Ran in the exchange or on the presenter's machine (connector, protected runner)" },
  live: { label: "live", title: "Called an external service for real (Moss search, Factory Droid)" },
  testnet: { label: "testnet", title: "Base Sepolia test network: test USDC, real on-chain transaction" },
  simulated: { label: "simulated", title: "Payment simulator: no funds moved" },
  recorded: { label: "recorded", title: "From a recording of an earlier real run" },
  unavailable: { label: "unavailable", title: "The service was not available; nothing was simulated" },
};
const STATUS_TEXT: Record<AgentEvent["status"], string> = { ok: "done", pending: "pending at this event", denied: "denied", error: "failed" };

/** Which lane an event belongs in. Security events go to the lane of the agent they concern. */
export function laneOf(e: AgentEvent, sellers: Set<string>, buyers: Set<string>): "contributor" | "consumer" | "other" {
  if (e.lane === "contributor" || e.lane === "consumer") return e.lane;
  const base = e.actor.replace(/ connector$/, "");
  if (sellers.has(base)) return "contributor";
  if (buyers.has(base)) return "consumer";
  return "other";
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function EventRow({ e, recorded, title }: { e: AgentEvent; recorded: boolean; title?: (id: string) => string | undefined }) {
  const [open, setOpen] = useState(false);
  const d = e.detail;
  const mode = MODE_INFO[e.mode] ?? { label: e.mode, title: e.mode };
  const panelId = useId();
  return (
    <li className={`event ev-${e.status}`}>
      <span className="dot-s" aria-hidden />
      <div className="ev-body">
        <button type="button" className="ev-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((x) => !x)}>
          <span className="ev-line">
            <strong className="ev-kind">{kindLabel(e.kind)}</strong> <span className="ev-summary">{e.summary}</span>
          </span>
          <span className="ev-meta small">
            <span className={`ev-status st-${e.status}`}>{STATUS_TEXT[e.status]}</span> · <time dateTime={new Date(e.at).toISOString()}>{time(e.at)}</time> ·{" "}
            <span className="mode" title={mode.title}>{mode.label}</span>
            {recorded && <> · <span className="mode" title={MODE_INFO.recorded.title}>recorded</span></>}
            <span className="ev-chevron" aria-hidden>{open ? "−" : "+"}</span>
          </span>
        </button>
        {open && (
          <div className="ev-detail" id={panelId}>
            {!d ? (
              <p className="small muted">No technical details were recorded for this event (it predates detail capture or has none).</p>
            ) : (
              <dl className="kv small">
                {d.tool && (<><dt>Tool</dt><dd><code>{d.tool}</code></dd></>)}
                {d.input?.length ? (<><dt>Inputs (sanitized)</dt><dd><KV list={d.input} /></dd></>) : null}
                {d.result && (<><dt>Result</dt><dd>{d.result}</dd></>)}
                {d.resolutionId && (<><dt>Resolution</dt><dd>{title?.(d.resolutionId) ?? "guide"} <code>{d.resolutionId.slice(-8)}</code>{d.revision ? ` · revision ${d.revision}` : ""}</dd></>)}
                {d.evidence?.length ? (<><dt>Evidence</dt><dd><KV list={d.evidence} /></dd></>) : null}
              </dl>
            )}
            <p className="small muted ev-foot">
              {e.actor} · {new Date(e.at).toISOString()} · status <code>{e.status}</code> · mode <code>{e.mode}</code>
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

function KV({ list }: { list: { k: string; v: string }[] }) {
  return (
    <ul className="kv-list">
      {list.map((x, i) => (
        <li key={`${x.k}-${i}`}>
          <span className="muted">{x.k}:</span> <span className="kv-v">{x.v}</span>
        </li>
      ))}
    </ul>
  );
}

const PROBLEM = new Set(["denied", "error"]);

export function Lane({ name, heading, meta, events, recorded, title }: { name: "contributor" | "consumer"; heading: string; meta: string; events: AgentEvent[]; recorded: boolean; title: (id: string) => string | undefined }) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const problems = events.filter((e) => PROBLEM.has(e.status)).length;
  const filtered = problemsOnly && problems > 0 ? events.filter((e) => PROBLEM.has(e.status)) : events;
  const shown = showAll ? filtered : filtered.slice(0, 12);
  return (
    <section className="card lane" aria-label={heading}>
      <div className="lane-head">
        <h2>{heading}</h2>
        <span className="small muted">{meta}</span>
      </div>
      {problems > 0 && (
        <label className="small lane-filter">
          <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} /> Only denials and failures ({problems})
        </label>
      )}
      {filtered.length === 0 ? (
        <p className="muted small">{problemsOnly ? "No denials or failures." : name === "contributor" ? "No contributor activity yet." : "No buyer activity yet."}</p>
      ) : (
        <ul className="events">
          {shown.map((e) => <EventRow key={e._id} e={e} recorded={recorded} title={title} />)}
        </ul>
      )}
      {filtered.length > 12 && (
        <button type="button" className="btn sm" onClick={() => setShowAll((x) => !x)}>
          {showAll ? "Show fewer" : `Show ${filtered.length - 12} older`}
        </button>
      )}
    </section>
  );
}
