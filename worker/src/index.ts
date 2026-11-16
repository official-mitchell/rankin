// Worker entry: /api/* is handled here; /__fixtures is 404; everything else is static assets (SPA fallback).
// More than 5 auth.failed events per minute means rotate CREATE_KEY by hand.
import { alertForUncaught, APP_NAME, CODE_ALPHABET, CODE_LENGTH } from "@we-rankin/shared";
import { createSession } from "./create-session";
import type { Env } from "./env";
import { log } from "./log";
import { safeEqual } from "./secret";
import { Session } from "./session";

export { Session };

function secretsOf(env: Env): string[] {
  return env.CREATE_KEY ? [env.CREATE_KEY] : [];
}

function sessionCode(pathname: string): { code: string; action: "ws" | "export" } | null {
  const match = pathname.match(/^\/api\/s\/([A-Z0-9]{6})\/(ws|export)$/);
  if (!match) return null;
  const code = match[1] ?? "";
  if (code.length !== CODE_LENGTH || [...code].some((char) => !CODE_ALPHABET.includes(char))) return null;
  return { code, action: match[2] as "ws" | "export" };
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
  if (url.pathname === "/api/sessions" && request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { createKey?: unknown; codes?: unknown } | null;
    const provided = typeof body?.createKey === "string" ? body.createKey : "";
    if (!env.CREATE_KEY || !safeEqual(provided, env.CREATE_KEY)) {
      log({
        minLevel: env.LOG_LEVEL,
        level: "warn",
        event: "auth.failed",
        secrets: secretsOf(env),
        fields: { reqId, path: url.pathname },
      });
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const codes = Array.isArray(body?.codes) ? body.codes.filter((code): code is string => typeof code === "string") : undefined;
    const created = await createSession(env, codes);
    if (!created) return Response.json({ error: "unavailable" }, { status: 503 });
    return Response.json(created);
  }
  const session = sessionCode(url.pathname);
  if (session) {
    const stub = env.SESSION.get(env.SESSION.idFromName(session.code));
    if (session.action === "ws") return stub.fetch(request);
    const headers = new Headers();
    const secret = request.headers.get("x-host-secret");
    if (secret) headers.set("x-host-secret", secret);
    return stub.fetch("http://session/export", { headers });
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__fixtures")) {
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
