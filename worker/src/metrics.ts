// SQLite counters on the session Durable Object. Reads survive a new stub for the same id.
import { isMetricName, type MetricName } from "@we-rankin/shared";

export function ensureMetricsTable(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS metrics (name TEXT PRIMARY KEY, n INTEGER NOT NULL)`);
}

export function inc(sql: SqlStorage, name: MetricName, n = 1): void {
  ensureMetricsTable(sql);
  sql.exec(
    `INSERT INTO metrics (name, n) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET n = n + excluded.n`,
    name,
    n,
  );
}

export function readMetrics(sql: SqlStorage): Record<string, number> {
  ensureMetricsTable(sql);
  const rows = sql.exec<{ name: string; n: number }>(`SELECT name, n FROM metrics`).toArray();
  const out: Record<string, number> = {};
  for (const row of rows) out[row.name] = row.n;
  return out;
}

export function parseMetricInc(body: unknown): { name: MetricName; n: number } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { name?: unknown; n?: unknown };
  if (typeof record.name !== "string" || !isMetricName(record.name)) return null;
  const n = record.n === undefined ? 1 : record.n;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return { name: record.name, n };
}
