// POST /api/sessions. Retries when a generated code already has a Durable Object (checklist 4.2).
import type { Env } from "./env";
import { randomCode, randomSecret, sha256 } from "./secret";

export async function createSession(env: Env, codes?: string[]): Promise<{ code: string; hostSecret: string } | null> {
  const hostSecret = randomSecret();
  const hostSecretHash = await sha256(hostSecret);
  const planned = (codes ?? []).slice(0, 5);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = planned[attempt] ?? randomCode();
    const stub = env.SESSION.get(env.SESSION.idFromName(code));
    const response = await stub.fetch("http://session/init", {
      method: "POST",
      body: JSON.stringify({ code, hostSecretHash }),
    });
    if (response.status === 409) continue;
    if (!response.ok) return null;
    return { code, hostSecret };
  }
  return null;
}
