// Checklist 3.2: host fragment is stored and stripped.
import { describe, expect, it } from "vitest";
import { captureHostSecret, hostSecretKey, listDeviceSessions, rememberPlayer } from "./host-secret";

describe("captureHostSecret", () => {
  it("stores the fragment and returns a URL without it", () => {
    const stored = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => stored.set(key, value) };
    const next = captureHostSecret("https://we-rankin.test/s/ABC234#h=secret-value", storage);
    expect(next).toBe("/s/ABC234");
    expect(stored.get(hostSecretKey("ABC234"))).toBe("secret-value");
  });

  it("lists a joined player beside a hosted session", () => {
    const stored = new Map<string, string>();
    const storage = {
      get length() {
        return stored.size;
      },
      key: (index: number) => [...stored.keys()][index] ?? null,
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    };
    storage.setItem(hostSecretKey("HOSTED"), "secret");
    storage.setItem("we-rankin:player:JOINED", "player-1");
    rememberPlayer("JOINED", "Ada", storage);
    const sessions = listDeviceSessions(storage);
    expect(sessions.map((session) => session.code)).toContain("HOSTED");
    expect(sessions.find((session) => session.code === "JOINED")).toMatchObject({ role: "player", name: "Ada" });
    expect(sessions.find((session) => session.code === "HOSTED")?.role).toBe("host");
  });

  it("leaves a URL with no host fragment unchanged", () => {
    const storage = { setItem: () => { throw new Error("should not store"); } };
    expect(captureHostSecret("https://we-rankin.test/s/ABC234", storage)).toBeNull();
  });
});
