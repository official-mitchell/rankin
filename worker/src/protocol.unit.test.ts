// Accept and reject table for checklist 4.4.
import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./protocol";

describe("client messages", () => {
  it("accepts the write commands and rejects malformed ones", () => {
    const accepted = [
      { type: "hello" },
      { type: "hello", playerId: "p1", hostSecret: "secret" },
      { type: "join", name: "Ada", clientSeq: 1 },
      { type: "reclaim", name: "Ada", clientSeq: 2 },
      { type: "setScore", pitchId: "p", category: "hotness", value: 10, clientSeq: 3 },
      { type: "setChips", pitchId: "p", chipIds: ["huge-market"], clientSeq: 4 },
      { type: "movePitch", pitchId: "p", toIndex: 0, clientSeq: 5 },
      { type: "placePitch", pitchId: "p", clientSeq: 6 },
      { type: "submitBallot", clientSeq: 7 },
      { type: "host.addPitch", title: "A", presenterName: "Ada", presenterPlayerId: null, clientSeq: 8 },
      { type: "host.updatePitch", pitchId: "p", title: "B", clientSeq: 9 },
      { type: "host.removePitch", pitchId: "p", clientSeq: 10 },
      { type: "host.setStatus", pitchId: "p", status: "presenting", clientSeq: 11 },
      { type: "host.startPitching", clientSeq: 12 },
      { type: "host.openVoting", clientSeq: 13 },
      { type: "host.closeVoting", clientSeq: 14 },
      { type: "host.promote", name: "Ada", clientSeq: 15 },
      { type: "host.removePlayer", name: "Ada", clientSeq: 16 },
      { type: "host.releaseName", name: "Ada", clientSeq: 17 },
      { type: "client.error", message: "boom", stack: "Error: boom" },
    ];
    for (const message of accepted) {
      expect(parseClientMessage(JSON.stringify(message)).ok, message.type).toBe(true);
    }

    const rejected = [
      "",
      "{",
      JSON.stringify({ type: "nope" }),
      JSON.stringify({ type: "join", name: "", clientSeq: 1 }),
      JSON.stringify({ type: "setScore", pitchId: "p", category: "taste", value: 1, clientSeq: 1 }),
      JSON.stringify({ type: "host.addPitch", title: "", presenterName: "Ada", presenterPlayerId: null, clientSeq: 1 }),
      "x".repeat(9000),
    ];
    for (const message of rejected) {
      const parsed = parseClientMessage(message);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.code).toBe("bad_message");
    }
  });
});
