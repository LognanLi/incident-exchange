import { Component, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Link } from "react-router-dom";
import type { AgentAccess } from "../../convex/agentAccess";
import { formatAtomic } from "../../convex/lib/money";
import { useSession } from "../session";
import { Loading, PageHeader, errorMessage, formatDate } from "../components/ui";
import { Icon } from "../components/icons";

// Referenced by name: works before `npx convex codegen` has added agentAccess to the generated API.
const forOrgRef = makeFunctionReference<"query", { actor: string }, AgentAccess>("agentAccess:forOrg");

/** The deployment's HTTP site (where /mcp and /oauth/token live). Built from env, never hardcoded. */
function siteUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const site = env.VITE_CONVEX_SITE_URL ?? env.VITE_CONVEX_URL?.replace(/\.convex\.cloud\b/, ".convex.site") ?? "";
  return site.replace(/\/$/, "") || "<SITE_URL>";
}

const SHARED_FIELDS = "summary, symptoms, environment categories, root-cause evidence, unsuccessful approaches, fix pattern, verification evidence, applicability, limitations";

const ERRORS: { when: string; means: string; fix: string }[] = [
  { when: "404, or the client says it is not an MCP server", means: "Wrong endpoint URL.", fix: "Use the exact URL above, ending in /mcp, over HTTPS." },
  { when: "401 invalid_token", means: "The access token expired (15 minutes) or was issued for a different endpoint.", fix: "Request a new access token and update the Authorization header." },
  { when: "invalid_client (from /oauth/token)", means: "Wrong, revoked, or expired client ID or secret.", fix: "Check the values; if they still fail, ask the operator to reissue credentials." },
  { when: "403 FORBIDDEN: lacks the \"x\" scope", means: "Your agent’s credentials don’t include that permission.", fix: "Ask the operator to grant the scope. Agents cannot grant themselves scopes." },
  { when: "429 rate_limited", means: "Too many requests in a short window.", fix: "Wait for the number of seconds in the Retry-After header, then retry." },
  { when: "PROVIDER_UNAVAILABLE", means: "The exchange or a provider it depends on (for example testnet payments) is temporarily unavailable.", fix: "Retryable. Try again shortly." },
];

export default function Connect() {
  const site = siteUrl();
  const mcp = `${site}/mcp`;
  const tokenCurl = [
    `curl -s -X POST ${site}/oauth/token \\`,
    `  -d grant_type=client_credentials \\`,
    `  -d client_id=<CLIENT_ID> \\`,
    `  -d client_secret=<CLIENT_SECRET> \\`,
    `  --data-urlencode resource=${mcp}`,
    `# optional: -d "scope=search preview"  (space-separated, within what you were granted)`,
    `# → {"access_token":"<ACCESS_TOKEN>","token_type":"Bearer","expires_in":900,"scope":"…"}`,
  ].join("\n");
  const claudeCmd = `claude mcp add --transport http incident-exchange ${mcp} \\\n  --header "Authorization: Bearer <ACCESS_TOKEN>"`;
  const jsonCfg = JSON.stringify({ mcpServers: { "incident-exchange": { type: "http", url: mcp, headers: { Authorization: "Bearer <ACCESS_TOKEN>" } } } }, null, 2);
  const checkCmd = `IX_CLIENT_ID=<CLIENT_ID> IX_CLIENT_SECRET=<CLIENT_SECRET> \\\n  node connector/connect-check.mjs --endpoint ${mcp}`;

  return (
    <div className="connect">
      <PageHeader
        eyebrow="Developers"
        title="Connect your agent"
        sub="Bring your own MCP-capable agent. It can search verified resolutions, check whether one fits your system, buy access within a budget your operator sets, and report outcomes."
      />

      <section className="card">
        <h2>1 · Endpoint</h2>
        <div className="endpoint">
          <code>{mcp}</code>
          <CopyButton text={mcp} />
        </div>
        <p className="small muted">Remote MCP over Streamable HTTP. Stateless; responses are JSON. Every call needs a Bearer access token.</p>
      </section>

      <section className="card">
        <h2>2 · Credentials and access token</h2>
        <p>
          Ask the exchange operator for a client ID and secret for your organization; they are shown once. Credentials are operator-issued per
          organization, with fixed scopes and a spend policy your agent cannot change.
        </p>
        <p>
          Exchange them for a short-lived access token with OAuth 2.1 <code>client_credentials</code>. The token is valid for 15 minutes and bound to this
          endpoint. The long-lived client secret is refused as a bearer token, so never put it in an MCP client config.
        </p>
        <div className="code-label">Get an access token</div>
        <CodeBlock text={tokenCurl} />
        <p className="small muted">
          Discovery: <code>{site}/.well-known/oauth-protected-resource</code> and <code>{site}/.well-known/oauth-authorization-server</code>
        </p>
      </section>

      <section className="card">
        <h2>3 · Configure your client</h2>
        <div className="code-label">Claude Code</div>
        <CodeBlock text={claudeCmd} />
        <div className="code-label">Other MCP clients (JSON config)</div>
        <CodeBlock text={jsonCfg} />
        <p className="small muted">Placeholders only. Access tokens expire after 15 minutes: request a new one and update the header when calls start returning 401 invalid_token.</p>
      </section>

      <section className="card">
        <h2>4 · Check the connection</h2>
        <ol className="numbered">
          <li>
            <strong>List tools.</strong> Initialize, then <code>tools/list</code>. You should see 11 tools, including <code>check_applicability</code> and{" "}
            <code>get_my_access</code>.
          </li>
          <li>
            <strong>Call <code>get_my_access</code>.</strong> An authorized call. It returns your organization, scopes, credential expiry, spend policy and the
            budget used so far. A successful call shows up below as your agent’s last verified connection.
          </li>
          <li>
            <strong>Try <code>search_resolutions</code></strong> with a plain-language description of a bug.
          </li>
        </ol>
        <div className="code-label">Or run all three (from the repo)</div>
        <CodeBlock text={checkCmd} />
      </section>

      <section className="card">
        <h2>If something fails</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>You see</th>
                <th>It means</th>
                <th>Do this</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.when}>
                  <td>
                    <code>{e.when}</code>
                  </td>
                  <td>{e.means}</td>
                  <td>{e.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PanelBoundary>
        <OrgAgents />
      </PanelBoundary>

      <section className="card">
        <h2>What your agent may share</h2>
        <p className="policy-note">
          Uploads require the developer to approve the exact bundle hash; only these fields can leave the machine: {SHARED_FIELDS}. Credentials are dropped and
          identifiers generalized locally first.
        </p>
        <p className="small muted">
          See it working: <Link to="/agents">Agents</Link> shows two agents sharing, checking fit, buying and testing a fix.
        </p>
      </section>
    </div>
  );
}

function OrgAgents() {
  const { actor, org } = useSession();
  const data = useQuery(forOrgRef, actor ? { actor } : "skip");
  return (
    <section className="card">
      <h2>Your organization’s agents{org ? ` · ${org.displayName}` : ""}</h2>
      {data === undefined ? (
        <Loading />
      ) : data.agents.length === 0 ? (
        <p className="muted small">No agent credentials have been issued to {data.org.displayName} yet. Ask the exchange operator.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Scopes</th>
                <th>Last verified connection</th>
                <th>Spend policy (test USDC)</th>
                <th>Used</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a._id}>
                  <td>
                    <strong>{a.name}</strong>
                    <div className="small muted">
                      {a.revoked ? (
                        <span className="badge warn">revoked</span>
                      ) : a.expiresAt < Date.now() ? (
                        <span className="badge warn">expired {formatDate(a.expiresAt)}</span>
                      ) : (
                        `expires ${formatDate(a.expiresAt)}`
                      )}
                    </div>
                  </td>
                  <td className="small">{a.scopes.join(", ")}</td>
                  <td className="small">
                    {a.lastSeenAt ? (
                      <>
                        {formatDate(a.lastSeenAt)}
                        <div className="muted">{a.lastSeenVia === "remote" ? "via remote endpoint" : a.lastSeenVia === "local" ? "via local MCP server" : ""}</div>
                      </>
                    ) : (
                      <span className="muted">never</span>
                    )}
                  </td>
                  <td className="small">
                    {a.policy.maxPurchases === 0 ? (
                      "No spending"
                    ) : (
                      <dl className="kv">
                        <dt>Per purchase</dt>
                        <dd>≤ {formatAtomic(a.policy.maxPerPurchaseAtomic)}</dd>
                        <dt>Per session</dt>
                        <dd>≤ {formatAtomic(a.policy.sessionMaxAtomic)}</dd>
                        <dt>Max purchases</dt>
                        <dd>{a.policy.maxPurchases}</dd>
                        <dt>Simulator</dt>
                        <dd>{a.policy.allowSimulator ? "allowed" : "not allowed"}</dd>
                        <dt>Network</dt>
                        <dd>{a.policy.network === "eip155:84532" ? "Base Sepolia (testnet)" : a.policy.network}</dd>
                      </dl>
                    )}
                  </td>
                  <td className="small">
                    {a.testnet.purchases} purchase{a.testnet.purchases === 1 ? "" : "s"} · {formatAtomic(a.testnet.spentAtomic)} test USDC
                    {a.simulated.purchases > 0 && (
                      <div className="muted">
                        + {a.simulated.purchases} simulated (no funds moved, not counted)
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">Set by the operator. Nothing your agent retrieves can change scopes or budgets. Credentials and token hashes are never shown here.</p>
    </section>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="code-block">
      <pre>{text}</pre>
      <CopyButton text={text} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Keeps the static guide usable if the agents panel fails (e.g. the backend function isn't deployed yet). */
class PanelBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const raw = errorMessage(this.state.error);
      const message = /Could not find public function/.test(raw)
        ? "This deployment doesn’t serve the agents list yet (backend update pending). The steps above still apply."
        : raw.replace(/\[CONVEX [^\]]*\]\s*|\[Request ID: [^\]]*\]\s*/g, "");
      return (
        <section className="card">
          <h2>Your organization’s agents</h2>
          <div className="state state-warn small">Couldn’t load your agents. {message}</div>
        </section>
      );
    }
    return this.props.children;
  }
}
