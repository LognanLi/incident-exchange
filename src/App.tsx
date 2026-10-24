import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "./session";
import { ErrorBoundary } from "./components/ui";
import { Icon } from "./components/icons";
import { useReveal } from "./components/motion";
import { PageGuide } from "./components/PageGuide";
import { LiveToasts } from "./components/LiveToasts";
import { CommandPalette } from "./components/CommandPalette";
import { DemoTour } from "./components/DemoTour";
import Home from "./pages/Home";
import Agents from "./pages/Agents";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import Trust from "./pages/Trust";
import DemoMenu from "./pages/DemoMenu";
import NotFound from "./pages/NotFound";
import ContributorDashboard from "./pages/contributor/Dashboard";
import IncidentForm from "./pages/contributor/IncidentForm";
import PlaybookEditor from "./pages/contributor/PlaybookEditor";
import PrivacyReview from "./pages/contributor/PrivacyReview";
import DraftStatusPage from "./pages/contributor/DraftStatus";
import ReviewQueue from "./pages/reviewer/Queue";
import ReviewDetail from "./pages/reviewer/ReviewDetail";
import FeedbackInbox from "./pages/reviewer/FeedbackInbox";
import AuditLog from "./pages/reviewer/AuditLog";
import Search from "./pages/buyer/Search";
import PlaybookPage from "./pages/buyer/PlaybookPage";
import Checkout from "./pages/buyer/Checkout";
import PurchaseConfirmation from "./pages/buyer/PurchaseConfirmation";
import FeedbackForm from "./pages/buyer/FeedbackForm";
import Purchases from "./pages/buyer/Purchases";
import Watchlist from "./pages/buyer/Watchlist";
import TeamSpend from "./pages/buyer/TeamSpend";

type NavItem = { to: string; label: string; end?: boolean };

const NAV: Record<string, NavItem[]> = {
  contributor: [
    { to: "/contribute", label: "My incidents", end: true },
    { to: "/contribute/new", label: "Share an incident" },
  ],
  reviewer: [
    { to: "/review", label: "Review queue", end: true },
    { to: "/review/feedback", label: "Outcomes" },
    { to: "/review/audit", label: "Audit log" },
  ],
  buyer: [
    { to: "/playbooks", label: "Find a fix" },
    { to: "/watchlist", label: "Alerts" },
    { to: "/purchases", label: "My guides" },
    { to: "/team", label: "Budget" },
  ],
};

const LEARN: NavItem[] = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/trust", label: "Trust" },
  { to: "/pricing", label: "Pricing" },
];

const openPalette = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
const openTour = () => window.dispatchEvent(new Event("ix:open-tour"));

export default function App() {
  const { org, role } = useSession();
  const location = useLocation();
  const nav = role ? NAV[role] : [];
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  useReveal(mainRef, location.pathname);

  // Close the mobile menu on navigation; jump to top on route change.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Incident Exchange home">
            <span className="brand-mark" aria-hidden>
              <Icon name="logo" />
            </span>
            <span className="brand-text">Incident Exchange</span>
          </Link>

          <nav className="nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/agents" className="nav-link">
              Agents
            </NavLink>
          </nav>

          <div className="topbar-right">
            <PageGuide />
            <button className="top-btn hide-sm" onClick={openPalette} aria-label="Search (⌘K)">
              <Icon name="search" size={16} />
              <kbd>⌘K</kbd>
            </button>
            <Link to="/demo" className="identity" title="Switch demo company">
              <span className={`role-dot role-${role ?? "none"}`} aria-hidden />
              <span className="identity-text">
                <span className="identity-name">{org ? org.displayName : "Choose a role"}</span>
                <span className="identity-sub">{role ? roleLabel(role) : "Demo"}</span>
              </span>
            </Link>
            <button
              className="icon-btn menu-btn"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? "x" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="sheet" id="mobile-menu">
          <nav className="sheet-group" aria-label="Main">
            <div className="eyebrow">{role ? roleLabel(role) : "Menu"}</div>
            {[...nav, { to: "/agents", label: "Agents" }].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="sheet-link">
                {n.label} <Icon name="arrow" size={16} />
              </NavLink>
            ))}
          </nav>
          <nav className="sheet-group" aria-label="Learn">
            <div className="eyebrow">Learn</div>
            {LEARN.map((n) => (
              <NavLink key={n.to} to={n.to} className="sheet-link">
                {n.label} <Icon name="arrow" size={16} />
              </NavLink>
            ))}
          </nav>
          <div className="sheet-group">
            <div className="eyebrow">Demo</div>
            <button className="sheet-link" onClick={() => { setMenuOpen(false); openPalette(); }}>
              Search <Icon name="search" size={16} />
            </button>
            <button className="sheet-link" onClick={() => { setMenuOpen(false); openTour(); }}>
              Guided tour <Icon name="arrow" size={16} />
            </button>
            <NavLink to="/demo" className="sheet-link">
              Switch company <Icon name="swap" size={16} />
            </NavLink>
          </div>
        </div>
      )}

      <main id="main" className="main" tabIndex={-1} ref={mainRef}>
        <ErrorBoundary resetKey={location.pathname + (org?.slug ?? "")}>
          <div className="page-enter" key={location.pathname}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/trust" element={<Trust />} />
              <Route path="/demo" element={<DemoMenu />} />
              <Route path="/contribute" element={<ContributorDashboard />} />
              <Route path="/contribute/new" element={<IncidentForm />} />
              <Route path="/contribute/drafts/:draftId/report" element={<IncidentForm />} />
              <Route path="/contribute/drafts/:draftId/playbook" element={<PlaybookEditor />} />
              <Route path="/contribute/drafts/:draftId/privacy" element={<PrivacyReview />} />
              <Route path="/contribute/drafts/:draftId/status" element={<DraftStatusPage />} />
              <Route path="/review" element={<ReviewQueue />} />
              <Route path="/review/feedback" element={<FeedbackInbox />} />
              <Route path="/review/audit" element={<AuditLog />} />
              <Route path="/review/:draftId" element={<ReviewDetail />} />
              <Route path="/playbooks" element={<Search />} />
              <Route path="/playbooks/:playbookId" element={<PlaybookPage />} />
              <Route path="/playbooks/:playbookId/checkout" element={<Checkout />} />
              <Route path="/playbooks/:playbookId/feedback" element={<FeedbackForm />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/purchases/:purchaseId" element={<PurchaseConfirmation />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/team" element={<TeamSpend />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Demo · fictional companies · test money only</span>
          <nav className="footer-links" aria-label="Footer">
            {LEARN.map((n) => (
              <Link key={n.to} to={n.to}>
                {n.label}
              </Link>
            ))}
            <button onClick={openTour}>Guided tour</button>
            <Link to="/demo">Demo controls</Link>
          </nav>
        </div>
      </footer>
      <LiveToasts />
      <CommandPalette />
      <DemoTour />
    </div>
  );
}

function roleLabel(role: string) {
  return role === "buyer" ? "Buyer" : role === "contributor" ? "Contributor" : "Reviewer";
}
