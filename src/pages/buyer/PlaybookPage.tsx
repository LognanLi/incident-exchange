import { useState } from "react";
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CONTRIBUTOR_SHARE_PERCENT, PLATFORM_SHARE_PERCENT, SECTION_INFO, URGENT_SAFETY_ADVICE } from "../../../convex/lib/domain";
import { splitRevenue } from "../../../convex/lib/money";
import { NOT_ENOUGH_INFO } from "../../../convex/lib/qa";
import { useSession } from "../../session";
import { BulletText, Empty, ErrorBox, EvidenceBadge, IntegrationBadge, Loading, Money, formatDate, useAction } from "../../components/ui";

type Guide = NonNullable<ReturnType<typeof useGuide>>;
type Run = Guide["validationRuns"][number];
function useGuide(id: Id<"playbooks">, actor: string) {
  return useQuery(api.playbooks.get, { actor, playbookId: id });
}

export default function PlaybookPage() {
  const { playbookId } = useParams();
  const id = playbookId as Id<"playbooks">;
  const { actor } = useSession();
  const pb = useGuide(id, actor);

  if (pb === undefined) return <Loading />;
  if (pb === null)
    return (
      <Empty title="Guide not found">
        It may have been withdrawn. <Link to="/playbooks">Back to search</Link>
      </Empty>
    );

  const split = splitRevenue(pb.priceAtomic);
  // Pair the latest fix with the check just before it and the first check after it.
  const runs = pb.validationRuns;
  const fixIdx = runs.map((r) => r.step).lastIndexOf("fix");
  const fix = fixIdx >= 0 ? runs[fixIdx] : undefined;
  const before = runs.slice(0, Math.max(fixIdx, 0)).filter((r) => r.step === "before").at(-1);
  const after = fixIdx >= 0 ? runs.slice(fixIdx + 1).find((r) => r.step === "after") : undefined;
  const reproduced = !!(before && after && before.passed === false && after.passed === true);

  return (
    <div className="playbook-page">
      <p>
        <Link to={pb.viewerRole === "buyer" ? "/playbooks" : "/"}>← Back</Link>
      </p>
      <header className="playbook-header">
        <div className="eyebrow">
          {pb.contributorAlias} · contributed incident · revision {pb.revision} · published {formatDate(pb.publishedAt)}
        </div>
        <h1>{pb.publicTitle}</h1>
        <p className="lede">{pb.publicSummary}</p>
        <div className="row gap wrap">
          {pb.environment.map((c) => (
            <span key={c} className="badge cat">
              {c}
            </span>
          ))}
        </div>
      </header>

      <div className="grid-main-side">
        <div>
          <section className="card fit-card" aria-labelledby="fit-h">
            <h2 id="fit-h">Does this fit your incident?</h2>
            <div className="grid-2 fit-grid">
              <div>
                <h3 className="small-h">Confirm before relying on it</h3>
                <ul className="check-list">
                  {pb.checksBeforeUse.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="small-h">It may not apply if…</h3>
                <ul className="clue-list warn-list">
                  {pb.mismatchSignals.map((m) => (
                    <li key={m.label}>
                      <strong>{m.label}.</strong> <span className="muted">{m.explanation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="tag-free">Free preview</div>
            <h3>{SECTION_INFO.recognize.title}</h3>
            <BulletText text={pb.recognize} />
            <h3>{SECTION_INFO.limitations.title}</h3>
            <BulletText text={pb.publicLimitations} />
          </section>

          {pb.lockedSteps ? (
            <section className="card unlocked" aria-label="Purchased guide">
              <div className="tag-unlocked">Unlocked · revision {pb.entitledRevision}</div>
              {pb.newerRevisionAvailable && (
                <div className="state state-info small">A newer revision ({pb.revision}) exists. Your purchase covers revision {pb.entitledRevision}.</div>
              )}
              {pb.failedAttempts && (
                <div className="step-block failed-block">
                  <h3>What they tried that did not work</h3>
                  <BulletText text={pb.failedAttempts} />
                </div>
              )}
              {(["check", "contain", "recover", "verify"] as const).map((k) => (
                <div key={k} className="step-block">
                  <h3>{SECTION_INFO[k].title}</h3>
                  <p className="hint">{SECTION_INFO[k].hint}</p>
                  <ActionChecklist playbookId={pb._id} prefix={k} text={pb.lockedSteps![k]} checked={pb.checkedItems} enabled={pb.viewerRole === "buyer"} />
                </div>
              ))}
              {pb.viewerRole === "buyer" && (
                <div className="row gap wrap">
                  <Link className="btn primary" to={`/playbooks/${id}/feedback`}>
                    Report your outcome
                  </Link>
                  {pb.successfulPurchaseId && <Link to={`/purchases/${pb.successfulPurchaseId}`}>View receipt</Link>}
                </div>
              )}
            </section>
          ) : (
            <section className="card locked">
              <div className="tag-locked">🔒 Locked — not sent to your browser until purchased</div>
              <h3>What they tried that did not work · Check · Contain · Recover · Verify</h3>
              <p className="muted">
                The detailed recovery sequence, unsuccessful attempts, implementation considerations, and a verification
                checklist unlock after purchase. The server only sends this text to entitled accounts.
              </p>
            </section>
          )}

          <QaBox playbookId={id} unlocked={pb.unlocked} />
        </div>

        <aside>
          {pb.viewerRole === "buyer" && !pb.unlocked && (
            <section className="card buy-box">
              <div className="price-big">
                <Money atomic={pb.priceAtomic} />
              </div>
              <p className="small">Unlocks revision {pb.revision}: failed attempts, Check, Contain, Recover, Verify, and Q&A over them.</p>
              <details className="small">
                <summary>Network and revenue split</summary>
                <table className="split-table">
                  <tbody>
                    <tr>
                      <td>Contributor accrual ({CONTRIBUTOR_SHARE_PERCENT}%)</td>
                      <td>
                        <Money atomic={split.contributorShareAtomic} />
                      </td>
                    </tr>
                    <tr>
                      <td>Platform fee ({PLATFORM_SHARE_PERCENT}%)</td>
                      <td>
                        <Money atomic={split.platformShareAtomic} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="muted">Test USDC on Base Sepolia (or a labeled simulator). Prototype split; accrual is not a payout.</p>
              </details>
              <Link className="btn primary block" to={`/playbooks/${id}/checkout`}>
                Unlock guide
              </Link>
            </section>
          )}

          <section className="card" aria-labelledby="ev-h">
            <h3 id="ev-h">Test evidence</h3>
            <EvidenceBadge level={pb.evidenceLevel} explain />
            <p className="small">{pb.evidenceScope}</p>
            {reproduced ? <EvidenceDetails before={before!} fix={fix} after={after!} /> : <p className="small muted">No reproduced test is recorded for this guide.</p>}
          </section>

          <section className="card">
            <h3>Free public context</h3>
            <p className="small muted">Public sources are free and are not the contributor's private lesson.</p>
            {pb.references.length === 0 ? (
              <p className="muted small">No public references attached.</p>
            ) : (
              <ul className="ref-list">
                {pb.references.map((r) => (
                  <li key={r._id}>
                    <a href={r.url} target="_blank" rel="noreferrer noopener">
                      {r.title}
                    </a>
                    <div className="small muted">
                      {r.sourceName} · retrieved {formatDate(r.retrievedAt)}
                    </div>
                    <div className="small">{r.relevanceNote}</div>
                    <span className={`badge ${r.seeded ? "muted-badge" : "ok"}`}>{r.seeded ? "Curated reference (not live-retrieved)" : "Retrieved via Apify"}</span>
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
            <h3>Urgent basics (always free)</h3>
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

function EvidenceDetails({ before, fix, after }: { before: Run; fix?: Run; after: Run }) {
  const passed = (r: Run) => r.outputLines.filter((l) => l.startsWith("PASS")).length;
  const total = (r: Run) => r.outputLines.filter((l) => l.startsWith("PASS") || l.startsWith("FAIL")).length;
  return (
    <details className="evidence-details">
      <summary>Fix tested on the sample app — see run</summary>
      <table className="ba-table">
        <thead>
          <tr>
            <th />
            <th>Before fix</th>
            <th>After fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Result</td>
            <td className="result-fail">FAIL</td>
            <td className="result-pass">PASS</td>
          </tr>
          <tr>
            <td>Checks passed</td>
            <td>
              {passed(before)}/{total(before)}
            </td>
            <td>
              {passed(after)}/{total(after)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="small">
        <strong>Target:</strong> {after.targetName}
        <br />
        <strong>Check:</strong> {after.checkName}
        <br />
        <strong>Checks run by:</strong> {after.toolName}
        {fix && (
          <>
            <br />
            <strong>Fix by:</strong> {fix.toolName}
          </>
        )}
        <br />
        <strong>When:</strong> {formatDate(after.runAt)}
      </p>
      <pre className="run-pre">{after.outputLines.join("\n")}</pre>
      <p className="small muted">Reproduced in a toy environment with synthetic data. It does not show the fix works on your production system.</p>
    </details>
  );
}

/** Buyer's own progress; saved per account and never modifies the contributor's guide. */
function ActionChecklist({ playbookId, prefix, text, checked, enabled }: { playbookId: Id<"playbooks">; prefix: string; text: string; checked: string[]; enabled: boolean }) {
  const { actor } = useSession();
  const set = useAction(useMutation(api.playbooks.setChecklistItem));
  // Optimistic local state; the server copy (checked) wins once it arrives.
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const isChecked = (id: string) => local[id] ?? checked.includes(id);
  const items = text.split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
  if (!enabled) return <BulletText text={text} />;
  const done = items.filter((_, i) => isChecked(`${prefix}-${i}`)).length;
  return (
    <div className="verify-list">
      {items.map((it, i) => {
        const itemId = `${prefix}-${i}`;
        return (
          <label key={itemId} className="check">
            <input
              type="checkbox"
              checked={isChecked(itemId)}
              onChange={(e) => {
                const value = e.target.checked;
                setLocal((l) => ({ ...l, [itemId]: value }));
                void set.run({ actor, playbookId, itemId, checked: value });
              }}
            />
            {it}
          </label>
        );
      })}
      <div className="small muted">
        {done} of {items.length} done · saved to your account
      </div>
      <ErrorBox message={set.error} />
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
        <h3>Ask this guide</h3>
        {moss && <IntegrationBadge state={moss.state} name="Moss" />}
      </div>
      <p className="small muted">
        Answers come only from this guide’s {unlocked ? "sections" : "free preview (unlock for the rest)"}, with section
        citations. Private contributor notes are never used.
      </p>
      <form
        className="row gap"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!question.trim()) return;
          setAnswer(await ask.run({ actor, playbookId, question }));
        }}
      >
        <input className="grow" aria-label="Question" placeholder="e.g. How do I confirm the fix worked?" value={question} onChange={(e) => setQuestion(e.target.value)} />
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
            <div className="small warn-text">No section was cited for this answer — check it against the guide.</div>
          )}
          {answer.note && <div className="small warn-text">{answer.note}</div>}
          <div className="small muted">
            Engine:{" "}
            {answer.engine === "moss_index"
              ? "Moss Inference, retrieving from this guide’s Moss index"
              : answer.engine === "moss_context"
                ? "Moss Inference, answering from this guide’s sections"
                : "deterministic keyword fallback"}
          </div>
        </div>
      )}
    </section>
  );
}
