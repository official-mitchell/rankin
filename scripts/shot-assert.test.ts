// Checklist 3.4: each assertion fails once on a synthetic broken probe.
import { describe, expect, it } from "vitest";
import { shotFailures, type ShotProbe } from "./shot-assert";

const clean: ShotProbe = { scrollWidth: 390, clientWidth: 390, clipped: 0, smallTargets: 0, consoleErrors: [] };

describe("shot assertions", () => {
  it("passes a clean probe", () => {
    expect(shotFailures(clean)).toEqual([]);
  });

  it("trips overflow, clipping, tap size, and console errors one at a time", () => {
    expect(shotFailures({ ...clean, scrollWidth: 500 })).toEqual(["horizontal overflow"]);
    expect(shotFailures({ ...clean, clipped: 1 })).toEqual(["clipped text"]);
    expect(shotFailures({ ...clean, smallTargets: 1 })).toEqual(["tap target under 48px"]);
    expect(shotFailures({ ...clean, consoleErrors: ["boom"] })).toEqual(["console error"]);
  });
});
