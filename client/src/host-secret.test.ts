// Checklist 3.2: host fragment is stored and stripped.
import { describe, expect, it } from "vitest";
import { captureHostSecret, hostSecretKey } from "./host-secret";

describe("captureHostSecret", () => {
  it("stores the fragment and returns a URL without it", () => {
    const stored = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => stored.set(key, value) };
    const next = captureHostSecret("https://we-rankin.test/s/ABC234#h=secret-value", storage);
    expect(next).toBe("/s/ABC234");
    expect(stored.get(hostSecretKey("ABC234"))).toBe("secret-value");
  });

  it("leaves a URL with no host fragment unchanged", () => {
    const storage = { setItem: () => { throw new Error("should not store"); } };
    expect(captureHostSecret("https://we-rankin.test/s/ABC234", storage)).toBeNull();
  });
});
