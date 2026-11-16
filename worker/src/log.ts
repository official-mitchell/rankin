// One JSON line per call. Drops secret keys and any string equal to a known secret.
import type { EventName } from "@we-rankin/shared";

const RANK: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SECRET_KEYS = new Set([
  "create_key",
  "createkey",
  "hostsecret",
  "host_secret",
  "authorization",
  "cookie",
  "cookies",
  "headers",
  "set-cookie",
]);

export type LogFields = {
  reqId: string;
  sessionCode?: string;
  playerId?: string;
  [key: string]: unknown;
};

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, "");
  return SECRET_KEYS.has(lower) || SECRET_KEYS.has(compact) || compact === "createkey" || compact === "hostsecret";
}

function redactValue(value: unknown, secrets: ReadonlySet<string>): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const secret of secrets) next = next.replaceAll(secret, "[redacted]");
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets));
  if (value && typeof value === "object") return redactObject(value as Record<string, unknown>, secrets);
  return value;
}

function redactObject(fields: Record<string, unknown>, secrets: ReadonlySet<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isSecretKey(key)) continue;
    out[key] = redactValue(value, secrets);
  }
  return out;
}

export function log(options: {
  minLevel: string;
  level: "debug" | "info" | "warn" | "error";
  event: EventName;
  fields: LogFields;
  secrets?: readonly string[];
}): void {
  const min = RANK[options.minLevel] ?? RANK.info;
  if ((RANK[options.level] ?? RANK.info) < (min ?? RANK.info)) return;
  const secrets = new Set((options.secrets ?? []).filter((value) => value.length > 0));
  const line = {
    ts: new Date().toISOString(),
    level: options.level,
    event: options.event,
    ...redactObject(options.fields, secrets),
  };
  console.log(JSON.stringify(line));
}
