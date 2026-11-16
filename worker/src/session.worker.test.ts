import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Session durable object", () => {
  it("returns ok from a fresh stub", async () => {
    const stub = env.SESSION.get(env.SESSION.idFromName("ok"));
    const response = await stub.fetch("http://session/");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps metrics when a new stub is opened for the same id", async () => {
    const id = env.SESSION.idFromName("metrics");
    const first = env.SESSION.get(id);
    const write = await first.fetch("http://session/metrics", {
      method: "POST",
      body: JSON.stringify({ name: "writes_ok", n: 2 }),
    });
    expect(write.status).toBe(200);

    const second = env.SESSION.get(id);
    const read = await second.fetch("http://session/metrics");
    expect(await read.json()).toEqual({ writes_ok: 2 });
  });
});
