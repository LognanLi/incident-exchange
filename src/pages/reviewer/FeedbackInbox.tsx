import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { FEEDBACK_LABELS } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { Empty, ErrorBox, Loading, PageHeader, RoleGate, formatDate, useAction } from "../../components/ui";

export default function FeedbackInboxPage() {
  return (
    <RoleGate role="reviewer">
      <FeedbackInbox />
    </RoleGate>
  );
}

function FeedbackInbox() {
  const { actor } = useSession();
  const items = useQuery(api.reviews.feedbackList, { actor });
  const ack = useAction(useMutation(api.reviews.acknowledgeFeedback));
  if (!items) return <Loading />;
  return (
    <div>
      <PageHeader eyebrow="Reviewer console" title="Buyer outcome feedback" />
      <ErrorBox message={ack.error} />
      {items.length === 0 ? (
        <Empty title="No feedback yet">Buyers can report relevance and outcome after unlocking a guide.</Empty>
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Guide</th>
                <th>Buyer</th>
                <th>Relevance</th>
                <th>Outcome</th>
                <th>Notes</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f._id}>
                  <td>
                    <Link to={`/playbooks/${f.playbookId}`}>{f.playbookTitle}</Link>
                  </td>
                  <td>{f.buyerName}</td>
                  <td>{FEEDBACK_LABELS[f.relevance]}</td>
                  <td>
                    <span className={`badge outcome-${f.outcome}`}>{FEEDBACK_LABELS[f.outcome]}</span>
                  </td>
                  <td className="small">{f.notes || <span className="muted">—</span>}</td>
                  <td className="small">{formatDate(f.createdAt)}</td>
                  <td>
                    {f.reviewStatus === "new" ? (
                      <button className="btn sm" disabled={ack.pending} onClick={() => void ack.run({ actor, feedbackId: f._id })}>
                        Acknowledge
                      </button>
                    ) : (
                      <span className="badge ok">Acknowledged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
