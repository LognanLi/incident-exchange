import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { STATUS_LABELS } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { ErrorBox, EvidenceBadge, Loading, RoleGate, SuccessBox, formatDate, useAction } from "../../components/ui";
import { DraftTabs } from "./DraftTabs";

export default function DraftStatusPage() {
  return (
    <RoleGate role="contributor">
      <DraftStatus />
    </RoleGate>
  );
}

const DECISION_LABEL = { approve: "Approved", request_changes: "Changes requested", reject: "Rejected" } as const;

function DraftStatus() {
  const { draftId } = useParams();
  const id = draftId as Id<"incidentDrafts">;
  const { actor } = useSession();
  const data = useQuery(api.drafts.getMine, { actor, draftId: id });
  const publish = useAction(useMutation(api.drafts.publishFinal));
  const [confirmed, setConfirmed] = useState(false);

  if (!data) return <Loading />;
  const d = data.draft;

  return (
    <div>
      <DraftTabs draft={d} scanIsCurrent={data.scanIsCurrent} />
      <div className="grid-2 align-start">
        <section className="card">
          <h2>Status</h2>
          <p className="lead-status">{STATUS_LABELS[d.status]}</p>
          {d.status === "draft" && (
            <p className="muted">
              Finish the playbook and privacy steps, then approve and submit for human review.{" "}
              <Link to={`/contribute/drafts/${id}/privacy`}>Go to privacy & approval →</Link>
            </p>
          )}
          {d.status === "submitted" && <p className="muted">A reviewer is checking the content, evidence, and privacy scan.</p>}
          {d.status === "changes_requested" && (
            <div className="state state-warn">
              <strong>The reviewer asked for changes.</strong> {d.reviewerNote}
              <div>
                {data.reviews[0]?.sectionKey === "failedAttempts" ? (
                  <Link to={`/contribute/drafts/${id}/report`}>Fix “What we tried that did not work” →</Link>
                ) : (
                  <Link to={`/contribute/drafts/${id}/playbook${data.reviews[0]?.sectionKey ? `#sec-${data.reviews[0].sectionKey}` : ""}`}>
                    Fix {data.reviews[0]?.sectionKey ? `the ${data.reviews[0].sectionKey} section` : "the playbook"} →
                  </Link>
                )}
                <div className="small muted">Editing creates revision {d.revision + 1}; you will approve it again before resubmitting.</div>
              </div>
            </div>
          )}
          {d.status === "rejected" && (
            <div className="state state-error">
              <strong>Rejected.</strong> {d.reviewerNote}
            </div>
          )}
          {d.evidenceLevel && (
            <div className="field">
              <span className="label">Evidence label</span>
              <EvidenceBadge level={d.evidenceLevel} explain />
            </div>
          )}

          {d.status === "approved" && (
            <div className="publish-box">
              <h3>Final approval</h3>
              <p className="muted">
                The reviewer approved this guide. It becomes searchable only after you approve this final version.{" "}
                <Link to={`/contribute/drafts/${id}/privacy`}>Review the exact buyer preview</Link> before publishing.
              </p>
              {!data.approvalIsCurrent && (
                <div className="state state-error">The content no longer matches your earlier approval and cannot be published.</div>
              )}
              <label className="check">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I approve
                publishing this final buyer-facing version.
              </label>
              <ErrorBox message={publish.error} />
              <button
                className="btn primary"
                disabled={!confirmed || publish.pending || !data.approvalIsCurrent}
                onClick={() => void publish.run({ actor, draftId: id, confirmed })}
              >
                {publish.pending ? "Publishing…" : "Publish guide"}
              </button>
            </div>
          )}

          {d.status === "published" && d.playbookId && (
            <SuccessBox>
              Published and searchable. <Link to={`/playbooks/${d.playbookId}`}>View the public listing →</Link>
            </SuccessBox>
          )}
        </section>

        <section className="card">
          <h2>Reviewer history</h2>
          {data.reviews.length === 0 ? (
            <p className="muted">No reviewer decisions yet.</p>
          ) : (
            <ol className="timeline">
              {data.reviews.map((r, i) => (
                <li key={i}>
                  <div>
                    <strong>{DECISION_LABEL[r.decision]}</strong> · revision {r.revision} · <span className="small muted">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.evidenceLevel && <EvidenceBadge level={r.evidenceLevel} />}
                  {r.note && <p className="note">“{r.note}”</p>}
                </li>
              ))}
            </ol>
          )}
          <h3>Public references</h3>
          {data.references.length === 0 ? (
            <p className="muted small">None yet. Reviewers can fetch references from allowlisted public sources.</p>
          ) : (
            <ul className="plain-list">
              {data.references.map((r) => (
                <li key={r._id}>
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.title}
                  </a>{" "}
                  <span className="small muted">
                    · {r.sourceName} · {r.seeded ? "Seeded reference (not live-retrieved)" : "Retrieved via Apify"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
