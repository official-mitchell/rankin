import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "./log";

describe("log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits CREATE_KEY, host secret, and raw headers", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const createKey = "super-secret-create-key";
    const hostSecret = "host-secret-value";
    log({
      minLevel: "info",
      level: "info",
      event: "auth.failed",
      secrets: [createKey, hostSecret],
      fields: {
        reqId: "req-1",
        CREATE_KEY: createKey,
        hostSecret,
        headers: { cookie: "a=b" },
        note: `leaked ${createKey}`,
        nested: { authorization: "Bearer x", ok: hostSecret },
      },
    });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("req-1");
    expect(line).not.toContain(createKey);
    expect(line).not.toContain(hostSecret);
    expect(line).not.toContain("cookie");
    expect(line).not.toContain("Bearer");
  });

  it("drops debug lines when the floor is info", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log({
      minLevel: "info",
      level: "debug",
      event: "http.requested",
      fields: { reqId: "req-2" },
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
