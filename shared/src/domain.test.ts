// Checklist 2.1–2.5 fixtures. Expected numbers are derived in the comments beside each case.
import { describe, expect, it } from "vitest";
import {
  applyMove,
  applyNewPitch,
  applyPlace,
  applyRemovePitch,
  ballotComplete,
  eligiblePitches,
  missingItems,
} from "./ballot";
import { borda, rankPitches } from "./borda";
import { CATEGORIES, CHIP_GROUPS, CODE_ALPHABET, MAX_SCORE_TOTAL, NAME_MAX, TITLE_MAX } from "./config";
import { computeResults } from "./results";
import { competitionRank, max, mean, min, percentile, popSD, scoreTotal } from "./stats";
import type { Pitch, Player, Score, SessionSnapshot } from "./types";

describe("config", () => {
  it("caps the weighted score total at 15", () => {
    // 5×1 + 5×1 + 10×0.5 = 15
    expect(MAX_SCORE_TOTAL).toBe(15);
    expect(CATEGORIES.map((category) => [category.id, category.min, category.max, category.weight])).toEqual([
      ["compellingness", 1, 5, 1],
      ["funniness", 1, 5, 1],
      ["hotness", 1, 10, 0.5],
    ]);
    expect(NAME_MAX).toBe(24);
    expect(TITLE_MAX).toBe(80);
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_ALPHABET.split("")).not.toEqual(expect.arrayContaining(["0", "O", "1", "I", "L"]));
  });

  it("gives each chip group 5–8 chips with unique ids", () => {
    const seen = new Set<string>();
    for (const group of Object.values(CHIP_GROUPS)) {
      expect(group.length).toBeGreaterThanOrEqual(5);
      expect(group.length).toBeLessThanOrEqual(8);
      for (const chip of group) {
        expect(seen.has(chip.id)).toBe(false);
        seen.add(chip.id);
      }
    }
  });
});

describe("stats", () => {
  it("matches hand-computed samples", () => {
    // n=5: 1,2,3,4,5. mean 15/5=3.
    // population variance (4+1+0+1+4)/5 = 2, so SD = √2.
    // percentile index = (5−1)×p. 25th → index 1 → 2. 75th → index 3 → 4.
    const five = [5, 1, 4, 2, 3];
    expect(mean(five)).toBe(3);
    expect(popSD(five)).toBeCloseTo(Math.sqrt(2));
    expect(min(five)).toBe(1);
    expect(max(five)).toBe(5);
    expect(percentile(five, 25)).toBe(2);
    expect(percentile(five, 75)).toBe(4);

    // n=2: 1 and 3. mean 2. variance (1+1)/2 = 1, SD 1.
    // 25th index 0.25 → 1 + 0.25×2 = 1.5. 75th index 0.75 → 2.5.
    expect(mean([1, 3])).toBe(2);
    expect(popSD([1, 3])).toBe(1);
    expect(percentile([1, 3], 25)).toBe(1.5);
    expect(percentile([1, 3], 75)).toBe(2.5);

    // score total = 4 + 2 + 8/2 = 10. A missing category yields null.
    expect(scoreTotal(4, 2, 8)).toBe(10);
    expect(scoreTotal(4, null, 8)).toBeNull();

    // Ties share the first rank and the next rank skips: 10, 8, 8, 1 → 1, 2, 2, 4.
    expect(competitionRank([10, 8, 8, 1])).toEqual([1, 2, 2, 4]);
  });

  it("returns null for an empty sample and never NaN", () => {
    expect(mean([])).toBeNull();
    expect(popSD([])).toBeNull();
    expect(min([])).toBeNull();
    expect(max([])).toBeNull();
    expect(percentile([], 50)).toBeNull();
    for (const value of [mean([]), popSD([]), min([]), max([]), percentile([], 25)]) {
      expect(value).not.toBeNaN();
    }
  });

  it("treats a single vote as SD 0 with Q1 = Q3 = the value", () => {
    expect(popSD([7])).toBe(0);
    expect(percentile([7], 25)).toBe(7);
    expect(percentile([7], 75)).toBe(7);
  });
});

describe("borda", () => {
  it("matches the 5-voter example", () => {
    // n=3, points (3−pos)/2. Two A>B>C, two C>B>A, one B>A>C.
    // A points 1+1+0+0+0.5 = 2.5, mean 0.50.
    // B points 0.5+0.5+0.5+0.5+1 = 3, mean 0.60.
    // C points 0+0+1+1+0 = 2, mean 0.40.
    const ballots = [
      ["A", "B", "C"],
      ["A", "B", "C"],
      ["C", "B", "A"],
      ["C", "B", "A"],
      ["B", "A", "C"],
    ];
    expect(borda("B", ballots)).toBeCloseTo(0.6);
    expect(borda("A", ballots)).toBeCloseTo(0.5);
    expect(borda("C", ballots)).toBeCloseTo(0.4);
    expect(rankPitches([
      { pitchId: "A", borda: borda("A", ballots), firstPlaceCount: 2, scoreTotal: 1 },
      { pitchId: "B", borda: borda("B", ballots), firstPlaceCount: 1, scoreTotal: 1 },
      { pitchId: "C", borda: borda("C", ballots), firstPlaceCount: 2, scoreTotal: 1 },
    ]).map((row) => row.pitchId)).toEqual(["B", "A", "C"]);
  });

  it("breaks ties by 1st-place count, then score total, else shares the rank", () => {
    // Seven ballots of length 3. Points: A 3/7, B 3/7, C 4.5/7.
    // Firsts: A 3, B 1, C 3. Same Borda, so A ranks ahead of B on firsts.
    const byFirsts = [
      ["A", "C", "B"],
      ["A", "C", "B"],
      ["A", "B", "C"],
      ["B", "C", "A"],
      ["C", "B", "A"],
      ["C", "B", "A"],
      ["C", "B", "A"],
    ];
    const firstRows = ["A", "B", "C"].map((id) => ({
      pitchId: id,
      borda: borda(id, byFirsts),
      firstPlaceCount: byFirsts.filter((ballot) => ballot[0] === id).length,
      scoreTotal: 0,
    }));
    expect(firstRows.find((row) => row.pitchId === "A")!.borda).toBeCloseTo(3 / 7);
    expect(firstRows.find((row) => row.pitchId === "B")!.borda).toBeCloseTo(3 / 7);
    expect(rankPitches(firstRows).map((row) => [row.pitchId, row.rank])).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 3],
    ]);

    // A>C>B and B>C>A. Every Borda is 0.5. Firsts: A 1, B 1, C 0.
    // Score totals 9, 4, 12 put A ahead of B; C stays third because it has fewer firsts.
    const mirror = [
      ["A", "C", "B"],
      ["B", "C", "A"],
    ];
    const byScore = rankPitches(
      [
        ["A", 1, 9],
        ["B", 1, 4],
        ["C", 0, 12],
      ].map(([pitchId, firstPlaceCount, score]) => ({
        pitchId: pitchId as string,
        borda: borda(pitchId as string, mirror),
        firstPlaceCount: firstPlaceCount as number,
        scoreTotal: score as number,
      })),
    );
    expect(byScore.map((row) => [row.pitchId, row.rank])).toEqual([
      ["A", 1],
      ["B", 2],
      ["C", 3],
    ]);

    // Same Borda, same firsts, same score total → shared rank, next rank skips.
    const shared = rankPitches([
      { pitchId: "A", borda: 0.5, firstPlaceCount: 1, scoreTotal: 9 },
      { pitchId: "B", borda: 0.5, firstPlaceCount: 1, scoreTotal: 9 },
      { pitchId: "C", borda: 0.5, firstPlaceCount: 0, scoreTotal: 12 },
    ]);
    expect(shared.map((row) => [row.pitchId, row.rank])).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 3],
    ]);
  });

  it("averages only the ballots that contain a pitch", () => {
    // Presenter ballot B>C (n=2): B=1, C=0. Full ballot A>B>C: A=1, B=0.5, C=0.
    // Length-1 ballot contributes nothing.
    // A = 1/1 = 1. B = (1+0.5)/2 = 0.75. C = (0+0)/2 = 0.
    const ballots = [
      ["B", "C"],
      ["A", "B", "C"],
      ["A"],
    ];
    expect(borda("A", ballots)).toBe(1);
    expect(borda("B", ballots)).toBeCloseTo(0.75);
    expect(borda("C", ballots)).toBe(0);
    expect(borda("A", [["A"]])).toBe(0);
    expect(borda("Z", ballots)).toBe(0);
  });
});

describe("ballot rules", () => {
  const pitches: Pitch[] = [
    { id: "A", title: "A", presenterId: "p1", status: "done" },
    { id: "B", title: "B", presenterId: null, status: "done" },
    { id: "C", title: "C", presenterId: null, status: "done" },
  ];

  it("covers each transform, including a clamped index and a replay", () => {
    expect(eligiblePitches("p1", pitches).map((pitch) => pitch.id)).toEqual(["B", "C"]);
    const start = { order: ["B"], placed: [] as string[] };
    const appended = applyNewPitch(start, "C");
    expect(appended).toEqual({ order: ["B", "C"], placed: [] });
    expect(applyNewPitch(appended, "C")).toEqual(appended);

    const moved = applyMove(appended, "C", -4);
    expect(moved).toEqual({ order: ["C", "B"], placed: ["C"] });
    const movedAgain = applyMove(moved, "C", 99);
    expect(movedAgain.order).toEqual(["B", "C"]);
    expect(movedAgain.placed).toEqual(["C"]);
    expect(applyMove(movedAgain, "C", 1)).toEqual(movedAgain);

    const placed = applyPlace({ order: ["B", "C"], placed: [] }, "B");
    expect(placed).toEqual({ order: ["B", "C"], placed: ["B"] });
    expect(applyPlace(placed, "B")).toEqual(placed);

    expect(applyRemovePitch(movedAgain, "C")).toEqual({ order: ["B"], placed: [] });
    expect(applyRemovePitch({ order: ["B"], placed: [] }, "C")).toEqual({ order: ["B"], placed: [] });
    expect(applyMove(start, "missing", 0)).toEqual(start);
  });

  it("lists unscored categories and unplaced new pitches, then marks a finished ballot complete", () => {
    const ballot = { order: ["B", "C"], placed: ["B"] };
    const scores: Score[] = [
      { playerId: "p1", pitchId: "B", category: "compellingness", value: 3 },
      { playerId: "p1", pitchId: "B", category: "funniness", value: 3 },
    ];
    const missing = missingItems({
      playerId: "p1",
      pitches,
      scores,
      ballot,
      newPitchIds: ["C"],
    });
    expect(missing).toEqual([
      { kind: "score", pitchId: "B", category: "hotness" },
      { kind: "score", pitchId: "C", category: "compellingness" },
      { kind: "score", pitchId: "C", category: "funniness" },
      { kind: "score", pitchId: "C", category: "hotness" },
      { kind: "unplaced", pitchId: "C" },
    ]);
    expect(ballotComplete({ playerId: "p1", pitches, scores, ballot, newPitchIds: ["C"] })).toBe(false);

    const doneScores: Score[] = ["B", "C"].flatMap((pitchId) =>
      CATEGORIES.map((category) => ({
        playerId: "p1",
        pitchId,
        category: category.id,
        value: 3,
      })),
    );
    const done = { order: ["C", "B"], placed: ["C"] };
    expect(
      ballotComplete({ playerId: "p1", pitches, scores: doneScores, ballot: done, newPitchIds: ["C"] }),
    ).toBe(true);
  });
});

describe("results", () => {
  it("matches a hand-derived session and ignores the voided voter", () => {
    // Counted: v1–v4 and presenter pr. Voided: v5 (unsubmitted).
    // Full ballots n=4, points (4−pos)/3. Presenter ballot A>B>C, points (3−pos)/2.
    // A points 1+1+2/3+1/3+1 = 4, mean 0.8, firsts 3.
    // B points 2/3+2/3+1+2/3+1/2 = 3.5, mean 0.7, firsts 1.
    // C points 1/3+1/3+1/3+1+0 = 2, mean 0.4, firsts 1.
    // D is last on every full ballot and absent from pr, so Borda 0 over 4 ballots.
    // Scores: A and D are 5/5/10 → total 15 (D from v1–v4 only). B 4/4/8 → 12. C 3/3/6 → 9.
    // Score ranks: A and D share 1, B is 3, C is 4.
    // |Borda − score| ≥ 2 only for D (4 vs 1), direction scores.
    const players: Player[] = ["v1", "v2", "v3", "v4", "pr", "v5"].map((id) => ({
      id,
      name: id,
      role: "voter",
      removed: false,
    }));
    const pitches: Pitch[] = ["A", "B", "C", "D"].map((id) => ({
      id,
      title: id,
      presenterId: id === "D" ? "pr" : null,
      status: "done",
    }));
    const orders: Record<string, string[]> = {
      v1: ["A", "B", "C", "D"],
      v2: ["A", "B", "C", "D"],
      v3: ["B", "A", "C", "D"],
      v4: ["C", "B", "A", "D"],
      pr: ["A", "B", "C"],
      v5: ["D", "C", "B", "A"],
    };
    const scoreFor = (pitchId: string): [number, number, number] => {
      if (pitchId === "A" || pitchId === "D") return [5, 5, 10];
      if (pitchId === "B") return [4, 4, 8];
      return [3, 3, 6];
    };
    const scores: Score[] = [];
    for (const player of players) {
      for (const pitch of pitches) {
        if (player.id === "pr" && pitch.id === "D") continue;
        const values = player.id === "v5" ? [1, 1, 2] : scoreFor(pitch.id);
        (["compellingness", "funniness", "hotness"] as const).forEach((category, index) => {
          scores.push({ playerId: player.id, pitchId: pitch.id, category, value: values[index]! });
        });
      }
    }
    const snapshot: SessionSnapshot = {
      players,
      pitches,
      ballots: players.map((player) => ({
        playerId: player.id,
        order: orders[player.id]!,
        placed: [],
        submitted: player.id !== "v5",
      })),
      scores,
    };

    const results = computeResults(snapshot);
    expect(results.countedPlayerIds).toEqual(["v1", "v2", "v3", "v4", "pr"]);
    expect(results.voidedPlayerIds).toEqual(["v5"]);
    const byId = Object.fromEntries(results.pitches.map((pitch) => [pitch.pitchId, pitch]));
    expect(byId.A!.borda).toBeCloseTo(0.8);
    expect(byId.B!.borda).toBeCloseTo(0.7);
    expect(byId.C!.borda).toBeCloseTo(0.4);
    expect(byId.D!.borda).toBe(0);
    expect(results.pitches.map((pitch) => [pitch.pitchId, pitch.bordaRank, pitch.scoreRank])).toEqual([
      ["A", 1, 1],
      ["B", 2, 3],
      ["C", 3, 4],
      ["D", 4, 1],
    ]);
    expect(byId.A!.categories.compellingness).toMatchObject({ mean: 5, sd: 0, min: 5, max: 5, p25: 5, p75: 5 });
    expect(byId.D!.scoreTotal).toBe(15);
    expect(byId.D!.disagreement).toEqual({ direction: "scores", bordaRank: 4, scoreRank: 1 });
    expect(byId.A!.disagreement).toBeNull();
    expect(computeResults(snapshot)).toEqual(results);
  });
});
