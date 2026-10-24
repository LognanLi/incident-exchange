import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "./session";
import { ErrorBoundary } from "./components/ui";
import { Icon, type IconName } from "./components/icons";
import { PageGuide } from "./components/PageGuide";
import { LiveToasts } from "./components/LiveToasts";
import Home from "./pages/Home";
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

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

const NAV: Record<string, { section: string; items: NavItem[] }> = {
  contributor: {
    section: "Share what you learned",
    items: [
      { to: "/contribute", label: "My incidents", icon: "folder", end: true },
      { to: "/contribute/new", label: "Share an incident", icon: "plus" },
    ],
  },
  reviewer: {
    section: "Review & trust",
    items: [
      { to: "/review", label: "Review queue", icon: "shield", end: true },
      { to: "/review/feedback", label: "Buyer outcomes", icon: "chat" },
      { to: "/review/audit", label: "Audit log", icon: "list" },
    ],
  },
  buyer: {
    section: "Get help with an incident",
    items: [
      { to: "/playbooks", label: "Find guidance", icon: "search" },
      { to: "/watchlist", label: "Alerts", icon: "bell" },
      { to: "/purchases", label: "My guides", icon: "book" },
      { to: "/team", label: "Team & budget", icon: "users" },
    ],
  },
};

const LEARN: NavItem[] = [
  { to: "/how-it-works", label: "How it works", icon: "spark" },
  { to: "/trust", label: "Trust & safety", icon: "lock" },
  { to: "/pricing", label: "Pricing", icon: "tag" },
];

export default function App() {
  const { org, role } = useSession();
  const location = useLocation();
  const nav = role ? NAV[role] : null;
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            <Icon name="logo" />
          </span>
          <span>Incident Exchange</span>
        </Link>

        <Link to="/demo" className="identity-card" title="Switch which fictional company you are acting as">
          <span className="identity-avatar" aria-hidden>
            {org?.displayName.slice(0, 1) ?? "?"}
          </span>
          <span className="identity-text">
            <span className="identity-name">{org ? org.displayName : "Choose a role"}</span>
            <span className="identity-sub">{role ? roleLabel(role) : "Demo identity"} · switch</span>
          </span>
          <Icon name="swap" />
        </Link>

        {nav && (
          <nav className="vtabs" aria-label={nav.section}>
            <div className="vtabs-label">{nav.section}</div>
            {nav.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="vtab">
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <nav className="vtabs" aria-label="Learn">
          <div className="vtabs-label">Learn</div>
          {LEARN.map((n) => (
            <NavLink key={n.to} to={n.to} className="vtab">
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Link to="/demo" className="vtab presenter">
            <Icon name="sliders" />
            <span>Presenter controls</span>
          </Link>
          <p className="sidebar-note">Demo build · fictional companies · test USDC only</p>
        </div>
      </aside>

      <div className="content">
        <main id="main" className="main" tabIndex={-1}>
          <PageGuide />
          <ErrorBoundary resetKey={location.pathname + (org?.slug ?? "")}>
            <div className="page-enter" key={location.pathname}>
              <Routes>
                <Route path="/" element={<Home />} />
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
          Defensive guidance only — detection, containment, recovery, and verification. Matches are discovery aids, not
          proof that two incidents share a cause. All companies and incidents shown are fictional.
        </footer>
      </div>
      <LiveToasts />
    </div>
  );
}

function roleLabel(role: string) {
  return role === "buyer" ? "Buyer" : role === "contributor" ? "Contributor" : "Reviewer";
}
