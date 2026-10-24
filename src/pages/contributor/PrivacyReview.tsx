import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { EDITABLE_STATUSES, FREE_SECTIONS, LOCKED_SECTIONS, SECTION_INFO } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { Boundary, BulletText, ErrorBox, Loading, Money, RoleGate, SuccessBox, formatDate, useAction } from "../../components/ui";
import { DraftTabs } from "./DraftTabs";

export default function PrivacyReviewPage() {
  return (
    <RoleGate role="contributor">
      <PrivacyReview />
    </RoleGate>
  );
}

const FIELD_NAMES: Record<string, string> = {
  publicTitle: "Public title",
  sanitizedSummary: "Public summary",
  ...Object.fromEntries(Object.entries(SECTION_INFO).map(([k, v]) => [k, v.title])),
};

function PrivacyReview() {
  const { draftId } = useParams();
  const id = draftId as Id<"incidentDrafts">;
  const { actor } = useSession();
  const navigate = useNavigate();
  const data = useQuery(api.drafts.getMine, { actor, draftId: id });
  const scan = useAction(useMutation(api.drafts.runPrivacyScan));
  const generalize = useAction(useMutation(api.drafts.applyGeneralizationsToDraft));
  const submit = useAction(useMutation(api.drafts.approveAndSubmit));
  const [confirmed, setConfirmed] = useState(false);

  if (!data) return <Loading />;
  const d = data.draft;
  const editable = EDITABLE_STATUSES.includes(d.status);
  const high = d.privacyFindings.filter((f) => f.severity === "high");
  const medium = d.privacyFindings.filter((f) => f.severity === "medium");

  return (
    <div>
      <DraftTabs draft={d} scanIsCurrent={data.scanIsCurrent} />

      <div className="grid-2 align-start">
        <div>
          <section className="card">
            <div className="toolbar">
              <div>
                <h2>Privacy scan</h2>
                <p className="muted small">
                  Checks buyer-visible text for credentials, emails, IP addresses, hostnames, account and ticket IDs,
                  exact timestamps, your organization name, and names you listed as private. This reduces
                  identification risk; it cannot guarantee anonymity.
                </p>
              </div>
              {editable && (
                <button className="btn primary" disabled={scan.pending || !d.sections} onClick={() => void scan.run({ actor, draftId: id })}>
                  {scan.pending ? "Scanning…" : "Run privacy scan"}
                </button>
              )}
            </div>
            {!d.sections && <div className="state state-info">Draft the six-part playbook before scanning.</div>}
            <ErrorBox message={scan.error ?? generalize.error} />

            {d.privacyScannedAt === undefined ? (
              <p className="muted">Not scanned yet.</p>
            ) : (
              <>
                <div className={`scan-summary ${data.scanIsCurrent ? "" : "stale"}`}>
                  {data.scanIsCurrent ? "Scan is current" : "Content changed since the last scan — run it again"} · last run{" "}
                  {formatDate(d.privacyScannedAt)} · <strong>{high.length}</strong> high · <strong>{medium.length}</strong> medium
                </div>
                {d.privacyFindings.length === 0 ? (
                  <SuccessBox>No identifiers found in the buyer-visible version.</SuccessBox>
                ) : (
                  <table className="table findings">
                    <thead>
                      <tr>
                        <th>Severity</th>
                        <th>Finding</th>
                        <th>Where</th>
                        <th>Excerpt (masked)</th>
                        <th>Recommended generalization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.privacyFindings.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <span className={`badge sev-${f.severity}`}>{f.severity}</span>
                          </td>
                          <td>{f.label}</td>
                          <td>{FIELD_NAMES[f.field] ?? f.field}</td>
                          <td>
                            <code>{f.excerpt}</code>
                          </td>
                          <td className="small">{f.suggestion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {editable && d.privacyFindings.length > 0 && (
                  <div className="row gap">
                    <button className="btn" disabled={generalize.pending} onClick={() => void generalize.run({ actor, draftId: id })}>
                      {generalize.pending ? "Applying…" : "Apply all recommended generalizations"}
                    </button>
                    <span className="muted small">Or edit the text yourself on the playbook step, then re-scan.</span>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card">
            <h2>Your approval</h2>
            {!editable ? (
              <div className="state state-info">
                {d.contributorApproval
                  ? `You approved this buyer-facing version on ${formatDate(d.contributorApproval.at)}.`
                  : "This draft is not editable in its current state."}
              </div>
            ) : (
              <>
                {data.blockers.length > 0 ? (
                  <div className="blockers">
                    <strong>Before you can submit:</strong>
                    <ul className="bullets">
                      {data.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <SuccessBox>Ready for your approval.</SuccessBox>
                )}
                {medium.length > 0 && data.blockers.length === 0 && (
                  <p className="small muted">
                    {medium.length} medium finding(s) remain. You may submit, but consider generalizing them.
                  </p>
                )}
                <label className="check approve-check">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I approve
                  exactly the buyer-facing version shown in the preview for human review and, if approved, publication.
                </label>
                <ErrorBox message={submit.error} />
                <button
                  className="btn primary"
                  disabled={!confirmed || data.blockers.length > 0 || submit.pending}
                  onClick={async () => {
                    if (await submit.run({ actor, draftId: id, confirmed })) navigate(`/contribute/drafts/${id}/status`);
                  }}
                >
                  {submit.pending ? "Submitting…" : "Approve & submit for human review"}
                </button>
              </>
            )}
          </section>
        </div>

        <BuyerPreview draft={d} alias={data.orgAlias} />
      </div>
    </div>
  );
}

function BuyerPreview({ draft, alias }: { draft: Doc<"incidentDrafts">; alias: string }) {
  return (
    <section className="card buyer-preview" aria-label="Buyer preview">
      <Boundary kind="public">Exact buyer-facing version</Boundary>
      <div className="eyebrow">{alias}</div>
      <h2>{draft.publicTitle || "(no public title)"}</h2>
      <p>{draft.sanitizedSummary}</p>
      <div className="row gap wrap">
        {draft.systemCategories.map((c) => (
          <span key={c} className="badge cat">
            {c}
          </span>
        ))}
        <span className="badge price">
          <Money atomic={draft.priceAtomic} />
        </span>
        <span className="badge muted-badge">Evidence label set by reviewer</span>
      </div>
      {draft.sections ? (
        <>
          <h4 className="preview-part">Free preview</h4>
          {FREE_SECTIONS.map((k) => (
            <div key={k} className="preview-section">
              <h5>{SECTION_INFO[k].title}</h5>
              <BulletText text={draft.sections![k].body} />
            </div>
          ))}
          <h4 className="preview-part">Unlocked after purchase</h4>
          {LOCKED_SECTIONS.map((k) => (
            <div key={k} className="preview-section locked-preview">
              <h5>🔒 {SECTION_INFO[k].title}</h5>
              <BulletText text={draft.sections![k].body} />
            </div>
          ))}
        </>
      ) : (
        <p className="muted">Sections appear here once drafted.</p>
      )}
    </section>
  );
}
