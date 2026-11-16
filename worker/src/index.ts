// Worker entry: /api/* is handled here; everything else is static assets (SPA fallback).
import { alertForUncaught, APP_NAME } from "@we-rankin/shared";
import type { Env } from "./env";
import { log } from "./log";
import { Session } from "./session";

export { Session };

function secretsOf(env: Env): string[] {
  return env.CREATE_KEY ? [env.CREATE_KEY] : [];
}

async function route(request: Request, env: Env, reqId: string): Promise<Response> {
  const url = new URL(request.url);
  log({
    minLevel: env.LOG_LEVEL,
    level: "info",
    event: "http.requested",
    secrets: secretsOf(env),
    fields: { reqId, path: url.pathname, method: request.method },
  });
  if (url.pathname === "/api/health") {
    return Response.json({ ok: true, app: APP_NAME });
  }
  if (url.pathname.startsWith("/api/")) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env): Promise<Response> {
    const reqId = crypto.randomUUID();
    try {
      return await route(request, env, reqId);
    } catch (error) {
      const alert = alertForUncaught();
      log({
        minLevel: env.LOG_LEVEL,
        level: "error",
        event: "client.error",
        secrets: secretsOf(env),
        fields: {
          reqId,
          alert: alert.code,
          message: alert.message,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
      return Response.json({ error: "server_error", alert }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
