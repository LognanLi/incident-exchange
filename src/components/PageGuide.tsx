import { useEffect, useRef, useState, type ReactNode } from "react";
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
  ["/", { title: "Incident Exchange", body: "Buy a tested fix from a team that already solved your problem — or sell yours.", terms: ["guide"] }],
  ["/agents", { title: "Agents", body: "One coding agent shares a verified fix; another finds it, pays a test amount, adapts it, and proves it with tests.", terms: ["x402"] }],
  ["/how-it-works", { title: "How it works", body: "The full loop, from private incident to paid, tested guide.", terms: [] }],
  ["/pricing", { title: "Pricing", body: "What buyers pay and contributors earn.", terms: ["accrual"] }],
  ["/trust", { title: "Trust", body: "How identities, payments, and testing are kept safe.", terms: ["tlp", "privacy scan"] }],
  ["/demo", { title: "Demo controls", body: "Pick which fictional company you are. For presenting only.", terms: [] }],
  ["/contribute", { title: "My incidents", body: "What you've shared, its review status, and earnings.", terms: ["accrual"] }],
  ["/contribute/new", { title: "Share an incident", body: "Describe what happened and what fixed it. Nothing is shared until you approve it.", terms: [] }],
  ["/contribute/drafts/:id/report", { title: "Step 1 · Report", body: "Your private notes. Only you and reviewers see this.", terms: [] }],
  ["/contribute/drafts/:id/playbook", { title: "Step 2 · Guide", body: "Your notes become six sections. Check each against your notes, then accept.", terms: ["guide"] }],
  ["/contribute/drafts/:id/privacy", { title: "Step 3 · Privacy", body: "Remove anything that identifies you, preview what buyers see, then approve.", terms: ["privacy scan", "revision"] }],
  ["/contribute/drafts/:id/status", { title: "Step 4 · Publish", body: "A reviewer checks it; you give the final yes.", terms: [] }],
  ["/review", { title: "Review queue", body: "Guides waiting for a human check before they can be sold.", terms: ["evidence level"] }],
  ["/review/feedback", { title: "Outcomes", body: "What buyers reported after using a guide.", terms: [] }],
  ["/review/audit", { title: "Audit log", body: "A permanent record of who did what, and when.", terms: [] }],
  ["/review/:id", { title: "Review", body: "Check the content, test the fix on a sample app, then decide.", terms: ["test reproduced", "evidence level"] }],
  ["/playbooks", { title: "Find a fix", body: "Describe what you see. Each result says why it may — or may not — fit.", terms: ["overlap"] }],
  ["/playbooks/:id", { title: "Guide", body: "Read the free part first. Unlock the full steps if it fits.", terms: ["evidence level", "tlp"] }],
  ["/playbooks/:id/checkout", { title: "Checkout", body: "Accept the license and pay with test money. Nothing real is charged.", terms: ["x402", "test usdc"] }],
  ["/playbooks/:id/feedback", { title: "Report outcome", body: "Tell others whether the guide helped.", terms: [] }],
  ["/purchases", { title: "My guides", body: "Guides you've unlocked, with receipts.", terms: [] }],
  ["/purchases/:id", { title: "Receipt", body: "Proof of purchase and how the money is split.", terms: ["accrual", "test usdc"] }],
  ["/watchlist", { title: "Alerts", body: "Get notified the moment a matching guide is published.", terms: ["overlap"] }],
  ["/team", { title: "Budget", body: "Set a monthly limit and see team activity.", terms: [] }],
];

/** "?" button in the top bar: a one-line explanation of the current page plus glossary terms. */
export function PageGuide() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const entry = GUIDES.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!entry) return null;
  const g = entry[1];
  return (
    <div className="help-wrap" ref={wrap}>
      <button className="top-btn" aria-label="About this page" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="help" size={17} />
      </button>
      {open && (
        <div className="help-pop" role="note">
          <strong>{g.title}</strong>
          {g.body}
          {g.terms && g.terms.length > 0 && (
            <span className="guide-terms">
              Terms:{" "}
              {g.terms.map((t, i) => (
                <span key={t}>
                  <Term k={t} />
                  {i < g.terms!.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
