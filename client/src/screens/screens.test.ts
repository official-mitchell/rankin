// Landing, roster, host console, and results checks for checklist 6, 7, and 10.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readPlayerId, writePlayerId } from "./identity";
import { Landing, createFailure } from "./Landing";
import { sessionLinks, sessionTarget } from "./links";
import { exportShapeErrors } from "./export-shape";
import { HostConsole, pitchTitleError, unsubmittedNames } from "./HostConsole";
import { applyMove } from "@we-rankin/shared";
import { missingItems } from "@we-rankin/shared";
import { Notes, progressCount, toggleChip } from "./Notes";
import { RankList } from "./Rank";
import { ResultsBoard, flagLabel, scoreOrder } from "./Results";
import { Roster } from "./Roster";

describe("session screens", () => {
  it("shows an inline error for a rejected create key", () => {
    expect(createFailure(401)).toBe("That create key was not accepted. Only the game master has this key.");
    const markup = renderToStaticMarkup(
      createElement(Landing, {
        intro: "closed",
        joining: true,
        initialError: "Paste the game link, or the session code from that link.",
      }),
    );
    expect(markup).toContain("Paste the game link, or the session code from that link.");
    expect(markup).toContain("Become the Game Master");
    const firstVisit = renderToStaticMarkup(createElement(Landing, { intro: "open" }));
    expect(firstVisit).toContain("A game master starts the session.");
    expect(firstVisit).not.toContain("create-key");
    const ready = renderToStaticMarkup(createElement(Landing, { intro: "closed" }));
    expect(ready).toContain("Become the Game Master");
    expect(ready).toContain("Join a game");
    expect(ready).not.toContain("panel--metal");
    expect(ready).not.toContain("id=\"create-key\"");
    expect(sessionTarget("https://we-rankin.test/s/AbCdEf#h=secret")).toBe("/s/ABCDEF#h=secret");
    expect(sessionTarget("ABCDEF")).toBe("/s/ABCDEF");
    expect(sessionTarget("not a link")).toBeNull();
  });

  it("puts the exact player and host links on the copy buttons", () => {
    const links = sessionLinks("https://we-rankin.test", "ABCDEF", "secret");
    expect(links).toEqual({
      player: "https://we-rankin.test/s/ABCDEF",
      host: "https://we-rankin.test/s/ABCDEF#h=secret",
    });
    const markup = renderToStaticMarkup(createElement(Landing, { initialCreated: { code: "ABCDEF", ...links } }));
    expect(markup).toContain(`data-copy="${links.player}"`);
    expect(markup).toContain(`data-copy="${links.host}"`);
    expect(markup).toContain("Save the host link");
  });

  it("restores a player id from storage and falls back to the cookie", () => {
    const storage = new Map<string, string>();
    const jar = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) };
    expect(readPlayerId("ABCDEF", jar, "")).toBeNull();
    const cookie = writePlayerId("ABCDEF", "player-1", jar);
    expect(readPlayerId("ABCDEF", jar, "")).toBe("player-1");
    storage.clear();
    expect(readPlayerId("ABCDEF", jar, cookie)).toBe("player-1");
  });

  it("hides host buttons from players", () => {
    const players = [{ id: "a", name: "Ada", role: "voter" as const, connected: true, host: true }];
    const player = renderToStaticMarkup(createElement(Roster, { players, pitches: [], isHost: false, spectator: false, phase: "lobby" }));
    expect(player).not.toContain("Promote");
    expect(player).not.toContain("Start pitching");
    const host = renderToStaticMarkup(
      createElement(Roster, {
        players: [...players, { id: "b", name: "Bea", role: "spectator" as const, connected: false }],
        pitches: [],
        isHost: true,
        spectator: false,
        phase: "lobby",
      }),
    );
    expect(host).toContain("Promote");
    expect(host).not.toContain("Start pitching");
  });

  it("blocks an empty or overlong pitch title and keeps phase writes behind confirm", () => {
    expect(pitchTitleError("  ")).toBe("Enter a title.");
    expect(pitchTitleError("x".repeat(81))).toMatch(/80/);
    expect(pitchTitleError("Cat Slack")).toBeNull();
    const players = [
      { id: "a", name: "Ada", role: "voter" as const, connected: true, submitted: true },
      { id: "b", name: "Bea", role: "voter" as const, connected: true, submitted: false },
    ];
    expect(unsubmittedNames(players)).toEqual(["Bea"]);
    const idle = renderToStaticMarkup(
      createElement(HostConsole, {
        code: "ABCDEF",
        phase: "pitching",
        players,
        pitches: [{ id: "p", title: "Cat Slack", presenterName: "Ada", presenterId: "a", status: "upcoming" }],
        counters: { writes_failed: 1, reconnects: 2, connected: 2 },
        hostLink: "https://we-rankin.test/s/ABCDEF#h=secret",
      }),
    );
    expect(idle).not.toContain("data-commit");
    expect(idle).toContain("Open voting");
    const dialog = renderToStaticMarkup(
      createElement(HostConsole, {
        code: "ABCDEF",
        phase: "voting",
        players,
        pitches: [],
        counters: { writes_failed: 1, reconnects: 2, connected: 2 },
        hostLink: "",
        initialConfirm: "phase",
        debugOpen: true,
      }),
    );
    expect(dialog).toContain("data-commit=\"phase\"");
    expect(dialog).toContain("Voids: Bea");
    expect(dialog).toContain("writes_failed");
    expect(dialog).toContain("Download raw JSON");
    expect(dialog).toContain("disabled");
  });

  it("accepts an export that matches the documented tables", () => {
    expect(exportShapeErrors({ meta: [{ host_secret_hash: "abc" }], players: [], pitches: [], scores: [], chips: [], ballots: [], results: [], metrics: {} })).toEqual([]);
    expect(exportShapeErrors({ meta: [] }).length).toBeGreaterThan(0);
  });

  it("scores from an empty pad and toggles a chip on and off", () => {
    const pitches = [
      { id: "p", title: "Cat Slack", presenterName: "Bea", presenterId: "bea", status: "presenting" as const },
      { id: "mine", title: "Mine", presenterName: "Ada", presenterId: "ada", status: "done" as const },
      { id: "next", title: "Later", presenterName: "Cam", presenterId: "cam", status: "upcoming" as const },
    ];
    const empty = renderToStaticMarkup(createElement(Notes, { phase: "pitching", selfId: "ada", pitches, scores: [], chips: [] }));
    expect(empty).toContain("Your pitch — no scoring");
    expect(empty).toContain("Submit scores");
    expect(empty).not.toContain("Unlocks when presenting");
    expect(empty).not.toContain('aria-pressed="true"');
    const filled = renderToStaticMarkup(
      createElement(Notes, {
        phase: "pitching",
        selfId: "ada",
        pitches,
        scores: [
          { pitchId: "p", category: "compellingness", value: 2 },
          { pitchId: "p", category: "funniness", value: 2 },
          { pitchId: "p", category: "hotness", value: 2 },
        ],
        chips: [{ pitchId: "p", chipIds: ["huge-market"] }],
        saved: true,
      }),
    );
    expect(filled).toContain("1 of 2 pitches scored");
    expect(filled).toContain('aria-pressed="true"');
    expect(progressCount(pitches, [], "pitching", "ada")).toEqual({ done: 0, total: 2 });
    expect(toggleChip(["huge-market"], "huge-market")).toEqual([]);
    expect(toggleChip([], "huge-market")).toEqual(["huge-market"]);
  });

  it("reorders with applyMove and lists the same gaps the server would", () => {
    const moved = applyMove({ order: ["a", "b"], placed: ["a"] }, "b", 0);
    expect(moved).toEqual({ order: ["b", "a"], placed: ["a", "b"] });
    const pitches = [
      { id: "a", title: "Cat", presenterName: "Bea", presenterId: null, status: "done" as const },
      { id: "b", title: "Park", presenterName: "Cam", presenterId: null, status: "done" as const },
    ];
    const input = {
      playerId: "ada",
      pitches,
      scores: [] as [],
      ballot: { order: ["a", "b"], placed: ["a"] },
      newPitchIds: ["b"],
    };
    expect(missingItems(input).some((item) => item.kind === "unplaced" && item.pitchId === "b")).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(RankList, {
        order: ["a", "b"],
        placed: ["a"],
        pitches: pitches.map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenterName })),
        scores: [],
        chips: [],
        missing: missingItems(input),
        submitted: false,
      }),
    );
    expect(markup).toContain("NEW");
    expect(markup).toContain("Place Park");
    expect(markup).toContain("disabled");
  });

  it("renders Borda order and disagreement flags from fixture results", () => {
    const pitches = [
      { id: "a", title: "Uber for Dog Walkers, but the Dogs Pay in Tennis Balls" },
      { id: "b", title: "Slack for Cats" },
    ];
    const rows = [
      {
        pitchId: "b",
        borda: 0.4,
        bordaRank: 2,
        firstPlaceCount: 0,
        categories: emptyStats(4),
        scoreTotal: 8,
        scoreRank: 1,
        disagreement: { direction: "scores" as const, bordaRank: 2, scoreRank: 1 },
      },
      {
        pitchId: "a",
        borda: 0.82,
        bordaRank: 1,
        firstPlaceCount: 1,
        categories: emptyStats(3),
        scoreTotal: 6,
        scoreRank: 2,
        disagreement: { direction: "crowd" as const, bordaRank: 1, scoreRank: 2 },
      },
    ];
    expect(scoreOrder(rows).map((row) => row.pitchId)).toEqual(["b", "a"]);
    expect(flagLabel(rows[0])).toBe("▼ Crowd #2 · Scores #1");
    const markup = renderToStaticMarkup(
      createElement(ResultsBoard, {
        results: { countedPlayerIds: ["ada"], voidedPlayerIds: ["cam"], pitches: rows },
        pitches,
        players: [
          { id: "ada", name: "Ada" },
          { id: "cam", name: "Cam" },
        ],
      }),
    );
    expect(markup.indexOf('data-rank="1"')).toBeLessThan(markup.indexOf('data-rank="2"'));
    expect(markup).toContain("▲ Crowd #1 · Scores #2");
    expect(markup).toContain("Cam");
    expect(markup).toContain("Hotness ÷ 2");
    expect(markup).not.toContain("text-overflow");
  });

  it("disables score controls when the session is closed", () => {
    const markup = renderToStaticMarkup(
      createElement(Notes, {
        phase: "closed",
        selfId: "ada",
        pitches: [{ id: "p", title: "Cat Slack", presenterName: "Bea", presenterId: "bea", status: "done" }],
        scores: [],
        chips: [],
      }),
    );
    expect(markup).toContain("disabled");
  });
});

function emptyStats(mean: number) {
  const stats = { mean, sd: 0, min: 1, max: 5, p25: 1, p75: 5 };
  return { compellingness: stats, funniness: stats, hotness: stats };
}
