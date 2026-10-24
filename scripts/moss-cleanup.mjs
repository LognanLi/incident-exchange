// Delete this app's stale Moss indexes (names matching ix-<id>-preview|full). Never touches other indexes.
import { MossClient } from "@moss-js/moss";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../.secrets.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const c = new MossClient(env.MOSS_PROJECT_ID, env.MOSS_PROJECT_KEY);
const list = await c.listIndexes();
console.log("indexes before:", list.map((i) => i.name).join(", "));
for (const i of list) if (/^ix-[a-z0-9]+-(preview|full)$/.test(i.name)) { await c.deleteIndex(i.name); console.log("deleted", i.name); }
