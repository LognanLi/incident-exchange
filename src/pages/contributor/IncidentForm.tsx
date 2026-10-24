import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EDITABLE_STATUSES, SHARING_LABELS, SHARING_LEVELS, SYSTEM_CATEGORIES, type SharingLevel } from "../../../convex/lib/domain";
import { useSession } from "../../session";
import { dollarsToAtomic, formatAtomic } from "../../../convex/lib/money";
import { Boundary, ErrorBox, Loading, PageHeader, RoleGate, SuccessBox, useAction } from "../../components/ui";
import { DraftTabs } from "./DraftTabs";
import { Icon } from "../../components/icons";

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
  failedAttempts: string;
  environment: string;
  identifyingTerms: string;
  publicTitle: string;
  sanitizedSummary: string;
  systemCategories: string[];
  sharingLevel: SharingLevel;
  tlp: "clear" | "green" | "amber";
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
  failedAttempts: "",
  environment: "",
  identifyingTerms: "",
  publicTitle: "",
  sanitizedSummary: "",
  systemCategories: [],
  sharingLevel: "industry_alias",
  tlp: "green",
  price: "0.50",
};

const GROUPS: { title: string; fields: (keyof FormValues)[]; required: (keyof FormValues)[] }[] = [
  { title: "Basics", fields: ["title", "systemCategories"], required: ["title"] },
  { title: "What happened", fields: ["symptoms", "detectionClues", "attemptedActions"], required: ["symptoms"] },
  { title: "Response", fields: ["failedAttempts", "containmentSteps", "recoverySteps", "verificationSteps", "limitations"], required: ["containmentSteps", "recoverySteps", "verificationSteps"] },
  { title: "Private context", fields: ["privateNotes", "evidenceSummary", "identifyingTerms"], required: [] },
  { title: "Listing", fields: ["publicTitle", "sanitizedSummary", "price"], required: ["publicTitle", "sanitizedSummary", "price"] },
];

function filled(v: FormValues, k: keyof FormValues) {
  const x = v[k];
  return Array.isArray(x) ? x.length > 0 : String(x).trim().length > 0;
}

function parsePrice(p: string): string | null {
  return dollarsToAtomic(p);
}

export function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!v.title.trim()) e.title = "Give the incident an internal title.";
  if (!v.symptoms.trim()) e.symptoms = "Describe at least one observable symptom.";
  const price = parsePrice(v.price);
  if (price === null) e.price = "Enter a price like 0.50.";
  else if (BigInt(price) < 100_000n || BigInt(price) > 1_000_000n) e.price = "Demo price must be between 0.10 and 1.00 test USDC.";
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
        <PageHeader eyebrow="New incident" title="Share an incident" sub="Nothing is shared until you approve it." />
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
          failedAttempts: d.failedAttempts,
          environment: d.environment.join(", "),
          identifyingTerms: d.identifyingTerms.join(", "),
          publicTitle: d.publicTitle,
          sanitizedSummary: d.sanitizedSummary,
          systemCategories: d.systemCategories,
          sharingLevel: d.sharingLevel,
          tlp: d.tlp ?? "green",
          price: formatAtomic(d.priceAtomic),
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
      failedAttempts: v.failedAttempts,
      environment: v.environment.split(",").map((t) => t.trim()).filter(Boolean),
      identifyingTerms: v.identifyingTerms.split(",").map((t) => t.trim()).filter(Boolean),
      publicTitle: v.publicTitle.trim(),
      sanitizedSummary: v.sanitizedSummary,
      systemCategories: v.systemCategories,
      sharingLevel: v.sharingLevel,
      tlp: v.tlp,
      priceAtomic: parsePrice(v.price)!,
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
        <div className="state state-info">Locked while in review or published. See Publish for status.</div>
      )}
      <div className="progress" aria-label={`Form progress: ${groupsDone} of ${GROUPS.length} sections complete`}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(groupsDone / GROUPS.length) * 100}%` }} />
        </div>
        <span className="small muted">
          {groupsDone}/{GROUPS.length} complete
        </span>
      </div>

      <fieldset className="card">
        <legend>Basics</legend>
        <Boundary kind="private" />
        <Field label="Internal title" hint="Never shown to buyers." error={err("title")} id="title">
          <input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} disabled={locked} />
        </Field>
        <div className="field">
          <span className="label">Affected systems</span>
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
        <Boundary kind="private">Used to draft the guide.</Boundary>
        {text("symptoms", "Symptoms", "What you saw. One per line.", 4)}
        {text("detectionClues", "Detection clues", "Logs or alerts that pointed at the cause.")}
        {text("attemptedActions", "Investigation", "Checks you ran.")}
      </fieldset>

      <fieldset className="card">
        <legend>Response</legend>
        {text("failedAttempts", "What didn’t work", "Often the most valuable part.")}
        {text("containmentSteps", "Containment", "How you limited the damage.")}
        {text("recoverySteps", "Recovery", "How you fixed it.")}
        {text("verificationSteps", "Verification", "How you confirmed it was fixed.")}
        {text("limitations", "Limitations", "Where this might not apply.")}
      </fieldset>

      <fieldset className="card private-card">
        <legend>Private context</legend>
        <Boundary kind="private">Never published.</Boundary>
        {text("privateNotes", "Private notes", "Timeline, people, hosts, tickets.", 4)}
        {text("evidenceSummary", "Evidence for reviewers", "What a reviewer can inspect.")}
        <Field label="Names to keep private" hint="Comma-separated. Your company name is always included." id="identifyingTerms">
          <input id="identifyingTerms" value={v.identifyingTerms} onChange={(e) => set("identifyingTerms", e.target.value)} disabled={locked} />
        </Field>
      </fieldset>

      <fieldset className="card">
        <legend>Listing</legend>
        <Boundary kind="public">After your approval and review.</Boundary>
        <Field label="Public title" hint="Describe the problem, not your company." error={err("publicTitle")} id="publicTitle">
          <input id="publicTitle" value={v.publicTitle} onChange={(e) => set("publicTitle", e.target.value)} disabled={locked} />
        </Field>
        {text("sanitizedSummary", "Public summary", "Two or three sentences.")}
        <Field label="Tags" hint="Comma-separated, e.g. Webhooks, Postgres." id="environment">
          <input id="environment" value={v.environment} onChange={(e) => set("environment", e.target.value)} disabled={locked} />
        </Field>
        <div className="row">
          <Field label="Price (test USDC)" hint="0.10–1.00" error={err("price")} id="price">
            <input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} disabled={locked} />
          </Field>
          <Field label="Sharing label (TLP)" hint="AMBER: verified buyers only." id="tlp">
            <select id="tlp" value={v.tlp} onChange={(e) => set("tlp", e.target.value as FormValues["tlp"])} disabled={locked}>
              <option value="clear">TLP:CLEAR — anyone</option>
              <option value="green">TLP:GREEN — partners</option>
              <option value="amber">TLP:AMBER — need-to-know</option>
            </select>
          </Field>
          <Field label="Shown to buyers as" hint="Lowers, not removes, identification risk." id="sharingLevel">
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
          <button className={`btn ${draftId ? "" : "primary"}`} type="submit" disabled={save.pending}>
            {save.pending ? "Saving…" : "Save draft"}
          </button>
          {draftId && (
            <button
              type="button"
              className="btn primary"
              disabled={save.pending}
              onClick={async () => {
                setTouched(true);
                if (Object.keys(errors).length) return;
                if (await save.run()) navigate(`/contribute/drafts/${draftId}/playbook`);
              }}
            >
              Save & continue <Icon name="arrow" size={16} className="icon-arrow" />
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
