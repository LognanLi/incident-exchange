import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useSession } from "../session";
import { URGENT_SAFETY_ADVICE } from "../../convex/lib/domain";
import { Icon, type IconName } from "../components/icons";
import { Term } from "../components/PageGuide";

/** Count up to a number once (respects reduced motion). */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className="stat-num">{n}</span>;
}

const PATHS: { role: "buyer" | "contributor" | "reviewer"; icon: IconName; title: string; body: string; to: string; cta: string }[] = [
  { role: "buyer", icon: "search", title: "I have a problem right now", body: "Describe what you see. Get guides from teams who already fixed it — with reasons each may or may not fit.", to: "/playbooks", cta: "Find guidance" },
  { role: "contributor", icon: "folder", title: "We solved something hard", body: "Turn your incident notes into a privacy-safe guide in minutes. You approve every word and earn 80% of each sale.", to: "/contribute", cta: "Share an incident" },
  { role: "reviewer", icon: "shield", title: "I check quality", body: "Review evidence, test the fix on a sample app, and decide what gets published.", to: "/review", cta: "Open review queue" },
];

export default function Home() {
  const navigate = useNavigate();
  const session = useSession();
  const stats = useQuery(api.business.marketStats);

  const go = (role: "contributor" | "buyer" | "reviewer", path: string) => {
    if (session.role !== role) {
      const slug = session.slugForRole(role);
      if (slug) session.setActor(slug);
    }
    navigate(path);
  };

  return (
    <div className="home">
      <section className="hero2">
        <div className="hero2-glow" aria-hidden />
        <span className="pill">Private marketplace for incident response know-how</span>
        <h1>When something breaks, learn from the team that already fixed it.</h1>
        <p className="lede">
          Companies share a privacy-safe write-up of an incident they solved. Other teams describe their symptoms, see
          honestly whether it fits, and unlock the step-by-step fix — with proof it was tested. Contributors earn 80%.
        </p>
        <div className="hero-actions">
          <button className="btn primary lg" onClick={() => go("buyer", "/playbooks")}>
            <Icon name="search" /> Describe what you’re seeing
          </button>
          <button className="btn lg" onClick={() => go("contributor", "/contribute")}>
            Share an incident
          </button>
          <Link className="btn ghost lg" to="/how-it-works">
            How it works <Icon name="arrow" />
          </Link>
        </div>
        {stats && (
          <dl className="hero-stats">
            <div>
              <dt>Guides available</dt>
              <dd>
                <CountUp to={stats.guides} />
              </dd>
            </div>
            <div>
              <dt>Fixes tested on sample apps</dt>
              <dd>
                <CountUp to={stats.reproduced} />
              </dd>
            </div>
            <div>
              <dt>Test runs recorded</dt>
              <dd>
                <CountUp to={stats.testRuns} />
              </dd>
            </div>
            <div>
              <dt>Buyer outcomes reported</dt>
              <dd>
                <CountUp to={stats.outcomes} />
              </dd>
            </div>
          </dl>
        )}
        <p className="tiny muted">Demo data · all companies are fictional · counts are live from the database</p>
      </section>

      <section>
        <h2 className="section-title">Where do you want to start?</h2>
        <div className="grid-3 stagger">
          {PATHS.map((p) => (
            <button key={p.role} className="card lift path-card" onClick={() => go(p.role, p.to)}>
              <span className="step-icon">
                <Icon name={p.icon} size={20} />
              </span>
              <h3>{p.title}</h3>
              <p className="muted small">{p.body}</p>
              <span className="path-cta">
                {p.cta} <Icon name="arrow" size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid-3 stagger">
        <div className="card">
          <h3>
            <Icon name="lock" /> Free vs. paid vs. private
          </h3>
          <ul className="bullets small">
            <li>
              <strong>Free:</strong> symptoms, “does this fit?” checklist, warnings, <Term k="evidence level" />, public sources
            </li>
            <li>
              <strong>Paid:</strong> what failed, the full fix, and how to confirm it worked
            </li>
            <li>
              <strong>Private:</strong> the contributor’s raw notes and identity
            </li>
          </ul>
        </div>
        <div className="card">
          <h3>
            <Icon name="shield" /> Proof, not promises
          </h3>
          <p className="small muted">
            Every guide is human-reviewed. Many are <Term k="test reproduced">tested on a sample app</Term>: it fails before
            the fix and passes after, while normal use still works.
          </p>
        </div>
        <div className="card urgent">
          <h3>Facing an active incident?</h3>
          <ul className="bullets small">
            {URGENT_SAFETY_ADVICE.slice(0, 3).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
