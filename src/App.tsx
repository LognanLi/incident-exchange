import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import { useSession } from "./session";
import { ErrorBoundary } from "./components/ui";
import Home from "./pages/Home";
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
import Search from "./pages/buyer/Search";
import PlaybookPage from "./pages/buyer/PlaybookPage";
import Checkout from "./pages/buyer/Checkout";
import PurchaseConfirmation from "./pages/buyer/PurchaseConfirmation";
import FeedbackForm from "./pages/buyer/FeedbackForm";
import Purchases from "./pages/buyer/Purchases";

const NAV: Record<string, { to: string; label: string }[]> = {
  contributor: [
    { to: "/contribute", label: "My incidents" },
    { to: "/contribute/new", label: "Share an incident" },
  ],
  reviewer: [
    { to: "/review", label: "Review queue" },
    { to: "/review/feedback", label: "Buyer feedback" },
  ],
  buyer: [
    { to: "/playbooks", label: "Find a playbook" },
    { to: "/purchases", label: "My purchases" },
  ],
};

export default function App() {
  const { org, role } = useSession();
  const location = useLocation();
  return (
    <div className="app">
      <div className="demo-strip" role="note">
        Demo build — all organizations, people, and incidents are fictional. Payments use Base Sepolia test USDC or a simulator; no real funds move.
      </div>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ◆
          </span>
          Incident Exchange
        </Link>
        <nav className="nav" aria-label="Main">
          {(role ? NAV[role] : []).map((n) => (
            <NavLink key={n.to} to={n.to} end>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/demo" className="identity" title="Open the demo menu to switch role or reset data">
          <span className="identity-label">Acting as</span>
          <span className="identity-name">{org ? org.displayName : "…"}</span>
          {role && <span className={`role-chip role-${role}`}>{role}</span>}
          <span className="identity-demo">Demo menu ▾</span>
        </Link>
      </header>
      <main className="main">
        <ErrorBoundary resetKey={location.pathname + (org?.slug ?? "")}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo" element={<DemoMenu />} />
            <Route path="/contribute" element={<ContributorDashboard />} />
            <Route path="/contribute/new" element={<IncidentForm />} />
            <Route path="/contribute/drafts/:draftId/report" element={<IncidentForm />} />
            <Route path="/contribute/drafts/:draftId/playbook" element={<PlaybookEditor />} />
            <Route path="/contribute/drafts/:draftId/privacy" element={<PrivacyReview />} />
            <Route path="/contribute/drafts/:draftId/status" element={<DraftStatusPage />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/review/feedback" element={<FeedbackInbox />} />
            <Route path="/review/:draftId" element={<ReviewDetail />} />
            <Route path="/playbooks" element={<Search />} />
            <Route path="/playbooks/:playbookId" element={<PlaybookPage />} />
            <Route path="/playbooks/:playbookId/checkout" element={<Checkout />} />
            <Route path="/playbooks/:playbookId/feedback" element={<FeedbackForm />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/:purchaseId" element={<PurchaseConfirmation />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        Incident Exchange shares defensive guidance only — detection, containment, recovery, and verification. Similarity
        between incidents is a discovery aid, not proof of a shared cause.
      </footer>
    </div>
  );
}
