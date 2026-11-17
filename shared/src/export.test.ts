// CSV escaping, voter-index shuffle, and chart SVG shape (checklist 11.1–11.2).
import { describe, expect, it } from "vitest";
import { leaderboardSvg, pitchCardSvg, pngFileName, wrapTitle } from "./charts";
import { ballotCsv, markdownSummary, summaryCsv, voterIndexes, type ExportBundle } from "./table-export";

const bundle: ExportBundle = {
  players: [
    { id: "ada", name: "Ada", role: "voter", removed: false },
    { id: "bea", name: "Bea", role: "voter", removed: false },
  ],
  pitches: [{ id: "p", title: 'Say "hi",\nplease', presenterName: "Ada" }],
  scores: [
    { playerId: "ada", pitchId: "p", category: "compellingness", value: 4 },
    { playerId: "ada", pitchId: "p", category: "funniness", value: 3 },
    { playerId: "ada", pitchId: "p", category: "hotness", value: 8 },
  ],
  chips: [{ playerId: "ada", pitchId: "p", chipId: "huge-market" }],
  ballots: [
    { playerId: "ada", order: ["p"], placed: ["p"], submitted: true },
    { playerId: "bea", order: ["p"], placed: [], submitted: false },
  ],
  results: {
    countedPlayerIds: ["ada"],
    voidedPlayerIds: ["bea"],
    pitches: [
      {
        pitchId: "p",
        borda: 1,
        bordaRank: 1,
        firstPlaceCount: 1,
        scoreTotal: 11,
        scoreRank: 1,
        disagreement: null,
        chipCounts: {},
        categories: {
          compellingness: { mean: 4, sd: 0, min: 4, max: 4, p25: 4, p75: 4 },
          funniness: { mean: 3, sd: 0, min: 3, max: 3, p25: 3, p75: 3 },
          hotness: { mean: 8, sd: 0, min: 8, max: 8, p25: 8, p75: 8 },
        },
      },
    ],
  },
};

describe("table export", () => {
  it("quotes commas, quotes, and newlines in titles", () => {
    const csv = ballotCsv(bundle, () => 0, false);
    expect(csv).toContain('"Say ""hi"",\nplease"');
    expect(csv.split("\n")[0]).toBe("voterIndex,pitch,C,F,H,chips,rankPosition,counted");
    expect(csv).not.toContain("Ada");
    const named = ballotCsv(bundle, () => 0, true);
    expect(named.split("\n")[0]).toContain("voterName");
    expect(named).toContain("Ada");
  });

  it("assigns a new voter index when the random source changes", () => {
    const first = voterIndexes(["ada", "bea"], () => 0);
    const second = voterIndexes(["ada", "bea"], () => 0.99);
    expect(first.get("ada")).not.toBe(second.get("ada"));
  });

  it("puts Borda and the score total on the summary and in markdown", () => {
    const summary = summaryCsv(bundle);
    expect(summary).toContain("bordaRank");
    expect(summary).toContain('"Say ""hi"",\nplease"');
    expect(summary).toContain(",1,1,11,1,");
    const markdown = markdownSummary(bundle);
    expect(markdown).toContain("## Borda ranking");
    expect(markdown).toContain("11.0 / 15");
    expect(markdown).toContain("Huge market (1)");
  });
});

describe("chart cards", () => {
  it("builds a light leaderboard and a pitch card from one fixture", () => {
    const pitch = {
      pitchId: "p",
      title: "Uber for Dog Walkers, but the Dogs Pay in Tennis Balls and Also File Their Own Taxes",
      presenterName: "Ada",
      votes: { compellingness: [4, 2], funniness: [3, 5], hotness: [8, 6] },
      categories: bundle.results.pitches[0]!.categories,
      scoreTotal: 11,
    };
    const board = leaderboardSvg([pitch], "QQ==");
    const card = pitchCardSvg(pitch, "QQ==");
    expect(board).toContain("@font-face");
    expect(board).toContain("Hotness ÷ 2");
    expect(board).toContain('fill="#f7f4ee"');
    expect(board).toContain(">15<");
    expect(card).toContain('stroke="#ffffff"');
    expect(card).toContain("1–10");
    expect(card).toContain("11.0 / 15");
    expect(card).not.toContain("…");
    const wrapped = wrapTitle(pitch.title, 640, 32);
    expect(wrapped.lines.length).toBeGreaterThan(1);
    expect(wrapped.lines.join(" ")).toBe(pitch.title);
    expect(pngFileName(pitch.title)).toMatch(/^[a-z0-9-]+\.png$/);
  });
});
