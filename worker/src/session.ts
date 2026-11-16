// Session Durable Object. SQLite migration v1 plus the metrics counter table.
import type { Env } from "./env";
import { ensureMetricsTable, inc, parseMetricInc, readMetrics } from "./metrics";

export class Session {
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState, _env: Env) {
    this.sql = state.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    this.sql.exec(`INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('version', '1')`);
    ensureMetricsTable(this.sql);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/metrics" && request.method === "POST") {
      const parsed = parseMetricInc(await request.json().catch(() => null));
      if (!parsed) return Response.json({ error: "bad_metric" }, { status: 400 });
      inc(this.sql, parsed.name, parsed.n);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/metrics" && request.method === "GET") {
      return Response.json(readMetrics(this.sql));
    }
    return Response.json({ ok: true });
  }
}
