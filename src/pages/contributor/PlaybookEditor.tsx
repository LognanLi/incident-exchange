import { useState } from "react";
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { EDITABLE_STATUSES, SECTION_INFO, SECTION_KEYS, type SectionKey } from "../../../convex/lib/domain";
import { FIELD_LABELS, type DraftSource } from "../../../convex/lib/drafting";
import { useSession } from "../../session";
import { Boundary, ErrorBox, IntegrationBadge, Loading, RoleGate, useAction } from "../../components/ui";
import { DraftTabs } from "./DraftTabs";
import { Icon } from "../../components/icons";

export default function PlaybookEditorPage() {
  return (
    <RoleGate role="contributor">
      <PlaybookEditor />
    </RoleGate>
  );
}

const LABEL_TO_FIELD = Object.fromEntries(Object.entries(FIELD_LABELS).map(([k, label]) => [label, k as keyof DraftSource]));

function PlaybookEditor() {
  const { draftId } = useParams();
  const { actor } = useSession();
  const id = draftId as Id<"incidentDrafts">;
  const data = useQuery(api.drafts.getMine, { actor, draftId: id });
  const generate = useAction(useConvexAction(api.drafts.draftPlaybook));
  const integrations = useQuery(api.integrations.status);
  const moss = integrations?.find((i) => i.key === "moss");
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const acceptAll = useAction(useMutation(api.drafts.acceptAllSections));

  if (!data) return <Loading />;
  const d = data.draft;
  const editable = EDITABLE_STATUSES.includes(d.status);
  const acceptedCount = d.sections ? SECTION_KEYS.filter((k) => d.sections![k].accepted).length : 0;

  return (
    <div>
      <DraftTabs draft={d} scanIsCurrent={data.scanIsCurrent} />

      <div className="toolbar editor-toolbar">
        <div>
          <h2>Six-part guide</h2>
          <p className="muted small">Check each section against your notes, then accept it.</p>
        </div>
        <div className="toolbar-actions">
          {moss && <IntegrationBadge state={moss.state} name="Moss" />}
          {editable && (
            <button
              className="btn primary"
              disabled={generate.pending}
              onClick={() => {
                if (d.sections && !confirm("Replace all six sections with a fresh draft? Your edits will be lost.")) return;
                setDraftMessage(null);
                void generate.run({ actor, draftId: id }).then((r) => r && setDraftMessage(r.message));
              }}
            >
              {generate.pending ? "Drafting…" : d.sections ? "Re-draft with Moss" : "Draft with Moss"}
            </button>
          )}
        </div>
      </div>
      <ErrorBox message={generate.error} />
      {draftMessage && <div className="state state-info small">{draftMessage}</div>}

      {d.draftEngine === "fallback" && (
        <div className="state state-info">
          <strong>Drafted by the deterministic fallback.</strong> Built only from your answers — nothing added.
        </div>
      )}
      {d.draftEngine === "moss" && (
        <div className="state state-info">
          <strong>Drafted by Moss.</strong> From your answers only — never your private notes. Compare before accepting.
        </div>
      )}

      {!d.sections ? (
        <div className="state state-empty">
          <strong>No draft yet.</strong>
          <span className="muted">Click “Draft with Moss” to start.</span>
        </div>
      ) : (
        <>
          <Boundary kind="public">After your approval and review. Notes on the right stay private.</Boundary>
          {SECTION_KEYS.map((k) => (
            <SectionEditor key={k + "\u0000" + d.sections![k].body} draft={d} sectionKey={k} editable={editable} />
          ))}
          <div className="form-actions sticky">
            <span className="muted small">
              {acceptedCount} of 6 sections accepted
            </span>
            <ErrorBox message={acceptAll.error} />
            {editable && acceptedCount < 6 && (
              <button className="btn" disabled={acceptAll.pending} onClick={() => void acceptAll.run({ actor, draftId: id })}>
                Accept all sections
              </button>
            )}
            <Link className={`btn ${acceptedCount === 6 ? "primary" : ""}`} to={`/contribute/drafts/${id}/privacy`}>
              Next: privacy review <Icon name="arrow" size={16} className="icon-arrow" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function SectionEditor({ draft, sectionKey, editable }: { draft: Doc<"incidentDrafts">; sectionKey: SectionKey; editable: boolean }) {
  const { actor } = useSession();
  const section = draft.sections![sectionKey];
  const [body, setBody] = useState(section.body);
  const update = useAction(useMutation(api.drafts.updateSection));
  const dirty = body !== section.body;
  const info = SECTION_INFO[sectionKey];

  return (
    <section className={`section-editor card ${section.accepted ? "accepted" : ""}`} aria-labelledby={`sec-${sectionKey}`}>
      <div className="section-head">
        <div>
          <h3 id={`sec-${sectionKey}`}>{info.title}</h3>
          <span className="hint">{info.hint}</span>
        </div>
        <div className="section-meta">
          <span className={`badge origin origin-${section.origin}`}>
            {section.origin === "fallback" ? "Fallback" : section.origin === "moss" ? "Moss" : "Edited"}
          </span>
          {section.accepted ? <span className="badge ok">Accepted</span> : <span className="badge warn">To review</span>}
        </div>
      </div>
      <div className="split">
        <div>
          <label className="label" htmlFor={`body-${sectionKey}`}>
            Buyer sees
          </label>
          <textarea id={`body-${sectionKey}`} rows={6} value={body} onChange={(e) => setBody(e.target.value)} disabled={!editable} />
          {editable && (
            <div className="row gap">
              {dirty && (
                <button className="btn sm" disabled={update.pending} onClick={() => void update.run({ actor, draftId: draft._id, key: sectionKey, body })}>
                  Save edit
                </button>
              )}
              {dirty && (
                <button className="btn sm ghost" onClick={() => setBody(section.body)}>
                  Discard
                </button>
              )}
              <button
                className={`btn sm ${section.accepted ? "ghost" : "primary"}`}
                disabled={update.pending || !body.trim()}
                onClick={() => void update.run({ actor, draftId: draft._id, key: sectionKey, body, accepted: !section.accepted || dirty })}
              >
                {section.accepted && !dirty ? "Un-accept" : dirty ? "Save & accept" : "Accept section"}
              </button>
            </div>
          )}
          <ErrorBox message={update.error} />
        </div>
        <aside className="source-notes" aria-label="Source notes">
          <div className="label boundary-tag">
            <Icon name="lock" size={12} /> Your notes
          </div>
          {section.sourceFields.length === 0 ? (
            <p className="muted small">Written by you.</p>
          ) : (
            section.sourceFields.map((label) => {
              const field = LABEL_TO_FIELD[label];
              return (
                <div key={label} className="source-block">
                  <div className="small strong">{label}</div>
                  <pre>{field ? draft[field] : ""}</pre>
                </div>
              );
            })
          )}
        </aside>
      </div>
    </section>
  );
}
