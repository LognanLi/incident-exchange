import { NavLink } from "react-router-dom";
import type { Doc } from "../../../convex/_generated/dataModel";
import { SECTION_KEYS } from "../../../convex/lib/domain";
import { StatusBadge } from "../../components/ui";
import { Icon } from "../../components/icons";

type Props = { draft: Doc<"incidentDrafts">; scanIsCurrent: boolean };

/** Step navigation for one incident: report → playbook → privacy & approval → status. */
export function DraftTabs({ draft, scanIsCurrent }: Props) {
  const sectionsDone = !!draft.sections && SECTION_KEYS.every((k) => draft.sections![k].accepted);
  const privacyDone = scanIsCurrent && !draft.privacyFindings.some((f) => f.severity === "high");
  const submitted = draft.status !== "draft" && draft.status !== "changes_requested";
  const steps = [
    { to: "report", label: "Report", done: true },
    { to: "playbook", label: "Guide", done: sectionsDone },
    { to: "privacy", label: "Privacy", done: privacyDone && (submitted || !!draft.contributorApproval) },
    { to: "status", label: "Publish", done: draft.status === "published" },
  ];
  return (
    <div className="draft-head">
      <div className="draft-title-row">
        <div>
          <div className="eyebrow">Incident · private title</div>
          <h1>{draft.title}</h1>
        </div>
        <StatusBadge status={draft.status} />
      </div>
      <nav className="stepper" aria-label="Incident steps">
        {steps.map((s, i) => (
          <NavLink key={s.to} to={`/contribute/drafts/${draft._id}/${s.to}`} className={s.done ? "done" : ""}>
            <span className="step-dot" aria-hidden>
              {s.done ? <Icon name="check" size={11} /> : i + 1}
            </span>
            {s.label}
            {s.done && <span className="sr-only"> (done)</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
