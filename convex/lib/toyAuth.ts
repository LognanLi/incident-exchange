// Local demo target: a tiny, in-memory, fictional login service. It never touches a network,
// real accounts, or real credentials. The "unsafe configuration" is that a routine update reset
// the failed-attempt threshold to 0, which silently disables lockout and alerting.

export type ToyAuthConfig = {
  /** 0 disables lockout entirely (the misconfiguration). */
  maxFailedAttempts: number;
  lockoutWindowSeconds: number;
  alertOnRepeatedFailures: boolean;
};

export const MISCONFIGURED: ToyAuthConfig = {
  maxFailedAttempts: 0,
  lockoutWindowSeconds: 900,
  alertOnRepeatedFailures: false,
};

export const DEFENSIVE_FIX: ToyAuthConfig = {
  maxFailedAttempts: 5,
  lockoutWindowSeconds: 900,
  alertOnRepeatedFailures: true,
};

type LoginResult = "ok" | "invalid" | "locked";

export function createToyAuthService(config: ToyAuthConfig) {
  const accounts = new Map([["demo-user", "correct-horse-demo"]]);
  const failures = new Map<string, number[]>();
  const alerts: string[] = [];

  function recentFailures(user: string, now: number): number[] {
    const windowStart = now - config.lockoutWindowSeconds * 1000;
    const list = (failures.get(user) ?? []).filter((t) => t >= windowStart);
    failures.set(user, list);
    return list;
  }

  return {
    alerts,
    login(user: string, password: string, now: number): LoginResult {
      const recent = recentFailures(user, now);
      if (config.maxFailedAttempts > 0 && recent.length >= config.maxFailedAttempts) return "locked";
      if (accounts.get(user) === password) {
        failures.set(user, []);
        return "ok";
      }
      recent.push(now);
      if (
        config.alertOnRepeatedFailures &&
        config.maxFailedAttempts > 0 &&
        recent.length === config.maxFailedAttempts
      ) {
        alerts.push(`Repeated authentication failures for ${user}; account temporarily locked.`);
      }
      return "invalid";
    },
  };
}

export const CHECK_NAME = "Repeated-failure throttling and alerting";

export type CheckResult = { passed: boolean; summary: string; outputLines: string[] };

/**
 * Defensive check: simulate a burst of failed logins for the fictional test account and assert
 * the service throttles them and raises an alert. Purely local and deterministic.
 */
export function runThrottlingCheck(config: ToyAuthConfig): CheckResult {
  const svc = createToyAuthService(config);
  const start = Date.UTC(2026, 0, 1);
  const attempts = 12;
  const results: LoginResult[] = [];
  for (let i = 0; i < attempts; i++) results.push(svc.login("demo-user", "wrong-password", start + i * 1000));
  const firstLocked = results.indexOf("locked");
  const lockedCount = results.filter((r) => r === "locked").length;

  const assertions = [
    { name: "Failed attempts are throttled within 10 tries", ok: firstLocked !== -1 && firstLocked <= 10 },
    { name: "Subsequent attempts are rejected while locked", ok: lockedCount >= attempts - 10 },
    { name: "An alert is raised for repeated failures", ok: svc.alerts.length > 0 },
  ];
  const passed = assertions.every((a) => a.ok);
  const outputLines = [
    `target: local toy login service (in-memory, fictional account "demo-user")`,
    `config: maxFailedAttempts=${config.maxFailedAttempts}, lockoutWindowSeconds=${config.lockoutWindowSeconds}, alertOnRepeatedFailures=${config.alertOnRepeatedFailures}`,
    `simulated ${attempts} failed logins → ${results.filter((r) => r === "invalid").length} invalid, ${lockedCount} locked, ${svc.alerts.length} alert(s)`,
    ...assertions.map((a) => `${a.ok ? "PASS" : "FAIL"}  ${a.name}`),
  ];
  return {
    passed,
    summary: passed
      ? "All assertions passed: repeated failures are throttled and alerted."
      : `${assertions.filter((a) => !a.ok).length} of ${assertions.length} assertions failed: repeated failures are not throttled or alerted.`,
    outputLines,
  };
}

export function describePatch(from: ToyAuthConfig, to: ToyAuthConfig): string {
  const lines: string[] = ["--- toy-auth/config (current)", "+++ toy-auth/config (defensive fix)"];
  for (const key of Object.keys(to) as (keyof ToyAuthConfig)[]) {
    if (from[key] !== to[key]) {
      lines.push(`- ${key}: ${String(from[key])}`);
      lines.push(`+ ${key}: ${String(to[key])}`);
    } else {
      lines.push(`  ${key}: ${String(to[key])}`);
    }
  }
  return lines.join("\n");
}
