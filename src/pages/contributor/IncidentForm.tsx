import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EDITABLE_STATUSES, SHARING_LABELS, SHARING_LEVELS, SYSTEM_CATEGORIES, type SharingLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { Boundary, ErrorBox, Loading, PageHeader, RoleGate, SuccessBox, useAction } from "../../components/ui";
import { DraftTabs } from "./DraftTabs";

type FormValues = {
  title: string;
  privateNotes: string;
  evidenceSummary: string;
  symptoms: string;
  detectionClues: string;
  attemptedActions: string;
  containmentSteps: string;
  recoverySteps: string;
  verificationSteps: string;
  limitations: string;
  identifyingTerms: string;
  publicTitle: string;
  sanitizedSummary: string;
  systemCategories: string[];
  sharingLevel: SharingLevel;
  price: string;
};

const EMPTY: FormValues = {
  title: "",
  privateNotes: "",
  evidenceSummary: "",
  symptoms: "",
  detectionClues: "",
  attemptedActions: "",
  containmentSteps: "",
  recoverySteps: "",
  verificationSteps: "",
  limitations: "",
  identifyingTerms: "",
  publicTitle: "",
  sanitizedSummary: "",
  systemCategories: [],
  sharingLevel: "industry_alias",
  price: "49.00",
};

const GROUPS: { title: string; fields: (keyof FormValues)[]; required: (keyof FormValues)[] }[] = [
  { title: "Basics", fields: ["title", "systemCategories"], required: ["title"] },
  { title: "What happened", fields: ["symptoms", "detectionClues", "attemptedActions"], required: ["symptoms"] },
  { title: "Response", fields: ["containmentSteps", "recoverySteps", "verificationSteps", "limitations"], required: ["containmentSteps", "recoverySteps", "verificationSteps"] },
  { title: "Private context", fields: ["privateNotes", "evidenceSummary", "identifyingTerms"], required: [] },
  { title: "Listing", fields: ["publicTitle", "sanitizedSummary", "price"], required: ["publicTitle", "sanitizedSummary", "price"] },
];

function filled(v: FormValues, k: keyof FormValues) {
  const x = v[k];
  return Array.isArray(x) ? x.length > 0 : String(x).trim().length > 0;
}

function parsePrice(p: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(p.trim())) return null;
  return Math.round(parseFloat(p) * 100);
}

export function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!v.title.trim()) e.title = "Give the incident an internal title.";
  if (!v.symptoms.trim()) e.symptoms = "Describe at least one observable symptom.";
  const price = parsePrice(v.price);
  if (price === null) e.price = "Enter a price like 49.00.";
  else if (price < 500 || price > 50000) e.price = "Price must be between $5.00 and $500.00.";
  return e;
}

export default function IncidentFormPage() {
  return (
    <RoleGate role="contributor">
      <IncidentFormLoader />
    </RoleGate>
  );
}

function IncidentFormLoader() {
  const { draftId } = useParams();
  const { actor } = useSession();
  const location = useLocation();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated === true;
  const data = useQuery(api.drafts.getMine, draftId ? { actor, draftId: draftId as Id<"incidentDrafts"> } : "skip");
  if (!draftId) {
    return (
      <>
        <PageHeader eyebrow="Contributor workspace" title="Share an incident" />
        <IncidentFormBody initial={EMPTY} />
      </>
    );
  }
  if (!data) return <Loading />;
  const d = data.draft;
  return (
    <>
      <DraftTabs draft={d} scanIsCurrent={data.scanIsCurrent} />
      <IncidentFormBody
        key={d._id}
        draftId={d._id}
        locked={!EDITABLE_STATUSES.includes(d.status)}
        initiallySaved={justCreated}
        initial={{
          title: d.title,
          privateNotes: d.privateNotes,
          evidenceSummary: d.evidenceSummary,
          symptoms: d.symptoms,
          detectionClues: d.detectionClues,
          attemptedActions: d.attemptedActions,
          containmentSteps: d.containmentSteps,
          recoverySteps: d.recoverySteps,
          verificationSteps: d.verificationSteps,
          limitations: d.limitations,
          identifyingTerms: d.identifyingTerms.join(", "),
          publicTitle: d.publicTitle,
          sanitizedSummary: d.sanitizedSummary,
          systemCategories: d.systemCategories,
          sharingLevel: d.sharingLevel,
          price: (d.priceMinorUnits / 100).toFixed(2),
        }}
      />
    </>
  );
}

function IncidentFormBody({
  initial,
  draftId,
  locked = false,
  initiallySaved = false,
}: {
  initial: FormValues;
  draftId?: Id<"incidentDrafts">;
  locked?: boolean;
  initiallySaved?: boolean;
}) {
  const { actor } = useSession();
  const navigate = useNavigate();
  const create = useMutation(api.drafts.create);
  const update = useMutation(api.drafts.update);
  const [v, setV] = useState<FormValues>(initial);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(initiallySaved);
  const save = useAction(async () => {
    const fields = {
      title: v.title.trim(),
      privateNotes: v.privateNotes,
      evidenceSummary: v.evidenceSummary,
      symptoms: v.symptoms,
      detectionClues: v.detectionClues,
      attemptedActions: v.attemptedActions,
      containmentSteps: v.containmentSteps,
      recoverySteps: v.recoverySteps,
      verificationSteps: v.verificationSteps,
      limitations: v.limitations,
      identifyingTerms: v.identifyingTerms.split(",").map((t) => t.trim()).filter(Boolean),
      publicTitle: v.publicTitle.trim(),
      sanitizedSummary: v.sanitizedSummary,
      systemCategories: v.systemCategories,
      sharingLevel: v.sharingLevel,
      priceMinorUnits: parsePrice(v.price)!,
    };
    if (draftId) {
      await update({ actor, draftId, fields });
      return draftId;
    }
    return await create({ actor, fields });
  });

  const errors = validate(v);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => {
    setSaved(false);
    setV((prev) => ({ ...prev, [k]: val }));
  };

  const groupsDone = GROUPS.filter((g) => g.required.every((k) => filled(v, k)) && g.fields.some((k) => filled(v, k))).length;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    const id = await save.run();
    if (!id) return;
    setSaved(true);
    if (!draftId) navigate(`/contribute/drafts/${id}/report`, { replace: true, state: { justCreated: true } });
  };

  const err = (k: keyof FormValues) => (touched && errors[k] ? <span className="field-error">{errors[k]}</span> : null);
  const text = (k: keyof FormValues, label: string, hint: string, rows = 3) => (
    <Field label={label} hint={hint} error={err(k)} id={k}>
      <textarea id={k} rows={rows} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} disabled={locked} />
    </Field>
  );

  return (
    <form className="incident-form" onSubmit={onSubmit} noValidate>
      {locked && (
        <div className="state state-info">This report is locked while it is in review or published. Reviewer notes and status are on step 4.</div>
      )}
      <div className="progress" aria-label={`Form progress: ${groupsDone} of ${GROUPS.length} sections complete`}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(groupsDone / GROUPS.length) * 100}%` }} />
        </div>
        <span className="small muted">
          {groupsDone} of {GROUPS.length} sections complete
        </span>
      </div>

      <fieldset className="card">
        <legend>Basics</legend>
        <Boundary kind="private">The internal title is only for you.</Boundary>
        <Field label="Internal title" hint="Any name your team uses. Never shown to buyers." error={err("title")} id="title">
          <input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} disabled={locked} />
        </Field>
        <div className="field">
          <span className="label">Affected system categories</span>
          <div className="checks">
            {SYSTEM_CATEGORIES.map((c) => (
              <label key={c} className="check">
                <input
                  type="checkbox"
                  checked={v.systemCategories.includes(c)}
                  disabled={locked}
                  onChange={(e) =>
                    set("systemCategories", e.target.checked ? [...v.systemCategories, c] : v.systemCategories.filter((x) => x !== c))
                  }
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="card">
        <legend>What happened</legend>
        <Boundary kind="private">
          These are your source notes. They feed the playbook draft; the privacy scan checks what ends up buyer-visible.
        </Boundary>
        {text("symptoms", "Symptoms", "What did you observe? One per line.", 4)}
        {text("detectionClues", "Detection clues", "Logs, alerts, or diffs that pointed at the cause.")}
        {text("attemptedActions", "Investigation & attempted actions", "Safe checks you ran and what you compared.")}
      </fieldset>

      <fieldset className="card">
        <legend>Response</legend>
        {text("containmentSteps", "Containment", "How you limited additional harm.")}
        {text("recoverySteps", "Recovery", "Corrective and restoration steps.")}
        {text("verificationSteps", "Verification", "How you confirmed it was fixed.")}
        {text("limitations", "Limitations", "Where this might not apply, side effects, uncertainty.")}
      </fieldset>

      <fieldset className="card private-card">
        <legend>Private context</legend>
        <Boundary kind="private">Never published and never used to answer buyer questions.</Boundary>
        {text("privateNotes", "Private notes", "Timeline, people, hosts, ticket numbers — anything you need for your own records.", 4)}
        {text("evidenceSummary", "Evidence available to reviewers", "Describe the supporting evidence a reviewer can inspect.")}
        <Field
          label="Names to keep private"
          hint="People, products, or customers the privacy scan must flag. Comma-separated. Your organization name is always included."
          id="identifyingTerms"
        >
          <input id="identifyingTerms" value={v.identifyingTerms} onChange={(e) => set("identifyingTerms", e.target.value)} disabled={locked} />
        </Field>
      </fieldset>

      <fieldset className="card">
        <legend>Listing</legend>
        <Boundary kind="public">These fields become buyer-visible after your approval and human review.</Boundary>
        <Field label="Public title" hint="Describe the problem, not your company." error={err("publicTitle")} id="publicTitle">
          <input id="publicTitle" value={v.publicTitle} onChange={(e) => set("publicTitle", e.target.value)} disabled={locked} />
        </Field>
        {text("sanitizedSummary", "Public summary", "Two or three sentences a buyer reads first.")}
        <div className="row">
          <Field label="Price (USD)" hint="Between $5 and $500. Demo prices only." error={err("price")} id="price">
            <input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} disabled={locked} />
          </Field>
          <Field label="How you appear to buyers" hint="Reduces identification risk; perfect anonymity is not promised." id="sharingLevel">
            <select id="sharingLevel" value={v.sharingLevel} onChange={(e) => set("sharingLevel", e.target.value as SharingLevel)} disabled={locked}>
              {SHARING_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {SHARING_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      {!locked && (
        <div className="form-actions sticky">
          {touched && Object.keys(errors).length > 0 && <span className="field-error">Fix the highlighted fields.</span>}
          <ErrorBox message={save.error} />
          {saved && <SuccessBox>Draft saved.</SuccessBox>}
          <button className="btn primary" type="submit" disabled={save.pending}>
            {save.pending ? "Saving…" : "Save draft"}
          </button>
          {draftId && (
            <button
              type="button"
              className="btn"
              disabled={save.pending}
              onClick={async () => {
                setTouched(true);
                if (Object.keys(errors).length) return;
                if (await save.run()) navigate(`/contribute/drafts/${draftId}/playbook`);
              }}
            >
              Save & continue to playbook →
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function Field({ label, hint, error, id, children }: { label: string; hint?: string; error?: ReactNode; id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="hint">{hint}</span>}
      {children}
      {error}
    </div>
  );
}
