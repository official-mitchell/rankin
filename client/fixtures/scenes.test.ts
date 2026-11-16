// Checklist 3.3: every scene name points at a fixture object.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCENE_NAMES, SCENES } from "./scenes";

describe("fixture registry", () => {
  it("resolves every scene to a fixture file", () => {
    expect(SCENE_NAMES.length).toBeGreaterThan(0);
    for (const name of SCENE_NAMES) {
      expect(SCENES[name]?.phase).toBeTruthy();
      expect(existsSync(new URL(`./${name}.json`, import.meta.url))).toBe(true);
    }
  });
});
