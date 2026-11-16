// Privacy property for checklist 4.5: a view never contains another player's notes.
import { describe, expect, it } from "vitest";
import type { Phase } from "@we-rankin/shared";
import { buildView, viewLeaks, type ViewState } from "./view";

describe("view privacy", () => {
  it("keeps scores, chips, and ballots private across random sessions", () => {
    for (let round = 0; round < 25; round += 1) {
      const phase: Phase = round % 5 === 0 ? "closed" : "voting";
      const state: ViewState = {
        phase,
        rosterLocked: true,
        players: [0, 1, 2, 3].map((index) => ({
          id: `p${index}`,
          name: `P${index}`,
          role: index === 3 ? "spectator" : "voter",
          removed: false,
          connected: index % 2 === 0,
          submitted: index === 0,
        })),
        pitches: [0, 1].map((index) => ({
          id: `pitch${index}`,
          title: `Pitch ${index}`,
          presenterName: `P${index}`,
          presenterId: `p${index}`,
          status: "done",
          position: index + 1,
        })),
        scores: [0, 1, 2].flatMap((player) =>
          [0, 1].map((pitch) => ({
            playerId: `p${player}`,
            pitchId: `pitch${pitch}`,
            category: "funniness" as const,
            value: ((round + player + pitch) % 5) + 1,
          })),
        ),
        chips: [{ playerId: "p0", pitchId: "pitch1", chipId: "huge-market" }, { playerId: "p1", pitchId: "pitch0", chipId: "lawsuit-magnet" }],
        ballots: [0, 1, 2].map((player) => ({
          playerId: `p${player}`,
          order: ["pitch0", "pitch1"],
          placed: ["pitch0"],
          submitted: player === 0,
        })),
        newPitchIds: ["pitch1"],
        results: phase === "closed" ? { countedPlayerIds: ["p0"], voidedPlayerIds: ["p1"], pitches: [] } : null,
      };
      expect(viewLeaks(state)).toEqual([]);
      const spectator = buildView(state, { playerId: "p3", isHost: false });
      expect(spectator.scores).toBeUndefined();
      expect(spectator.ballot).toBeUndefined();
      expect(spectator.chips).toBeUndefined();
      if (phase !== "closed") expect(buildView(state, { playerId: "p0", isHost: false }).results).toBeUndefined();
    }
  });
});
