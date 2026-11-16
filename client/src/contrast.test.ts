// Checklist 3.1 contrast floors and banned text pairings.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const PANEL = "#141518";

describe("contrast ledger", () => {
  it("meets the guide floors", () => {
    expect(contrastRatio("#b0aa9e", PANEL)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#85827c", PANEL)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#f8e7ad", "#5b0a10")).toBeGreaterThanOrEqual(4.5);
    for (const fill of ["#5fb9e9", "#d9b654", "#ef5356"]) {
      expect(contrastRatio("#0e0f11", fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("does not paint text with neutral-500, red-400, or red-500, and keeps Russo at weight 400", () => {
    const css = [
      readFileSync(new URL("./styles/tokens.css", import.meta.url), "utf8"),
      readFileSync(new URL("./styles/shell.css", import.meta.url), "utf8"),
    ].join("\n");
    expect(css).not.toMatch(/color:\s*var\(--neutral-500\)/);
    expect(css).not.toMatch(/color:\s*var\(--red-400\)/);
    expect(css).not.toMatch(/color:\s*var\(--red-500\)/);
    expect(css).toContain('--font-display: "Russo One"');
    expect(css).toContain("font-synthesis: none");
    expect(css).not.toMatch(/font:\s*(?!400\b)\d+[^;]*var\(--font-display\)/);
  });
});
