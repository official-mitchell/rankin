// Landing, identity, copy links, and roster visibility for checklist 6.1–6.3.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readPlayerId, writePlayerId } from "./identity";
import { Landing, createFailure } from "./Landing";
import { sessionLinks } from "./links";
import { Roster } from "./Roster";

describe("session screens", () => {
  it("shows an inline error for a rejected create key", () => {
    expect(createFailure(401)).toBe("That create key was not accepted.");
    const markup = renderToStaticMarkup(
      createElement(Landing, { initialError: "That create key was not accepted.", createSession: async () => new Response(null, { status: 401 }) }),
    );
    expect(markup).toContain("That create key was not accepted.");
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
    expect(host).toContain("Start pitching");
  });
});
