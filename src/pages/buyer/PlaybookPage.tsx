import { useState } from "react";
import { useAction as useConvexAction, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT, SECTION_INFO, URGENT_SAFETY_ADVICE } from "../../../convex/lib/domain";
import { splitRevenue } from "../../../convex/lib/money";
import { NOT_ENOUGH_INFO } from "../../../convex/lib/qa";
import { useSession } from "../../session";
import { BulletText, Empty, ErrorBox, EvidenceBadge, IntegrationBadge, Loading, Money, formatDate, useAction } from "../../components/ui";

export default function PlaybookPage() {
  const { playbookId } = useParams();
  const id = playbookId as Id<"playbooks">;
  const { actor } = useSession();
  const pb = useQuery(api.playbooks.get, { actor, playbookId: id });

  if (pb === undefined) return <Loading />;
  if (pb === null) return <Empty title="Playbook not found">It may have been unpublished. <Link to="/playbooks">Back to search</Link></Empty>;

  const split = splitRevenue(pb.priceMinorUnits);
  const before = pb.validationRuns.filter((r) => r.step === "before").at(-1);
  const fix = pb.validationRuns.filter((r) => r.step === "fix").at(-1);
  const after = pb.validationRuns.filter((r) => r.step === "after").at(-1);

  return (
    <div className="playbook-page">
      <p>
        <Link to={pb.viewerRole === "buyer" ? "/playbooks" : "/"}>← Back</Link>
      </p>
      <header className="playbook-header">
        <div className="eyebrow">
          {pb.contributorAlias} · {pb.sourceCategory} · published {formatDate(pb.publishedAt)}
        </div>
        <h1>{pb.publicTitle}</h1>
        <p className="lede">{pb.publicSummary}</p>
        <div className="row gap wrap">
          {pb.systemCategories.map((c) => (
            <span key={c} className="badge cat">
              {c}
            </span>
          ))}
        </div>
      </header>

      <div className="grid-main-side">
        <div>
          <section className="card">
            <h2>Evidence & provenance</h2>
            <EvidenceBadge level={pb.evidenceLevel} explain />
            {after?.passed && before && before.passed === false ? (
              <p className="small">
                Reproduced on <strong>{after.targetName}</strong>: check failed before the fix, passed after. Fix applied
                by: {fix?.toolName}. Checks run by: {after.toolName}.
              </p>
            ) : (
              <p className="small muted">No reproduced test is recorded for this guide.</p>
            )}
            <p className="small muted">
              Labels are set by a human reviewer. Incident Exchange does not certify that any guidance is safe for your
              environment.
            </p>
          </section>

          <section className="card">
            <div className="tag-free">Free preview</div>
            <h3>{SECTION_INFO.recognize.title}</h3>
            <BulletText text={pb.recognize} />
            <h3>{SECTION_INFO.limitations.title}</h3>
            <BulletText text={pb.publicLimitations} />
          </section>

          {pb.lockedSteps ? (
            <section className="card unlocked">
              <div className="tag-unlocked">Unlocked</div>
              {(["check", "contain", "recover", "verify"] as const).map((k) => (
                <div key={k} className="step-block">
                  <h3>{SECTION_INFO[k].title}</h3>
                  <p className="hint">{SECTION_INFO[k].hint}</p>
                  {k === "verify" ? <VerifyChecklist text={pb.lockedSteps![k]} /> : <BulletText text={pb.lockedSteps![k]} />}
                </div>
              ))}
              {pb.viewerRole === "buyer" && (
                <div className="row gap">
                  <Link className="btn primary" to={`/playbooks/${id}/feedback`}>
                    Report your outcome
                  </Link>
                  {pb.successfulPurchaseId && <Link to={`/purchases/${pb.successfulPurchaseId}`}>View purchase receipt</Link>}
                </div>
              )}
            </section>
          ) : (
            <section className="card locked">
              <div className="tag-locked">🔒 Locked</div>
              <h3>Check · Contain · Recover · Verify</h3>
              <p className="muted">
                Step-by-step defensive evidence collection, containment, recovery, and a verification checklist unlock
                after purchase.
              </p>
            </section>
          )}

          <QaBox playbookId={id} unlocked={pb.unlocked} />
        </div>

        <aside>
          {pb.viewerRole === "buyer" && !pb.unlocked && (
            <section className="card buy-box">
              <div className="price-big">
                <Money minor={pb.priceMinorUnits} currency={pb.currency} />
              </div>
              <p className="small">Unlocks: Check, Contain, Recover, and Verify sections, plus grounded Q&A over them.</p>
              <table className="split-table">
                <tbody>
                  <tr>
                    <td>Contributor ({CONTRIBUTOR_SHARE_PERCENT}%)</td>
                    <td>
                      <Money minor={split.contributorShareMinorUnits} currency={pb.currency} />
                    </td>
                  </tr>
                  <tr>
                    <td>Platform ({PLATFORM_SHARE_PERCENT}%)</td>
                    <td>
                      <Money minor={split.platformShareMinorUnits} currency={pb.currency} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="small muted">Prototype split — a demo assumption, not final commercial policy.</p>
              <IntegrationBadge state="demo" name="Payment" />
              <Link className="btn primary block" to={`/playbooks/${id}/checkout`}>
                Continue to demo checkout
              </Link>
            </section>
          )}

          <section className="card">
            <h3>Public references</h3>
            {pb.references.length === 0 ? (
              <p className="muted small">No public references attached.</p>
            ) : (
              <ul className="ref-list">
                {pb.references.map((r) => (
                  <li key={r._id}>
                    <a href={r.url} target="_blank" rel="noreferrer noopener">
                      {r.title}
                    </a>
                    <div className="small muted">{r.sourceName}</div>
                    <div className="small">{r.relevanceNote}</div>
                    <span className={`badge ${r.seeded ? "muted-badge" : "ok"}`}>{r.seeded ? "Seeded reference — not live-retrieved" : "Retrieved via Apify"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3>Buyer outcomes</h3>
            {pb.feedback.count === 0 ? (
              <p className="muted small">No outcomes reported yet.</p>
            ) : (
              <p className="small">
                {pb.feedback.count} report(s): {pb.feedback.resolved} resolved, {pb.feedback.partiallyResolved} partially resolved.
              </p>
            )}
          </section>

          <section className="card urgent">
            <h3>Urgent basic advice (always free)</h3>
            <ul className="bullets small">
              {URGENT_SAFETY_ADVICE.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function VerifyChecklist({ text }: { text: string }) {
  const items = text.split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  return (
    <div className="verify-list">
      {items.map((it, i) => (
        <label key={i} className="check">
          <input type="checkbox" checked={done[i]} onChange={(e) => setDone(done.map((d, j) => (j === i ? e.target.checked : d)))} />
          {it}
        </label>
      ))}
      <div className="small muted">
        {done.filter(Boolean).length} of {items.length} verified (stored only in this browser tab)
      </div>
    </div>
  );
}

function QaBox({ playbookId, unlocked }: { playbookId: Id<"playbooks">; unlocked: boolean }) {
  const { actor } = useSession();
  const ask = useAction(useConvexAction(api.playbooks.askPlaybook));
  const integrations = useQuery(api.integrations.status);
  const moss = integrations?.find((i) => i.key === "moss");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof ask.run>>>(undefined);
  return (
    <section className="card qa">
      <div className="toolbar">
        <h3>Ask this playbook</h3>
        {moss && <IntegrationBadge state={moss.state} name="Moss" />}
      </div>
      <p className="small muted">
        Answers come only from this guide’s {unlocked ? "sections" : "free preview sections (unlock for the rest)"}, with
        section citations. Private contributor notes are never used.
      </p>
      <form
        className="row gap"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!question.trim()) return;
          setAnswer(await ask.run({ actor, playbookId, question }));
        }}
      >
        <input className="grow" aria-label="Question" placeholder="e.g. How do I confirm lockout is working?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button className="btn" disabled={ask.pending}>
          {ask.pending ? "Asking…" : "Ask"}
        </button>
      </form>
      <ErrorBox message={ask.error} />
      {answer && (
        <div className={`answer ${answer.grounded ? "" : "ungrounded"}`}>
          {answer.engine === "fallback" && answer.grounded ? (
            <ul className="bullets">
              {answer.citations.map((c, i) => (
                <li key={i}>
                  {c.excerpt} <span className="cite">[{c.title}]</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="answer-text">{answer.answer}</p>
          )}
          {answer.engine !== "fallback" && answer.citations.length > 0 && (
            <div className="small">
              Cited sections:{" "}
              {answer.citations.map((c) => (
                <span key={c.section} className="cite">
                  [{c.title}]{" "}
                </span>
              ))}
            </div>
          )}
          {answer.engine !== "fallback" && !answer.grounded && answer.answer !== NOT_ENOUGH_INFO && (
            <div className="small warn-text">Moss did not cite a section for this answer — check it against the guide.</div>
          )}
          {answer.note && <div className="small warn-text">{answer.note}</div>}
          <div className="small muted">
            Engine:{" "}
            {answer.engine === "moss_index"
              ? "Moss Inference, retrieving from this playbook’s Moss index"
              : answer.engine === "moss_context"
                ? "Moss Inference, answering from this playbook’s sections (no index built)"
                : "deterministic fallback"}
          </div>
        </div>
      )}
    </section>
  );
}
