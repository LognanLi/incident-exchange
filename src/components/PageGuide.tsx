import { useState, type ReactNode } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { Icon } from "./icons";

/** Plain-language explanations for non-technical viewers. */
export const GLOSSARY: Record<string, string> = {
  guide: "A step-by-step write-up by a team that already fixed this kind of problem.",
  "privacy scan": "An automatic check that finds names, emails, and other details that could show who shared a guide. You remove them before anyone sees it.",
  "evidence level": "How much proof backs a guide: the contributor's word, a reviewer checked their evidence, or the fix was tested on a sample app.",
  "test reproduced": "The fix was run against a small sample app with fake data: it failed before the fix and passed after. It does not prove it works on your systems.",
  overlap: "How closely the symptoms you typed match the signs described in a guide. It helps you find candidates; it is not proof of the same cause.",
  tlp: "A simple label security teams use to say who may see something. CLEAR: anyone. GREEN: your company and partners. AMBER: only people who need it.",
  x402: "An open payment standard that lets software pay for something on the web automatically. Here it uses test money with no real value.",
  "test usdc": "A test version of a digital dollar on a practice network (Base Sepolia). It has no real value.",
  accrual: "Money the contributor has earned on paper. It has not been paid out yet in this prototype.",
  revision: "A specific approved version of a guide. Editing creates a new version that must be approved again.",
};

const LABELS: Record<string, string> = { tlp: "TLP", "test usdc": "test USDC", x402: "x402" };

export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const text = GLOSSARY[k];
  children = children ?? LABELS[k];
  return (
    <span className="term" tabIndex={0} aria-label={`${children ?? k}: ${text}`}>
      {children ?? k}
      <span className="term-tip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

type Guide = { title: string; body: string; terms?: string[] };

const GUIDES: [string, Guide][] = [
  ["/", { title: "Welcome", body: "Learn how another company fixed a problem like yours. It is private, checked by a person, and costs a small fee.", terms: ["guide"] }],
  ["/how-it-works", { title: "How it works", body: "A 60-second walkthrough of the whole loop, from a private incident to a paid, tested guide.", terms: [] }],
  ["/pricing", { title: "Pricing", body: "What buyers pay, what contributors earn, and what teams get.", terms: ["accrual"] }],
  ["/trust", { title: "Trust & safety", body: "How we hide who shared a guide, keep payments safe, and stop misuse.", terms: ["tlp", "privacy scan"] }],
  ["/demo", { title: "Presenter controls", body: "Pick which fictional company you are, and reset the demo. This screen is for presenting only.", terms: [] }],
  ["/contribute", { title: "Your incidents", body: "Everything your team has shared, where it is in review, and what you have earned.", terms: ["accrual"] }],
  ["/contribute/new", { title: "Share an incident", body: "Describe what happened and what fixed it in plain words. Nothing is shared until you approve it.", terms: [] }],
  ["/contribute/drafts/:id/report", { title: "Step 1 · Your report", body: "Your private notes. Only you and reviewers can see this page.", terms: [] }],
  ["/contribute/drafts/:id/playbook", { title: "Step 2 · The shareable guide", body: "We turn your notes into six clear sections. Check each one against your notes on the right, then accept it.", terms: ["guide"] }],
  ["/contribute/drafts/:id/privacy", { title: "Step 3 · Privacy check", body: "We look for anything that could identify your company. Fix or remove it, preview exactly what buyers see, then approve.", terms: ["privacy scan", "revision"] }],
  ["/contribute/drafts/:id/status", { title: "Step 4 · Review & publish", body: "A human reviewer checks your guide. Once approved, you give a final yes and it goes live.", terms: [] }],
  ["/review", { title: "Review queue", body: "Guides waiting for a human check before anyone can buy them.", terms: ["evidence level"] }],
  ["/review/feedback", { title: "Buyer outcomes", body: "What buyers reported after using a guide — did it help?", terms: [] }],
  ["/review/audit", { title: "Audit log", body: "A permanent record of who did what and when. Enterprise customers need this for compliance.", terms: [] }],
  ["/review/:id", { title: "Review a guide", body: "Check the content, test the fix on a sample app, and decide whether it can be published.", terms: ["test reproduced", "evidence level"] }],
  ["/playbooks", { title: "Find guidance", body: "Describe what you are seeing in your own words. We show guides with similar symptoms and explain why each may — or may not — fit.", terms: ["overlap"] }],
  ["/playbooks/:id", { title: "Guide preview", body: "Read the free part first: the signs, when it does not apply, and its proof. Unlock the full steps if it fits.", terms: ["evidence level", "tlp"] }],
  ["/playbooks/:id/checkout", { title: "Unlock the guide", body: "Agree to the usage terms and pay with test money. Nothing real is charged.", terms: ["x402", "test usdc"] }],
  ["/playbooks/:id/feedback", { title: "Report your outcome", body: "Tell the community whether the guide helped. It improves the guide and rewards good contributors.", terms: [] }],
  ["/purchases", { title: "My guides", body: "Guides your team has unlocked, with receipts.", terms: [] }],
  ["/purchases/:id", { title: "Receipt", body: "Proof of purchase and how the money is split.", terms: ["accrual", "test usdc"] }],
  ["/watchlist", { title: "Alerts", body: "Save a description of a problem. When a matching guide is published, you get notified instantly.", terms: ["overlap"] }],
  ["/team", { title: "Team & budget", body: "Set a monthly spending limit and see your team's activity.", terms: [] }],
];

export function PageGuide() {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const entry = GUIDES.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  if (!entry || hidden[entry[0]]) return null;
  const [key, g] = entry;
  return (
    <div className="page-guide" role="note">
      <Icon name="info" />
      <div>
        <strong>{g.title}.</strong> {g.body}
        {g.terms && g.terms.length > 0 && (
          <span className="guide-terms">
            {" "}
            Words to know:{" "}
            {g.terms.map((t, i) => (
              <span key={t}>
                <Term k={t} />
                {i < g.terms!.length - 1 ? ", " : ""}
              </span>
            ))}
          </span>
        )}
      </div>
      <button className="icon-btn" aria-label="Hide this tip" onClick={() => setHidden((h) => ({ ...h, [key]: true }))}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
