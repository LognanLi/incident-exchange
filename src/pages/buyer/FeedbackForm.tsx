import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FEEDBACK_LABELS, OUTCOME_OPTIONS, RELEVANCE_OPTIONS } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { Empty, ErrorBox, Loading, PageHeader, RoleGate, SuccessBox, useAction } from "../../components/ui";

type Relevance = (typeof RELEVANCE_OPTIONS)[number];
type Outcome = (typeof OUTCOME_OPTIONS)[number];

export default function FeedbackFormPage() {
  return (
    <RoleGate role="buyer">
      <FeedbackForm />
    </RoleGate>
  );
}

function FeedbackForm() {
  const { playbookId } = useParams();
  const id = playbookId as Id<"playbooks">;
  const { actor } = useSession();
  const pb = useQuery(api.playbooks.get, { actor, playbookId: id });
  const submit = useAction(useMutation(api.feedback.submit));
  const [relevance, setRelevance] = useState<Relevance | "">("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  if (pb === undefined) return <Loading />;
  if (pb === null) return <Empty title="Playbook not found" />;

  if (saved) {
    return (
      <div>
        <PageHeader eyebrow="Outcome feedback" title="Thanks — feedback saved" />
        <SuccessBox>
          Your outcome was recorded for “{pb.publicTitle}”. Reviewers use it to improve the guide for future responders.
        </SuccessBox>
        <p>
          <Link to={`/playbooks/${id}`}>Back to the playbook</Link> · <Link to="/playbooks">Find another playbook</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Outcome feedback" title={pb.publicTitle} />
      <form
        className="card feedback-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!relevance || !outcome) return;
          if (await submit.run({ actor, playbookId: id, relevance, outcome, notes })) setSaved(true);
        }}
      >
        <fieldset>
          <legend className="label">How relevant was this guide to your situation?</legend>
          {RELEVANCE_OPTIONS.map((r) => (
            <label key={r} className="radio">
              <input type="radio" name="relevance" checked={relevance === r} onChange={() => setRelevance(r)} />
              {FEEDBACK_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="label">What was the outcome?</legend>
          {OUTCOME_OPTIONS.map((o) => (
            <label key={o} className="radio">
              <input type="radio" name="outcome" checked={outcome === o} onChange={() => setOutcome(o)} />
              {FEEDBACK_LABELS[o]}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label className="label" htmlFor="notes">
            Notes (optional)
          </label>
          <span className="hint">Do not include credentials, personal data, or customer data.</span>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <ErrorBox message={submit.error} />
        <button className="btn primary" disabled={!relevance || !outcome || submit.pending}>
          {submit.pending ? "Saving…" : "Submit feedback"}
        </button>
      </form>
    </div>
  );
}
