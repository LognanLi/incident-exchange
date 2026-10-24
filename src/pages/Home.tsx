import { useNavigate } from "react-router-dom";
import { useSession } from "../session";
import { URGENT_SAFETY_ADVICE } from "../../convex/lib/domain";

export default function Home() {
  const navigate = useNavigate();
  const session = useSession();

  const go = (role: "contributor" | "buyer", path: string) => {
    if (session.role !== role) {
      const slug = session.slugForRole(role);
      if (slug) session.setActor(slug);
    }
    navigate(path);
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="eyebrow">Private marketplace for defensive security lessons</div>
        <h1>Turn a hard-won incident into a reviewed playbook the next team can use.</h1>
        <p className="lede">
          Companies that handle a security incident learn what the warning signs looked like, how they investigated,
          and how they verified the fix. Incident Exchange helps them share that as a privacy-reviewed guide, lets
          other teams find it by symptoms, and pays contributors when their experience helps.
        </p>
        <div className="hero-actions">
          <button className="btn primary lg" onClick={() => go("contributor", "/contribute")}>
            Share an incident
          </button>
          <button className="btn lg" onClick={() => go("buyer", "/playbooks")}>
            Find a playbook
          </button>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <h3>1 · Contributors stay in control</h3>
          <p>
            Rough notes stay private. You review a structured six-part draft, run a privacy scan, preview exactly what
            buyers will see, and nothing is published without your explicit approval.
          </p>
        </div>
        <div className="card">
          <h3>2 · Evidence is labeled honestly</h3>
          <p>
            Every guide carries one of three labels — <em>Contributor reported</em>, <em>Evidence reviewed</em>, or{" "}
            <em>Test reproduced</em> — set by a human reviewer. AI never certifies safety.
          </p>
        </div>
        <div className="card">
          <h3>3 · Buyers see the limits first</h3>
          <p>
            Search by symptoms, see why a guide matched, read its limitations and price, then unlock the detailed
            steps. Contributors earn a transparent share (demo split: 80% contributor / 20% platform).
          </p>
        </div>
      </section>

      <section className="grid-2">
        <div className="card trust">
          <h3>Trust & privacy</h3>
          <ul className="bullets">
            <li>Defensive detection, containment, recovery, and verification only — no attack instructions.</li>
            <li>The privacy scan reduces identification risk; it cannot guarantee anonymity.</li>
            <li>Private source notes are never shown to buyers and never used to answer buyer questions.</li>
            <li>Validation runs only against the bundled local demo target.</li>
            <li>Public research is always shown with source links.</li>
          </ul>
        </div>
        <div className="card urgent">
          <h3>Facing an active incident right now?</h3>
          <p className="muted">Basic protective advice is always free:</p>
          <ul className="bullets">
            {URGENT_SAFETY_ADVICE.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
