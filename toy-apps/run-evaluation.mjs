// Child-process entry used by scripts/factory-runner.mjs to evaluate an untrusted candidate.
//   node --permission --allow-fs-read=<workspace>,<repo>/toy-apps toy-apps/run-evaluation.mjs <case> <candidate-path>
// A per-run nonce is read from stdin BEFORE the candidate is imported; the result line echoes it, so a
// candidate that prints its own fake "passed" JSON and exits cannot produce an accepted result.
// Built-in prototypes are frozen and stdout/JSON references captured before the candidate loads.
const [caseId, candidatePath] = process.argv.slice(2);
const evaluators = {
  webhook: "./webhook/evaluate.mjs",
  tenant: "./tenant/evaluate.mjs",
  keycache: "./keycache/evaluate.mjs",
};
const write = process.stdout.write.bind(process.stdout);
const stringify = JSON.stringify;
const exit = process.exit.bind(process);

let nonce = "";
for await (const chunk of process.stdin) nonce += chunk;
nonce = nonce.trim();

if (!Object.hasOwn(evaluators, caseId) || !candidatePath || !nonce) {
  write(stringify({ nonce, passed: false, summary: "bad evaluator arguments", assertions: [] }) + "\n");
  exit(2);
}

const { evaluate } = await import(evaluators[caseId]);
for (const o of [Object, Object.prototype, Array.prototype, Function.prototype, Promise, Promise.prototype, JSON, String.prototype, Map.prototype, Set.prototype]) {
  Object.freeze(o);
}

let result;
try {
  const mod = await import(new URL(`file://${candidatePath}`).href);
  result = await evaluate(mod);
} catch (e) {
  result = { passed: false, summary: `candidate failed to load: ${String(e?.message ?? e).slice(0, 200)}`, assertions: [] };
}
write(stringify({ nonce, passed: result.passed === true, summary: String(result.summary), assertions: result.assertions }) + "\n");
exit(0);
