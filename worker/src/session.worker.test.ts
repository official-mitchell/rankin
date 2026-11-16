// Durable Object coverage for checklist section 4, the raw export log (checklist 7.3), and closed table export (11.1).
import { env, SELF } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

type Json = Record<string, unknown>;

function track(ws: WebSocket) {
  const messages: Json[] = [];
  ws.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)) as Json);
  });
  return {
    messages,
    async waitFor(predicate: (message: Json) => boolean): Promise<Json> {
      const started = Date.now();
      while (Date.now() - started < 4000) {
        const found = messages.find(predicate);
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      throw new Error(`no matching message in ${JSON.stringify(messages)}`);
    },
  };
}

async function openSocket(code: string): Promise<{ ws: WebSocket; box: ReturnType<typeof track> }> {
  const response = await SELF.fetch(`https://we-rankin.test/api/s/${code}/ws`, { headers: { Upgrade: "websocket" } });
  const ws = response.webSocket;
  if (!ws) throw new Error("missing websocket");
  ws.accept();
  return { ws, box: track(ws) };
}

async function create(codes?: string[]): Promise<{ code: string; hostSecret: string }> {
  const response = await SELF.fetch("https://we-rankin.test/api/sessions", {
    method: "POST",
    body: JSON.stringify({ createKey: env.CREATE_KEY, codes }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function hello(code: string, hostSecret?: string, playerId?: string) {
  const opened = await openSocket(code);
  opened.ws.send(JSON.stringify({ type: "hello", hostSecret, playerId }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  return opened;
}

describe("Session durable object", () => {
  it("returns ok from a fresh stub", async () => {
    const stub = env.SESSION.get(env.SESSION.idFromName("ok"));
    const response = await stub.fetch("http://session/");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps metrics when a new stub is opened for the same id", async () => {
    const id = env.SESSION.idFromName("metrics");
    const first = env.SESSION.get(id);
    const write = await first.fetch("http://session/metrics", {
      method: "POST",
      body: JSON.stringify({ name: "writes_ok", n: 2 }),
    });
    expect(write.status).toBe(200);
    const second = env.SESSION.get(id);
    const read = await second.fetch("http://session/metrics");
    expect(await read.json()).toEqual({ writes_ok: 2 });
  });

  it("returns 404 for the dev fixture route", async () => {
    const response = await SELF.fetch("https://we-rankin.test/__fixtures/shell");
    expect(response.status).toBe(404);
  });

  it("migrates the checklist tables and enforces constraints", async () => {
    const id = env.SESSION.idFromName("SCHEMA");
    const stub = env.SESSION.get(id);
    const schema = (await (await stub.fetch("http://session/schema")).json()) as Array<{ name: string }>;
    const names = schema.map((row) => row.name);
    for (const table of ["meta", "players", "pitches", "scores", "chips", "ballots", "results", "metrics"]) {
      expect(names).toContain(table);
    }
    const probe = await (await stub.fetch("http://session/test/constraints", { method: "POST" })).json();
    expect(probe).toEqual({ duplicateName: true, scoreRange: true, upsert: 4 });
  });

  it("creates a session only with the right key and retries a forced collision", async () => {
    const wrong = await SELF.fetch("https://we-rankin.test/api/sessions", {
      method: "POST",
      body: JSON.stringify({ createKey: "nope-nope-nope" }),
    });
    expect(wrong.status).toBe(401);

    const minted = await create();
    expect(minted.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    const first = await create(["AAAAAA"]);
    const stub = env.SESSION.get(env.SESSION.idFromName(first.code));
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    const exported = await (await stub.fetch("http://session/export", { headers: { "x-host-secret": first.hostSecret } })).json();
    spy.mockRestore();
    const dumped = JSON.stringify(exported);
    expect(dumped).not.toContain(first.hostSecret);
    expect(Object.keys(exported as object).sort()).toEqual(["ballots", "chips", "meta", "metrics", "pitches", "players", "results", "scores"]);
    expect(logs.some((line) => line.includes("export.raw"))).toBe(true);

    const second = await create(["AAAAAA", "BBBBBB"]);
    expect(second.code).toBe("BBBBBB");
    const denied = await stub.fetch("http://session/export", { headers: { "x-host-secret": "wrong-secret" } });
    expect(denied.status).toBe(401);
    const early = await stub.fetch("http://session/export?format=ballots", { headers: { "x-host-secret": first.hostSecret } });
    expect(early.status).toBe(409);
  });

  it("rejects an unauthenticated write, a bad host secret, and restores the socket attachment", async () => {
    const created = await create(["ABCDEF"]);
    const guest = await hello(created.code);
    guest.ws.send(JSON.stringify({ type: "setScore", pitchId: "x", category: "funniness", value: 3, clientSeq: 1 }));
    const rejected = await guest.box.waitFor((message) => message.type === "error");
    expect(rejected.code).toBe("unauthorized");

    const bad = await openSocket(created.code);
    const closed = new Promise<number>((resolve) => bad.ws.addEventListener("close", (event) => resolve(event.code)));
    bad.ws.send(JSON.stringify({ type: "hello", hostSecret: "not-the-secret" }));
    expect(await closed).toBe(4003);

    const pending = await openSocket(created.code);
    const timedOut = new Promise<number>((resolve) => pending.ws.addEventListener("close", (event) => resolve(event.code)));
    const host = await hello(created.code, created.hostSecret);
    host.ws.send(JSON.stringify({ type: "join", name: "Host", clientSeq: 1 }));
    const view = await host.box.waitFor((message) => message.type === "view");
    const self = (view.view as { self: { playerId: string; isHost: boolean } }).self;
    expect(self.isHost).toBe(true);
    const stub = env.SESSION.get(env.SESSION.idFromName(created.code));
    const attachments = (await (await stub.fetch("http://session/test/attachments")).json()) as Array<{ playerId: string | null; isHost: boolean }>;
    expect(attachments).toContainEqual(expect.objectContaining({ playerId: self.playerId, isHost: true }));
    await stub.fetch("http://session/test/expire-hellos", { method: "POST" });
    expect(await timedOut).toBe(4001);
  });

  it("runs join, reclaim, promote, and remove rules", async () => {
    const created = await create(["DEFGHJ"]);
    const host = await hello(created.code, created.hostSecret);
    host.ws.send(JSON.stringify({ type: "join", name: "Ada", clientSeq: 1 }));
    await host.box.waitFor((message) => message.type === "ack" && message.clientSeq === 1);
    host.ws.send(JSON.stringify({ type: "join", name: "ada", clientSeq: 2 }));
    expect((await host.box.waitFor((message) => message.type === "error" && message.clientSeq === 2)).code).toBe("name_taken");

    host.ws.send(JSON.stringify({ type: "host.startPitching", clientSeq: 3 }));
    await host.box.waitFor((message) => message.type === "ack" && message.clientSeq === 3);
    const late = await hello(created.code);
    late.ws.send(JSON.stringify({ type: "join", name: "Bea", clientSeq: 1 }));
    const lateView = await late.box.waitFor((message) => message.type === "view" && JSON.stringify(message).includes("Bea"));
    const latePlayer = (lateView.view as { players: Array<{ name: string; role: string }> }).players.find((player) => player.name === "Bea");
    expect(latePlayer?.role).toBe("spectator");

    host.ws.send(JSON.stringify({ type: "host.promote", name: "Bea", clientSeq: 4 }));
    await host.box.waitFor((message) => message.type === "ack" && message.clientSeq === 4);

    const taken = await hello(created.code);
    taken.ws.send(JSON.stringify({ type: "reclaim", name: "Bea", clientSeq: 1 }));
    expect((await taken.box.waitFor((message) => message.type === "error")).code).toBe("name_in_use");
    host.ws.send(JSON.stringify({ type: "host.releaseName", name: "Bea", clientSeq: 5 }));
    const reclaimed = await hello(created.code);
    reclaimed.ws.send(JSON.stringify({ type: "reclaim", name: "Bea", clientSeq: 2 }));
    const reclaimedView = await reclaimed.box.waitFor(
      (message) => message.type === "view" && Boolean((message.view as { self?: { playerId?: string } }).self?.playerId),
    );
    expect((reclaimedView.view as { self: { playerId: string } }).self.playerId).toBeTruthy();

    host.ws.send(JSON.stringify({ type: "host.openVoting", clientSeq: 6 }));
    await host.box.waitFor((message) => message.type === "ack" && message.clientSeq === 6);
    host.ws.send(JSON.stringify({ type: "host.promote", name: "Bea", clientSeq: 7 }));
    expect((await host.box.waitFor((message) => message.clientSeq === 7)).code).toBe("bad_transition");
    host.ws.send(JSON.stringify({ type: "host.removePlayer", name: "Bea", clientSeq: 8 }));
    await host.box.waitFor((message) => message.type === "ack" && message.clientSeq === 8);
  });

  it("rejects illegal notes and keeps the last score", async () => {
    const created = await create(["STUVW3"]);
    const host = await hello(created.code, created.hostSecret);
    host.ws.send(JSON.stringify({ type: "join", name: "Ada", clientSeq: 1 }));
    await host.box.waitFor((message) => message.clientSeq === 1 && message.type === "ack");
    const adaId = (
      (await host.box.waitFor((message) => message.type === "view" && Boolean((message.view as { self?: { playerId?: string } }).self?.playerId))).view as {
        self: { playerId: string };
      }
    ).self.playerId;
    host.ws.send(JSON.stringify({ type: "host.addPitch", title: "Own", presenterName: "Ada", presenterPlayerId: adaId, clientSeq: 2 }));
    host.ws.send(JSON.stringify({ type: "host.addPitch", title: "Other", presenterName: "Nobody", presenterPlayerId: null, clientSeq: 3 }));
    await host.box.waitFor((message) => message.clientSeq === 3 && message.type === "ack");
    const pitches = ((await host.box.waitFor((message) => message.type === "view" && ((message.view as { pitches: unknown[] }).pitches.length === 2))).view as { pitches: Array<{ id: string; title: string }> }).pitches;
    const own = pitches.find((pitch) => pitch.title === "Own")!.id;
    const other = pitches.find((pitch) => pitch.title === "Other")!.id;

    const voter = await hello(created.code);
    voter.ws.send(JSON.stringify({ type: "join", name: "Bea", clientSeq: 1 }));
    await voter.box.waitFor((message) => message.type === "ack");
    voter.ws.send(JSON.stringify({ type: "setScore", pitchId: other, category: "funniness", value: 3, clientSeq: 2 }));
    expect((await voter.box.waitFor((message) => message.clientSeq === 2)).code).toBe("bad_transition");

    const cara = await hello(created.code);
    cara.ws.send(JSON.stringify({ type: "join", name: "Cara", clientSeq: 1 }));
    await cara.box.waitFor((message) => message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.startPitching", clientSeq: 4 }));
    await host.box.waitFor((message) => message.clientSeq === 4 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.setStatus", pitchId: other, status: "presenting", clientSeq: 7 }));
    await host.box.waitFor((message) => message.clientSeq === 7 && message.type === "ack");
    voter.ws.send(JSON.stringify({ type: "setScore", pitchId: other, category: "funniness", value: 9, clientSeq: 3 }));
    expect((await voter.box.waitFor((message) => message.clientSeq === 3)).code).toBe("bad_score");
    voter.ws.send(JSON.stringify({ type: "setScore", pitchId: other, category: "funniness", value: 2, clientSeq: 4 }));
    voter.ws.send(JSON.stringify({ type: "setScore", pitchId: other, category: "funniness", value: 5, clientSeq: 5 }));
    await voter.box.waitFor((message) => message.clientSeq === 5 && message.type === "ack");
    const scored = await voter.box.waitFor((message) => message.type === "view" && JSON.stringify(message).includes(`"value":5`));
    expect(JSON.stringify(scored)).toContain(other);

    host.ws.send(JSON.stringify({ type: "setScore", pitchId: own, category: "funniness", value: 3, clientSeq: 5 }));
    expect((await host.box.waitFor((message) => message.clientSeq === 5 && message.type === "error")).code).toBe("own_pitch");

    host.ws.send(JSON.stringify({ type: "host.removePlayer", name: "Cara", clientSeq: 6 }));
    await host.box.waitFor((message) => message.clientSeq === 6 && message.type === "ack");
    cara.ws.send(JSON.stringify({ type: "setScore", pitchId: other, category: "funniness", value: 3, clientSeq: 2 }));
    expect((await cara.box.waitFor((message) => message.type === "error")).code).toBe("unauthorized");
  });

  it("plays a six-voter session through to the shared tally", async () => {
    const created = await create(["WXYZ23"]);
    const host = await hello(created.code, created.hostSecret);
    let seq = 1;
    const send = async (socket: { ws: WebSocket; box: ReturnType<typeof track> }, body: Json) => {
      const clientSeq = seq;
      seq += 1;
      socket.ws.send(JSON.stringify({ ...body, clientSeq }));
      return socket.box.waitFor((message) => message.clientSeq === clientSeq);
    };
    await send(host, { type: "join", name: "pr" });
    const hostView = await host.box.waitFor(
      (message) => message.type === "view" && Boolean((message.view as { self?: { playerId?: string } }).self?.playerId),
    );
    const presenterId = (hostView.view as { self: { playerId: string } }).self.playerId;
    const pitchIds: Record<string, string> = {};
    for (const title of ["A", "B", "C", "D"]) {
      await send(host, {
        type: "host.addPitch",
        title,
        presenterName: title === "D" ? "pr" : "none",
        presenterPlayerId: title === "D" ? presenterId : null,
      });
    }
    const pitched = await host.box.waitFor((message) => message.type === "view" && ((message.view as { pitches: unknown[] }).pitches.length === 4));
    for (const pitch of (pitched.view as { pitches: Array<{ id: string; title: string }> }).pitches) pitchIds[pitch.title] = pitch.id;
    const voters: Record<string, { ws: WebSocket; box: ReturnType<typeof track> }> = { pr: host };
    for (const name of ["v1", "v2", "v3", "v4", "v5"]) voters[name] = await hello(created.code);
    for (const name of ["v1", "v2", "v3", "v4", "v5"]) {
      voters[name]!.ws.send(JSON.stringify({ type: "join", name, clientSeq: 1 }));
      await voters[name]!.box.waitFor((message) => message.type === "ack" && message.clientSeq === 1);
    }
    await send(host, { type: "host.startPitching" });
    await send(host, { type: "host.openVoting" });
    const orders: Record<string, string[]> = {
      v1: ["A", "B", "C", "D"],
      v2: ["A", "B", "C", "D"],
      v3: ["B", "A", "C", "D"],
      v4: ["C", "B", "A", "D"],
      pr: ["A", "B", "C"],
      v5: ["D", "C", "B", "A"],
    };
    const scoreFor = (title: string): [number, number, number] => {
      if (title === "A" || title === "D") return [5, 5, 10];
      if (title === "B") return [4, 4, 8];
      return [3, 3, 6];
    };
    for (const name of Object.keys(voters)) {
      const socket = voters[name]!;
      let clientSeq = 10;
      for (const title of ["A", "B", "C", "D"]) {
        if (name === "pr" && title === "D") continue;
        const values = name === "v5" ? [1, 1, 2] : scoreFor(title);
        const categories = ["compellingness", "funniness", "hotness"] as const;
        for (let index = 0; index < categories.length; index += 1) {
          clientSeq += 1;
          socket.ws.send(JSON.stringify({ type: "setScore", pitchId: pitchIds[title], category: categories[index], value: values[index], clientSeq }));
          const scored = await socket.box.waitFor((message) => message.clientSeq === clientSeq);
          expect(scored.type, `${name} ${title}`).toBe("ack");
        }
      }
      for (const title of orders[name] ?? []) {
        clientSeq += 1;
        const toIndex = (orders[name] ?? []).indexOf(title);
        socket.ws.send(JSON.stringify({ type: "movePitch", pitchId: pitchIds[title], toIndex, clientSeq }));
        const moved = await socket.box.waitFor((message) => message.clientSeq === clientSeq);
        expect(moved.type, `${name} move ${title}`).toBe("ack");
      }
      if (name !== "v5") {
        clientSeq += 1;
        socket.ws.send(JSON.stringify({ type: "submitBallot", clientSeq }));
        const submitted = await socket.box.waitFor((message) => message.clientSeq === clientSeq);
        expect(submitted.type, `${name} ${JSON.stringify(submitted)}`).toBe("ack");
      }
    }
    const closed = await send(host, { type: "host.closeVoting" });
    expect(closed.type).toBe("ack");
    const view = (await host.box.waitFor((message) => message.type === "view" && (message.view as { results?: { pitches: unknown[] } }).results !== undefined)).view as {
      results: { pitches: Array<{ pitchId: string; bordaRank: number; scoreRank: number; borda: number }> };
    };
    const byTitle = Object.fromEntries(view.results.pitches.map((pitch) => [Object.entries(pitchIds).find(([, id]) => id === pitch.pitchId)?.[0], pitch]));
    expect(byTitle.A?.borda).toBeCloseTo(0.8);
    expect(view.results.pitches.map((pitch) => [Object.entries(pitchIds).find(([, id]) => id === pitch.pitchId)?.[0], pitch.bordaRank, pitch.scoreRank])).toEqual([
      ["A", 1, 1],
      ["B", 2, 3],
      ["C", 3, 4],
      ["D", 4, 1],
    ]);
  });

  it("replays a write, raises forced alerts, and expires storage", async () => {
    const created = await create(["GHJKM2"]);
    const host = await hello(created.code, created.hostSecret);
    host.ws.send(JSON.stringify({ type: "join", name: "Ada", clientSeq: 1 }));
    await host.box.waitFor((message) => message.clientSeq === 1 && message.type === "ack");
    await host.box.waitFor((message) => message.type === "view" && (message.view as { players: unknown[] }).players.length === 1);
    host.ws.send(JSON.stringify({ type: "join", name: "Ada", clientSeq: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const latest = host.box.messages.filter((message) => message.type === "view").at(-1) as { view: { players: unknown[] } };
    expect(latest.view.players).toHaveLength(1);

    host.ws.send(JSON.stringify({ type: "host.startPitching", clientSeq: 2 }));
    await host.box.waitFor((message) => message.clientSeq === 2 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.openVoting", clientSeq: 3 }));
    await host.box.waitFor((message) => message.clientSeq === 3 && message.type === "ack");
    const stub = env.SESSION.get(env.SESSION.idFromName(created.code));
    await stub.fetch("http://session/test/fail-tally", { method: "POST" });
    host.ws.send(JSON.stringify({ type: "host.closeVoting", clientSeq: 4 }));
    const failed = await host.box.waitFor((message) => message.clientSeq === 4 || message.type === "serverAlert");
    expect(["tally_failed", "A2"]).toContain(failed.code ?? (failed.alert as { code?: string } | undefined)?.code);
    const stillVoting = await host.box.waitFor((message) => message.type === "view" && (message.view as { phase: string }).phase === "voting");
    expect((stillVoting.view as { phase: string }).phase).toBe("voting");

    await stub.fetch("http://session/test/fail-write", { method: "POST" });
    host.ws.send(JSON.stringify({ type: "host.closeVoting", clientSeq: 5 }));
    const alert = await host.box.waitFor((message) => message.type === "serverAlert" && (message.alert as { code?: string }).code === "A1");
    expect((alert.alert as { code: string }).code).toBe("A1");

    host.ws.send(JSON.stringify({ type: "host.closeVoting", clientSeq: 6 }));
    await host.box.waitFor((message) => message.clientSeq === 6 && message.type === "ack");
    const expired = await (await stub.fetch("http://session/test/backdate", { method: "POST" })).json();
    expect(expired).toEqual({ meta: null });
  });

  it("keeps a typical view under 20 KB and closes a noisy socket", async () => {
    const stub = env.SESSION.get(env.SESSION.idFromName("CROWD1"));
    const crowd = await (await stub.fetch("http://session/test/crowd", { method: "POST" })).json();
    expect(crowd).toEqual({ bytes: expect.any(Number) });
    expect((crowd as { bytes: number }).bytes).toBeLessThan(20_000);

    const created = await create(["RATEME"]);
    const noisy = await hello(created.code, created.hostSecret);
    const closed = new Promise<number>((resolve) => noisy.ws.addEventListener("close", (event) => resolve(event.code)));
    for (let index = 0; index < 30; index += 1) noisy.ws.send(JSON.stringify({ type: "hello" }));
    expect(await closed).toBe(4008);
  });

  it("exports CSV after close and keeps a renamed title", async () => {
    const created = await create(["EXPRT2"]);
    const host = await hello(created.code, created.hostSecret);
    host.ws.send(JSON.stringify({ type: "join", name: "Ada", clientSeq: 1 }));
    await host.box.waitFor((message) => message.clientSeq === 1 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.addPitch", title: 'Say "hi", please', presenterName: "Ada", presenterPlayerId: null, clientSeq: 2 }));
    await host.box.waitFor((message) => message.clientSeq === 2 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.startPitching", clientSeq: 3 }));
    await host.box.waitFor((message) => message.clientSeq === 3 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.openVoting", clientSeq: 4 }));
    await host.box.waitFor((message) => message.clientSeq === 4 && message.type === "ack");
    host.ws.send(JSON.stringify({ type: "host.closeVoting", clientSeq: 5 }));
    await host.box.waitFor((message) => message.clientSeq === 5 && message.type === "ack");
    const stub = env.SESSION.get(env.SESSION.idFromName(created.code));
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    const csv = await (await stub.fetch("http://session/export?format=ballots", { headers: { "x-host-secret": created.hostSecret } })).text();
    expect(csv).toContain('"Say ""hi"", please"');
    const view = host.box.messages.filter((message) => message.type === "view").at(-1) as { view: { pitches: Array<{ id: string }> } };
    host.ws.send(JSON.stringify({ type: "host.updatePitch", pitchId: view.view.pitches[0]?.id, title: "Renamed pitch", clientSeq: 6 }));
    await host.box.waitFor((message) => message.clientSeq === 6 && message.type === "ack");
    const renamed = await (await stub.fetch("http://session/export?format=summary", { headers: { "x-host-secret": created.hostSecret } })).text();
    spy.mockRestore();
    expect(renamed).toContain("Renamed pitch");
    expect(logs.some((line) => line.includes("export.raw") && line.includes("rows"))).toBe(true);
  });
});
