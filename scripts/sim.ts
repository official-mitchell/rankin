// 25 WebSocket bots score, rank, and submit (checklist 12.2).
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

function createKey(): string {
  const line = readFileSync(".dev.vars", "utf8").split("\n").find((entry) => entry.startsWith("CREATE_KEY="));
  if (!line) throw new Error("CREATE_KEY is missing");
  return line.slice("CREATE_KEY=".length).trim();
}

function start(command: string, args: string[]): ChildProcess {
  return spawn(command, args, { stdio: "inherit" });
}

async function waitFor(url: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

type Envelope = { type?: string; view?: { pitches?: Array<{ id: string }>; phase?: string }; code?: string; clientSeq?: number };

function connect(code: string): Promise<{ socket: WebSocket; inbox: Envelope[]; send: (body: Record<string, unknown>) => number }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:8787/api/s/${code}/ws`);
    const inbox: Envelope[] = [];
    let seq = 0;
    const latencies: number[] = [];
    const pending = new Map<number, number>();
    socket.addEventListener("message", (event) => {
      void (async () => {
      const text = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
      const body = JSON.parse(text) as Envelope & { clientSeq?: number };
      inbox.push(body);
      if (body.clientSeq !== undefined && pending.has(body.clientSeq)) {
        latencies.push(performance.now() - (pending.get(body.clientSeq) ?? 0));
        pending.delete(body.clientSeq);
      }
      })();
    });
    socket.addEventListener("open", () => {
      resolve({
        socket,
        inbox,
        send: (body) => {
          seq += 1;
          pending.set(seq, performance.now());
          socket.send(JSON.stringify({ ...body, clientSeq: seq }));
          return seq;
        },
      });
    });
    socket.addEventListener("error", () => reject(new Error("socket error")));
    Object.assign(socket, { latencies });
  });
}

async function until(inbox: Envelope[], predicate: (message: Envelope) => boolean): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (inbox.some(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for a view");
}

const worker = start("npx", ["wrangler", "dev", "--port", "8787"]);
try {
  await waitFor("http://127.0.0.1:8787/api/health");
  const created = (await (await fetch("http://127.0.0.1:8787/api/sessions", {
    method: "POST",
    body: JSON.stringify({ createKey: createKey() }),
  })).json()) as { code: string; hostSecret: string };

  const host = await connect(created.code);
  host.socket.send(JSON.stringify({ type: "hello", hostSecret: created.hostSecret }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  host.send({ type: "join", name: "Host" });
  await until(host.inbox, (message) => message.type === "view");
  for (const title of ["Alpha", "Beta", "Gamma"]) {
    host.send({ type: "host.addPitch", title, presenterName: "Host", presenterPlayerId: null });
    await until(host.inbox, (message) => (message.view?.pitches?.length ?? 0) >= (title === "Alpha" ? 1 : title === "Beta" ? 2 : 3));
  }
  const bots = [];
  for (let index = 0; index < 25; index += 1) {
    const bot = await connect(created.code);
    bot.socket.send(JSON.stringify({ type: "hello" }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    bot.send({ type: "join", name: `Bot ${index + 1}` });
    bots.push(bot);
  }
  await until(host.inbox, (message) => (message.view?.phase === "lobby" && (message.view as { players?: unknown[] }).players?.length === 26) || false);
  host.send({ type: "host.startPitching" });
  host.send({ type: "host.openVoting" });
  await until(host.inbox, (message) => message.view?.phase === "voting");
  const pitches = host.inbox.filter((message) => message.view?.pitches).at(-1)?.view?.pitches ?? [];
  let errors = 0;
  const samples: number[] = [];
  for (const bot of bots) {
    const before = (bot.socket as WebSocket & { latencies?: number[] }).latencies?.length ?? 0;
    for (const pitch of pitches) {
      bot.send({ type: "setScore", pitchId: pitch.id, category: "compellingness", value: 4 });
      bot.send({ type: "setScore", pitchId: pitch.id, category: "funniness", value: 4 });
      bot.send({ type: "setScore", pitchId: pitch.id, category: "hotness", value: 8 });
    }
    pitches.forEach((pitch, index) => bot.send({ type: "movePitch", pitchId: pitch.id, toIndex: index }));
    const submitSeq = bot.send({ type: "submitBallot" });
    await until(bot.inbox, (message) => message.type === "ack" && message.clientSeq === submitSeq);
    const mine = ((bot.socket as WebSocket & { latencies?: number[] }).latencies ?? []).slice(before);
    samples.push(...mine);
    errors += bot.inbox.filter((message) => message.type === "error").length;
  }
  host.send({ type: "host.closeVoting" });
  await until(host.inbox, (message) => message.view?.phase === "closed");
  samples.sort((left, right) => left - right);
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] ?? 0;
  const exported = (await (await fetch(`http://127.0.0.1:8787/api/s/${created.code}/export`, {
    headers: { "x-host-secret": created.hostSecret },
  })).json()) as { metrics: Record<string, number> };
  const report = {
    bots: bots.length,
    samples: samples.length,
    errors,
    p95Ms: Math.round(p95),
    writes_failed: exported.metrics.writes_failed ?? 0,
    rate_limited: exported.metrics.rate_limited ?? 0,
  };
  mkdirSync("shots/e2e", { recursive: true });
  writeFileSync("shots/e2e/sim.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (errors !== 0 || report.writes_failed !== 0 || report.rate_limited !== 0 || p95 > 2000) process.exitCode = 1;
} finally {
  worker.kill("SIGTERM");
}
