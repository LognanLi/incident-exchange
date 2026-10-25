import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { Icon } from "./icons";

const KEY = "incident-exchange.tour";
const PRIMARY_QUERY = "The queue fills again after restarting workers, and identical webhook event IDs create two jobs";

type Step = { who: "contributor" | "reviewer" | "buyer"; title: string; click: string; say: string; path: (ids: Ids) => string | null };
type Ids = { draftId?: string; playbookId?: string };

const STEPS: Step[] = [
  { who: "buyer", title: "The problem", click: "Nothing yet — just set the scene.", say: "An on-call engineer sees duplicate jobs and a queue that refills after every restart. Someone else has solved this before.", path: () => "/" },
  { who: "contributor", title: "A team writes it up", click: "Click “Draft with Moss”, then “Accept all sections”.", say: "Their private notes become six clear sections. The notes stay private on the right.", path: (i) => (i.draftId ? `/contribute/drafts/${i.draftId}/playbook` : "/contribute") },
  { who: "contributor", title: "Privacy check", click: "“Run privacy scan” → “Apply all recommended generalizations” → tick approval → “Approve & submit”.", say: "Emails, internal hosts, dates and names are caught before anything can be shared.", path: (i) => (i.draftId ? `/contribute/drafts/${i.draftId}/privacy` : null) },
  { who: "reviewer", title: "Proof it works", click: "“Run check” (fails) → “Apply fix with Factory Droid” → tick the checklist → “Test reproduced” → “Approve”.", say: "The fix is tested on a sample app with fake data: it fails before, passes after, and normal use still works.", path: (i) => (i.draftId ? `/review/${i.draftId}` : "/review") },
  { who: "contributor", title: "Contributor says yes", click: "Tick the final approval → “Publish guide”.", say: "Nothing goes live without the contributor approving this exact version.", path: (i) => (i.draftId ? `/contribute/drafts/${i.draftId}/status` : null) },
  { who: "buyer", title: "The buyer is alerted and searches", click: "Watch the alert pop up, then read why the top result is a “Strong overlap”.", say: "The team that needed this is told instantly — and sees honestly whether it fits.", path: () => `/playbooks?q=${encodeURIComponent(PRIMARY_QUERY)}` },
  { who: "buyer", title: "Unlock with test money", click: "“Unlock guide” → agree to the license → “Start x402 test checkout” → “Pay”.", say: "Software can buy knowledge right inside the response workflow. This is test money on a practice network.", path: (i) => (i.playbookId ? `/playbooks/${i.playbookId}/checkout` : null) },
  { who: "buyer", title: "Use it and report back", click: "Read “What they tried that did not work”, tick a step, then “Report your outcome”.", say: "It tells you what failed, what worked, and how to confirm it — and buyers rate whether it helped.", path: (i) => (i.playbookId ? `/playbooks/${i.playbookId}` : null) },
  { who: "contributor", title: "Everyone wins", click: "Look at “Accrued (owed, not paid out)”.", say: "80% of each settled test sale accrues to the contributor, 20% to the platform. Payouts are not implemented; simulated sales are not counted.", path: () => "/contribute" },
];

const WHO: Record<Step["who"], string> = { contributor: "Northstar Cloud", reviewer: "Review Desk", buyer: "Harbor Analytics" };

/** Floating, step-by-step presenter guide for the three-minute demo. */
export function DemoTour() {
  const [state, setState] = useState<{ open: boolean; step: number }>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "") as { open: boolean; step: number };
    } catch {
      return { open: false, step: 0 };
    }
  });
  const session = useSession();
  const navigate = useNavigate();
  const drafts = useQuery(api.drafts.listMine, session.orgs ? { actor: session.actorFor("northstar") } : "skip");
  const primary = drafts?.drafts.find((d) => d.publicTitle.toLowerCase().includes("webhook")) ?? drafts?.drafts[drafts.drafts.length - 1];
  const ids: Ids = { draftId: primary?._id, playbookId: primary?.playbookId };

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(state)), [state]);
  useEffect(() => {
    const open = () => setState((s) => ({ ...s, open: true }));
    window.addEventListener("ix:open-tour", open);
    return () => window.removeEventListener("ix:open-tour", open);
  }, []);

  if (!state.open) return null;
  const step = STEPS[state.step];
  const go = (index: number) => {
    const s = STEPS[index];
    const slug = session.slugForRole(s.who);
    if (slug && session.role !== s.who) session.setActor(slug);
    const path = s.path(ids);
    if (path) navigate(path);
    setState({ open: true, step: index });
  };
  return (
    <aside className="tour" aria-label="Guided tour">
      <div className="tour-head">
        <span className="pill">
          Tour · {String(state.step + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
        </span>
        <button className="icon-btn" aria-label="Close guided tour" onClick={() => setState((s) => ({ ...s, open: false }))}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="tour-progress" aria-hidden>
        <span style={{ width: `${((state.step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="tour-step" key={state.step}>
        <div className="eyebrow">As {WHO[step.who]}</div>
        <h3>{step.title}</h3>
        <p className="small">
          <strong>Click</strong> {step.click}
        </p>
        <p className="small muted">“{step.say}”</p>
      </div>
      <div className="row gap">
        <button className="btn sm" disabled={state.step === 0} onClick={() => go(state.step - 1)}>
          Back
        </button>
        <button className="btn sm primary grow" onClick={() => go(state.step)}>
          Take me there
        </button>
        <button className="btn sm" disabled={state.step === STEPS.length - 1} onClick={() => go(state.step + 1)}>
          Next <Icon name="arrow" size={14} className="icon-arrow" />
        </button>
      </div>
    </aside>
  );
}
