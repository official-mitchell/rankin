// Connection, store, queue, and banner checks for checklist 5.1–5.4.
import { ALERT_A1, ALERT_A2 } from "@we-rankin/shared";
import type { ClientView } from "@we-rankin/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertBanner } from "./AlertBanner";
import { backoffDelay, ConnectionManager, type ConnectionClock } from "./connection";
import { ack, enqueue, rejectWrite, wireMessage } from "./queue";
import { connectionLabel, isSpectator, me, myEligiblePitches, myMissing, waitingOn } from "./store";

class FakeSocket extends EventTarget {
  readyState = 0;
  sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const timers: Array<() => void> = [];
  const delays: number[] = [];
  let hidden = false;
  let online = true;
  const events = new EventTarget();
  const visibility = new EventTarget();
  const clock: ConnectionClock = {
    schedule: (fn, ms) => {
      delays.push(ms);
      timers.push(fn);
      return timers.length;
    },
    cancel: () => undefined,
    listen: (target, type, fn) => target.addEventListener(type, fn),
    unlisten: (target, type, fn) => target.removeEventListener(type, fn),
    hidden: () => hidden,
    online: () => online,
  };
  const statuses: string[] = [];
  const manager = new ConnectionManager({
    code: "ABCDEF",
    playerId: "player-1",
    hostSecret: "secret",
    socket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    onView: () => undefined,
    onAck: () => undefined,
    onCommandError: () => undefined,
    onAlert: () => undefined,
    onStatus: (status) => statuses.push(status),
    random: () => 0,
    clock,
    events,
    visibilityTarget: visibility,
  });
  return {
    sockets,
    timers,
    delays,
    statuses,
    events,
    visibility,
    manager,
    setHidden: (value: boolean) => {
      hidden = value;
    },
    setOnline: (value: boolean) => {
      online = value;
    },
  };
}

const view: ClientView = {
  phase: "voting",
  rosterLocked: true,
  self: { playerId: "p1", role: "voter", isHost: false },
  players: [
    { id: "p1", name: "Ada", role: "voter", connected: true, submitted: false },
    { id: "p2", name: "Bea", role: "voter", connected: true, submitted: true },
    { id: "p3", name: "Cam", role: "spectator", connected: true, submitted: false },
  ],
  pitches: [
    { id: "own", title: "Own", presenterName: "Ada", presenterId: "p1", status: "done", position: 1 },
    { id: "other", title: "Other", presenterName: "Bea", presenterId: "p2", status: "done", position: 2 },
  ],
  scores: [],
  ballot: { playerId: "p1", order: ["other"], placed: [], submitted: false },
};

describe("connection manager", () => {
  it("backs off from 0.5s to 8s and reconnects when the page becomes visible", () => {
    expect(backoffDelay(0, () => 0)).toBe(500);
    expect(backoffDelay(4, () => 0)).toBe(8000);
    expect(backoffDelay(0, () => 1)).toBe(625);
    const rig = harness();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    rig.manager.start();
    rig.sockets[0]?.open();
    expect(JSON.parse(rig.sockets[0]?.sent[0] ?? "{}")).toEqual({ type: "hello", playerId: "player-1", hostSecret: "secret" });
    for (const expected of [500, 1000, 2000, 4000, 8000]) {
      rig.sockets.at(-1)?.close();
      expect(rig.delays.at(-1)).toBe(expected);
      rig.timers.at(-1)?.();
    }
    rig.sockets.at(-1)?.close();
    expect(rig.delays.at(-1)).toBe(8000);
    rig.setHidden(false);
    rig.visibility.dispatchEvent(new Event("visibilitychange"));
    expect(rig.sockets.length).toBeGreaterThan(6);
    expect(info).toHaveBeenCalled();
    info.mockRestore();
    rig.manager.stop();
  });

  it("sends client.error only while online", () => {
    const rig = harness();
    rig.manager.start();
    rig.events.dispatchEvent(Object.assign(new Event("error"), { message: "early" }));
    expect(rig.sockets[0]?.sent ?? []).toEqual([]);
    rig.sockets[0]?.open();
    rig.events.dispatchEvent(Object.assign(new Event("error"), { message: "boom" }));
    expect(JSON.parse(rig.sockets[0]?.sent.at(-1) ?? "{}")).toMatchObject({ type: "client.error", message: "boom" });
    rig.manager.stop();
  });
});

describe("store selectors", () => {
  it("reads me, eligible pitches, missing scores, waiting names, and the spectator flag", () => {
    const state = { view, status: "online" as const, pending: [], lastSeq: 0, alert: null, toast: null };
    expect(me(state)?.playerId).toBe("p1");
    expect(myEligiblePitches(state).map((pitch) => pitch.id)).toEqual(["other"]);
    expect(myMissing(state)).toEqual([
      { kind: "score", pitchId: "other", category: "compellingness" },
      { kind: "score", pitchId: "other", category: "funniness" },
      { kind: "score", pitchId: "other", category: "hotness" },
      { kind: "unplaced", pitchId: "other" },
    ]);
    expect(waitingOn(state)).toEqual(["Ada"]);
    expect(isSpectator(state)).toBe(false);
    expect(connectionLabel("online", 0)).toBe("Saved ✓");
    expect(connectionLabel("online", 2)).toBe("Saving…");
    expect(connectionLabel("offline", 2)).toBe("Offline — 2 pending");
    expect(connectionLabel("connecting", 0)).toBe("Reconnecting…");
  });
});

describe("write queue", () => {
  it("keeps order across a dropped socket and reverts a rejected seq", () => {
    const first = enqueue(view, [], { type: "setScore", pitchId: "other", category: "funniness", value: 3 }, 0);
    const second = enqueue(first.view, first.pending, { type: "setScore", pitchId: "other", category: "funniness", value: 4 }, first.lastSeq);
    expect(second.view?.scores?.[0]?.value).toBe(4);
    expect(second.pending.map(wireMessage)).toEqual([
      { type: "setScore", pitchId: "other", category: "funniness", value: 3, clientSeq: 1 },
      { type: "setScore", pitchId: "other", category: "funniness", value: 4, clientSeq: 2 },
    ]);
    const saved = ack(second.view, second.pending, 1);
    expect(saved.pending.map((item) => item.clientSeq)).toEqual([2]);
    const again = enqueue(saved.view, [], { type: "setScore", pitchId: "other", category: "funniness", value: 5 }, second.lastSeq);
    expect(again.pending[0]?.clientSeq).toBe(3);
    const failed = rejectWrite(saved.view, saved.pending, 2);
    expect(failed.view?.scores?.[0]?.value).toBe(3);
    expect(failed.toast).toBe("That change was not saved");
    expect(failed.pending).toEqual([]);
  });
});

describe("alert banner", () => {
  it("shows the host banner and hides it from players", () => {
    const host = renderToStaticMarkup(createElement(AlertBanner, { alert: ALERT_A1, isHost: true, onDownload: () => undefined }));
    expect(host).toContain("Download raw JSON");
    expect(host).toContain(ALERT_A1.message);
    const player = renderToStaticMarkup(createElement(AlertBanner, { alert: ALERT_A2, isHost: false, onDownload: () => undefined }));
    expect(player).toBe("");
  });
});
