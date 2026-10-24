import { useState } from "react";
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EVIDENCE_INFO, EVIDENCE_LEVELS, SECTION_INFO, SECTION_KEYS, type EvidenceLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import {
  Boundary,
  BulletText,
  ErrorBox,
  EvidenceBadge,
  IntegrationBadge,
  Loading,
  Money,
  PageHeader,
  RoleGate,
  StatusBadge,
  SuccessBox,
  formatDate,
  useAction,
} from "../../components/ui";
import { ValidationPanel } from "./ValidationPanel";

export default function ReviewDetailPage() {
  return (
    <RoleGate role="reviewer">
      <ReviewDetail />
    </RoleGate>
  );
}

const CHECKLIST: { key: keyof Checklist; label: string }[] = [
  { key: "sixSectionsComplete", label: "All six sections are present and specific" },
  { key: "noSensitiveData", label: "No credentials, personal data, customer data, or identifying details" },
  { key: "defensiveOnly", label: "Defensive guidance only — no exploit payloads or attack instructions" },
  { key: "evidenceSupportsLabel", label: "The evidence supports the selected label" },
  { key: "limitationsStated", label: "Limitations and uncertainty are clearly stated" },
];
type Checklist = {
  sixSectionsComplete: boolean;
  noSensitiveData: boolean;
  defensiveOnly: boolean;
  evidenceSupportsLabel: boolean;
  limitationsStated: boolean;
};

function ReviewDetail() {
  const { draftId } = useParams();
  const id = draftId as Id<"incidentDrafts">;
  const { actor } = useSession();
  const data = useQuery(api.reviews.getForReview, { actor, draftId: id });
  if (!data) return <Loading />;
  const d = data.draft;

  return (
    <div>
      <PageHeader eyebrow="Reviewer console · sanitized submission" title={d.publicTitle}>
        <StatusBadge status={d.status} />
      </PageHeader>
      <p>
        <Link to="/review">← Back to queue</Link>
      </p>

      <div className="grid-2 align-start">
        <div>
          <section className="card">
            <Boundary kind="public">Buyer-facing content as approved by the contributor</Boundary>
            <p>{d.sanitizedSummary}</p>
            <div className="row gap wrap">
              {d.systemCategories.map((c) => (
                <span key={c} className="badge cat">
                  {c}
                </span>
              ))}
              <span className="badge price">
                <Money atomic={d.priceAtomic} />
              </span>
              {d.draftEngine === "fallback" && <span className="badge muted-badge">Drafted by fallback (not Moss)</span>}
            </div>
            {d.sections ? (
              SECTION_KEYS.map((k) => (
                <div key={k} className="preview-section">
                  <h4>{SECTION_INFO[k].title}</h4>
                  <BulletText text={d.sections![k].body} />
                </div>
              ))
            ) : (
              <p className="muted">No sections.</p>
            )}
          </section>

          <section className="card private-card">
            <Boundary kind="private">Visible to reviewers only — not published</Boundary>
            <h3>Contributor’s evidence</h3>
            <p>{d.evidenceSummary || <span className="muted">No evidence described.</span>}</p>
            <h3>Privacy scan</h3>
            <p className="small">
              {d.privacyScannedAt ? `Last run ${formatDate(d.privacyScannedAt)}` : "Not run"} ·{" "}
              {d.privacyFindings.filter((f) => f.severity === "high").length} high ·{" "}
              {d.privacyFindings.filter((f) => f.severity === "medium").length} medium
            </p>
            {d.privacyFindings.length > 0 && (
              <ul className="plain-list small">
                {d.privacyFindings.map((f) => (
                  <li key={f.id}>
                    <span className={`badge sev-${f.severity}`}>{f.severity}</span> {f.label} in {f.field}: <code>{f.excerpt}</code>
                  </li>
                ))}
              </ul>
            )}
            <h3>Contributor approval</h3>
            <p className="small">
              {d.contributorApproval ? (
                <>
                  Approved {formatDate(d.contributorApproval.at)} ·{" "}
                  {data.approvalIsCurrent ? (
                    <span className="badge ok">Matches current content</span>
                  ) : (
                    <span className="badge sev-high">Content changed since approval</span>
                  )}
                </>
              ) : (
                "Not approved"
              )}
            </p>
          </section>

          {data.reviews.length > 0 && (
            <section className="card">
              <h3>Decision history</h3>
              <ul className="plain-list small">
                {data.reviews.map((r) => (
                  <li key={r._id}>
                    {formatDate(r.createdAt)} — <strong>{r.decision.replace("_", " ")}</strong>
                    {r.evidenceLevel ? ` · ${EVIDENCE_INFO[r.evidenceLevel].label}` : ""}
                    {r.note ? ` · “${r.note}”` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div>
          <References draftId={id} />
          <ValidationPanel draftId={id} />
          {d.status === "submitted" ? (
            <DecisionPanel draftId={id} autoChecks={data.autoChecks} reproduced={data.reproduced} />
          ) : (
            <EvidenceUpdater draftId={id} status={d.status} current={d.evidenceLevel} reproduced={data.reproduced} note={d.reviewerNote} />
          )}
        </div>
      </div>
    </div>
  );
}

function References({ draftId }: { draftId: Id<"incidentDrafts"> }) {
  const { actor } = useSession();
  const refs = useQuery(api.references.list, { actor, draftId });
  const status = useQuery(api.integrations.status);
  const fetchRefs = useAction(useConvexAction(api.references.fetchReferences));
  const [message, setMessage] = useState<string | null>(null);
  const apify = status?.find((s) => s.key === "apify");

  return (
    <section className="card">
      <div className="toolbar">
        <h3>Public references</h3>
        <div className="toolbar-actions">
          {apify && <IntegrationBadge state={apify.state} name="Apify" />}
          <button
            className="btn sm"
            disabled={fetchRefs.pending}
            onClick={async () => {
              const r = await fetchRefs.run({ actor, draftId });
              if (r) setMessage(r.message);
            }}
          >
            {fetchRefs.pending ? "Fetching…" : "Fetch references"}
          </button>
        </div>
      </div>
      <p className="small muted">Only an allowlist of public advisory sources (OWASP, NIST, CISA) is ever retrieved.</p>
      <ErrorBox message={fetchRefs.error} />
      {message && <div className="state state-info small">{message}</div>}
      {!refs ? (
        <Loading />
      ) : refs.length === 0 ? (
        <p className="muted">No references yet.</p>
      ) : (
        <ul className="ref-list">
          {refs.map((r) => (
            <li key={r._id}>
              <a href={r.url} target="_blank" rel="noreferrer noopener">
                {r.title}
              </a>
              <div className="small muted">
                {r.sourceName} · {r.publishedAt ? `published ${r.publishedAt} · ` : ""}retrieved {formatDate(r.retrievedAt)}
              </div>
              <div className="small">{r.relevanceNote}</div>
              <span className={`badge ${r.seeded ? "muted-badge" : "ok"}`}>{r.seeded ? "Seeded reference — not live-retrieved" : "Retrieved via Apify"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EvidenceSelect({ value, onChange, reproduced }: { value: EvidenceLevel | ""; onChange: (v: EvidenceLevel) => void; reproduced: boolean }) {
  return (
    <fieldset className="evidence-select">
      <legend className="label">Evidence label</legend>
      {EVIDENCE_LEVELS.map((lvl) => {
        const disabled = lvl === "test_reproduced" && !reproduced;
        return (
          <label key={lvl} className={`radio ${disabled ? "disabled" : ""}`}>
            <input type="radio" name="evidence" value={lvl} checked={value === lvl} disabled={disabled} onChange={() => onChange(lvl)} />
            <span>
              <strong>{EVIDENCE_INFO[lvl].label}</strong>
              <span className="small muted"> — {EVIDENCE_INFO[lvl].explanation}</span>
              {disabled && <span className="small warn-text"> Requires a failing check, a fix, and a passing re-check below.</span>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function DecisionPanel({
  draftId,
  autoChecks,
  reproduced,
}: {
  draftId: Id<"incidentDrafts">;
  autoChecks: { sixSectionsComplete: boolean; noHighPrivacyFindings: boolean; limitationsStated: boolean; hasReferences: boolean };
  reproduced: boolean;
}) {
  const { actor } = useSession();
  const decide = useAction(useMutation(api.reviews.decide));
  const [checklist, setChecklist] = useState<Checklist>({
    sixSectionsComplete: false,
    noSensitiveData: false,
    defensiveOnly: false,
    evidenceSupportsLabel: false,
    limitationsStated: false,
  });
  const [evidence, setEvidence] = useState<EvidenceLevel | "">("");
  const [note, setNote] = useState("");
  const [sectionKey, setSectionKey] = useState("");
  const allChecked = Object.values(checklist).every(Boolean);

  const hints: Partial<Record<keyof Checklist, boolean>> = {
    sixSectionsComplete: autoChecks.sixSectionsComplete,
    noSensitiveData: autoChecks.noHighPrivacyFindings,
    limitationsStated: autoChecks.limitationsStated,
  };

  const run = (decision: "approve" | "request_changes" | "reject") =>
    decide.run({ actor, draftId, decision, note, evidenceLevel: decision === "approve" && evidence ? evidence : undefined, checklist, sectionKey: sectionKey || undefined });

  return (
    <section className="card decision">
      <h3>Decision</h3>
      <fieldset>
        <legend className="label">Completeness checklist</legend>
        {CHECKLIST.map((c) => (
          <label key={c.key} className="check">
            <input type="checkbox" checked={checklist[c.key]} onChange={(e) => setChecklist({ ...checklist, [c.key]: e.target.checked })} />
            {c.label}
            {hints[c.key] !== undefined && (
              <span className={`small ${hints[c.key] ? "ok-text" : "warn-text"}`}>{hints[c.key] ? " · auto-check passed" : " · auto-check failed"}</span>
            )}
          </label>
        ))}
        {!autoChecks.hasReferences && <p className="small warn-text">No public references attached yet.</p>}
      </fieldset>
      <EvidenceSelect value={evidence} onChange={setEvidence} reproduced={reproduced} />
      <div className="field">
        <label className="label" htmlFor="note">
          Note to contributor
        </label>
        <span className="hint">Required when requesting changes or rejecting. Say exactly what to fix.</span>
        <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="section">
          Section to fix (for “Request changes”)
        </label>
        <select id="section" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
          <option value="">Whole guide</option>
          {SECTION_KEYS.map((k) => (
            <option key={k} value={k}>
              {SECTION_INFO[k].title}
            </option>
          ))}
          <option value="failedAttempts">What they tried that did not work</option>
        </select>
      </div>
      <ErrorBox message={decide.error} />
      <div className="row gap wrap">
        <button className="btn primary" disabled={decide.pending || !allChecked || !evidence} onClick={() => void run("approve")}>
          Approve
        </button>
        <button className="btn" disabled={decide.pending || !note.trim()} onClick={() => void run("request_changes")}>
          Request changes
        </button>
        <button className="btn danger" disabled={decide.pending || !note.trim()} onClick={() => void run("reject")}>
          Reject
        </button>
      </div>
      {(!allChecked || !evidence) && <p className="small muted">Approval needs every checklist item and an evidence label.</p>}
    </section>
  );
}

function EvidenceUpdater({
  draftId,
  status,
  current,
  reproduced,
  note,
}: {
  draftId: Id<"incidentDrafts">;
  status: string;
  current?: EvidenceLevel;
  reproduced: boolean;
  note?: string;
}) {
  const { actor } = useSession();
  const setLevel = useAction(useMutation(api.reviews.setEvidenceLevel));
  const [value, setValue] = useState<EvidenceLevel | "">(current ?? "");
  const [saved, setSaved] = useState(false);
  const canEdit = status === "approved" || status === "published";
  return (
    <section className="card">
      <h3>Decision recorded</h3>
      {current && (
        <p>
          Current label: <EvidenceBadge level={current} />
        </p>
      )}
      {note && <p className="note">“{note}”</p>}
      {canEdit && (
        <>
          <EvidenceSelect value={value} onChange={(v) => { setValue(v); setSaved(false); }} reproduced={reproduced} />
          <ErrorBox message={setLevel.error} />
          {saved && <SuccessBox>Evidence label updated.</SuccessBox>}
          <button
            className="btn"
            disabled={!value || value === current || setLevel.pending}
            onClick={async () => {
              if (!value) return;
              if (await setLevel.run({ actor, draftId, evidenceLevel: value })) setSaved(true);
            }}
          >
            Update evidence label
          </button>
        </>
      )}
    </section>
  );
}
