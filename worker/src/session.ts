// Session Durable Object for checklist 4, host counters (7.3), and closed CSV/Markdown/chart data (11).
import {
  ALERT_A1,
  ALERT_A2,
  CHIPS,
  applyMove,
  applyNewPitch,
  applyPlace,
  applyRemovePitch,
  ballotComplete,
  ballotCsv,
  chartPitches,
  computeResults,
  markdownSummary,
  summaryCsv,
  missingItems,
  type Ballot,
  type CategoryId,
  type Phase,
  type PitchStatus,
  type PlayerRole,
  type ExportBundle,
  type Results,
  type Score,
  type SessionSnapshot,
} from "@we-rankin/shared";
import type { Env } from "./env";
import { log } from "./log";
import { inc, parseMetricInc, readMetrics } from "./metrics";
import { isOpenCommand, parseClientMessage, type ClientCommand } from "./protocol";
import { migrate, schemaDump } from "./schema";
import { buildView, scoreValue, type ViewState } from "./view";
import { sha256, safeEqual } from "./secret";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HELLO_MS = 5000;
const RATE = 20;
const VALID_CHIPS = new Set(CHIPS.map((chip) => chip.id));

type Attachment = {
  hello: boolean;
  playerId: string | null;
  isHost: boolean;
  strikes: number;
  tokens: number;
  tokenAt: number;
};

type Meta = {
  code: string;
  phase: Phase;
  roster_locked: number;
  created_at: number;
  closed_at: number | null;
  host_secret_hash: string;
  schema_version: number;
};

type PlayerRow = {
  id: string;
  name: string;
  role: PlayerRole;
  removed: number;
  last_seen: number | null;
  join_seq: number | null;
};

type PitchRow = {
  id: string;
  title: string;
  presenter_name: string;
  presenter_player_id: string | null;
  status: PitchStatus;
  position: number;
  added_in_voting: number;
};

export class Session {
  private readonly sql: SqlStorage;
  private readonly ctx: DurableObjectState;
  private readonly env: Env;
  private failNextWrite = false;
  private failNextTally = false;
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFlush = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.ctx = state;
    this.env = env;
    this.sql = state.storage.sql;
    state.blockConcurrencyWhile(async () => {
      const result = migrate(this.sql);
      if (!result.migrated) return;
      log({
        minLevel: env.LOG_LEVEL,
        level: "info",
        event: "db.migrated",
        secrets: env.CREATE_KEY ? [env.CREATE_KEY] : [],
        fields: { reqId: "migrate", from: result.from, to: result.to },
      });
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") return this.accept(request);
    if (url.pathname === "/metrics" && request.method === "POST") {
      const parsed = parseMetricInc(await request.json().catch(() => null));
      if (!parsed) return Response.json({ error: "bad_metric" }, { status: 400 });
      inc(this.sql, parsed.name, parsed.n);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/metrics" && request.method === "GET") return Response.json(readMetrics(this.sql));
    if (url.pathname === "/schema" && request.method === "GET") return Response.json(schemaDump(this.sql));
    if (url.pathname === "/init" && request.method === "POST") return this.init(await request.json());
    if (url.pathname === "/export" && request.method === "GET") return this.exportRaw(request);
    if (url.pathname === "/test/expire-hellos" && request.method === "POST") {
      this.expirePendingHellos();
      return Response.json({ ok: true });
    }
    if (url.pathname === "/test/fail-write" && request.method === "POST") {
      this.failNextWrite = true;
      return Response.json({ ok: true });
    }
    if (url.pathname === "/test/fail-tally" && request.method === "POST") {
      this.failNextTally = true;
      return Response.json({ ok: true });
    }
    if (url.pathname === "/test/crowd" && request.method === "POST") return Response.json({ bytes: this.seedCrowd() });
    if (url.pathname === "/test/constraints" && request.method === "POST") return Response.json(this.constraintProbe());
    if (url.pathname === "/test/attachments" && request.method === "GET") {
      return Response.json(this.ctx.getWebSockets().map((socket) => this.attachment(socket)));
    }
    if (url.pathname === "/test/backdate" && request.method === "POST") {
      this.sql.exec(`UPDATE meta SET closed_at = ?`, Date.now() - 31 * 24 * 60 * 60 * 1000);
      await this.alarm();
      return Response.json({ meta: this.meta() });
    }
    if (url.pathname === "/alarm" && request.method === "POST") {
      await this.alarm();
      return Response.json({ ok: true, meta: this.meta() });
    }
    return Response.json({ ok: true });
  }

  async alarm(): Promise<void> {
    const meta = this.meta();
    if (!meta?.closed_at) return;
    if (Date.now() < meta.closed_at + RETENTION_MS) return;
    for (const table of ["scores", "chips", "ballots", "results", "pitches", "players", "seqs", "disconnected", "metrics", "meta"]) {
      this.sql.exec(`DELETE FROM ${table}`);
    }
    this.log("info", "session.expired", { sessionCode: meta.code });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (!this.takeToken(ws)) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.reject(ws, "bad_message");
      return;
    }
    const attachment = this.attachment(ws);
    if (parsed.command.type === "client.error") {
      if (!attachment.hello) {
        this.reject(ws, "unauthorized");
        return;
      }
      this.log("warn", "client.error", {
        message: parsed.command.message,
        stack: parsed.command.stack,
        playerId: attachment.playerId ?? undefined,
      });
      return;
    }
    if (!attachment.hello && parsed.command.type !== "hello") {
      this.reject(ws, "unauthorized");
      return;
    }
    if (!attachment.playerId && !attachment.isHost && !isOpenCommand(parsed.command.type)) {
      this.reject(ws, "unauthorized");
      return;
    }
    try {
      await this.dispatch(ws, parsed.command);
    } catch (error) {
      this.onWriteFailed(ws, error);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.noteDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.noteDisconnect(ws);
  }

  private accept(_request: Request): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    this.writeAttachment(server, this.freshAttachment());
    setTimeout(() => {
      if (server.readyState !== WebSocket.OPEN) return;
      if (!this.attachment(server).hello) server.close(4001, "hello timeout");
    }, HELLO_MS);
    this.log("info", "ws.connected", { ws_connections: this.ctx.getWebSockets().length });
    return new Response(null, { status: 101, webSocket: client });
  }

  private async init(body: unknown): Promise<Response> {
    const record = body as { code?: unknown; hostSecretHash?: unknown };
    if (typeof record.code !== "string" || typeof record.hostSecretHash !== "string") {
      return Response.json({ error: "bad_init" }, { status: 400 });
    }
    if (this.meta()) return Response.json({ error: "exists" }, { status: 409 });
    const createdAt = Date.now();
    this.sql.exec(
      `INSERT INTO meta (code, phase, roster_locked, created_at, closed_at, host_secret_hash, schema_version)
       VALUES (?, 'lobby', 0, ?, NULL, ?, 2)`,
      record.code,
      createdAt,
      record.hostSecretHash,
    );
    inc(this.sql, "sessions_created");
    this.log("info", "session.created", { sessionCode: record.code });
    return Response.json({ ok: true, code: record.code });
  }

  private async exportRaw(request: Request): Promise<Response> {
    const meta = this.meta();
    const provided = request.headers.get("x-host-secret") ?? "";
    if (!meta || !(await this.hostOk(provided, meta.host_secret_hash))) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const payload = {
      meta: this.rows(`SELECT code, phase, roster_locked, created_at, closed_at, host_secret_hash, schema_version FROM meta`),
      players: this.rows(`SELECT id, name, role, removed, last_seen FROM players`),
      pitches: this.rows(`SELECT id, title, presenter_name, presenter_player_id, status, position, added_in_voting FROM pitches ORDER BY position`),
      scores: this.rows(`SELECT player_id, pitch_id, category, value FROM scores`),
      chips: this.rows(`SELECT player_id, pitch_id, chip_id FROM chips`),
      ballots: this.rows(`SELECT player_id, order_json, placed_json, submitted, created_at FROM ballots`),
      results: this.rows(`SELECT json, computed_at FROM results`),
      metrics: readMetrics(this.sql),
    };
    const format = new URL(request.url).searchParams.get("format");
    if (!format) {
      this.log("info", "export.raw", { sessionCode: meta.code, format: "json", rows: payload.scores.length });
      return Response.json(payload);
    }
    if (meta.phase !== "closed") return Response.json({ error: "not_closed" }, { status: 409 });
    const bundle = this.exportBundle();
    const includeNames = new URL(request.url).searchParams.get("names") === "1";
    if (format === "ballots") return this.exportText(ballotCsv(bundle, Math.random, includeNames), "text/csv; charset=utf-8", "ballots.csv", meta.code);
    if (format === "summary") return this.exportText(summaryCsv(bundle), "text/csv; charset=utf-8", "summary.csv", meta.code);
    if (format === "markdown") return this.exportText(markdownSummary(bundle), "text/markdown; charset=utf-8", "results.md", meta.code);
    if (format === "charts") {
      const pitches = chartPitches(bundle);
      this.log("info", "export.raw", { sessionCode: meta.code, format, rows: pitches.length });
      return Response.json({ pitches });
    }
    return Response.json({ error: "bad_format" }, { status: 400 });
  }

  private exportText(body: string, contentType: string, filename: string, sessionCode: string): Response {
    const rows = Math.max(0, body.split("\n").filter((line) => line.length > 0).length - (contentType.startsWith("text/csv") ? 1 : 0));
    this.log("info", "export.raw", { sessionCode, format: filename, rows });
    return new Response(body, {
      headers: { "content-type": contentType, "content-disposition": `attachment; filename="${filename}"` },
    });
  }

  private exportBundle(): ExportBundle {
    const snapshot = this.snapshot();
    const pitches = this.rows(`SELECT id, title, presenter_name FROM pitches ORDER BY position`) as Array<{
      id: string;
      title: string;
      presenter_name: string;
    }>;
    const chips = this.rows(`SELECT player_id, pitch_id, chip_id FROM chips`) as Array<{
      player_id: string;
      pitch_id: string;
      chip_id: string;
    }>;
    const stored = this.rows(`SELECT json FROM results`) as Array<{ json: string }>;
    const parsed = stored[0] ? (JSON.parse(stored[0].json) as Results) : null;
    return {
      players: snapshot.players,
      pitches: pitches.map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenter_name })),
      scores: snapshot.scores,
      chips: chips.map((chip) => ({ playerId: chip.player_id, pitchId: chip.pitch_id, chipId: chip.chip_id })),
      ballots: snapshot.ballots,
      results: parsed ?? computeResults(snapshot),
    };
  }

  private async dispatch(ws: WebSocket, command: ClientCommand): Promise<void> {
    if (command.type === "hello") {
      await this.hello(ws, command.playerId, command.hostSecret);
      return;
    }
    const seqScope = this.seqScope(ws, command);
    if ("clientSeq" in command && seqScope && this.seen(seqScope, command.clientSeq)) {
      this.send(ws, { type: "ack", clientSeq: command.clientSeq });
      return;
    }
    const outcome = this.apply(ws, command);
    if (!outcome.ok) {
      this.reject(ws, outcome.code, "clientSeq" in command ? command.clientSeq : undefined, outcome.missing);
      return;
    }
    if ("clientSeq" in command && seqScope) this.remember(seqScope, command.clientSeq);
    if ("clientSeq" in command) this.send(ws, { type: "ack", clientSeq: command.clientSeq });
    if (outcome.mutate) {
      inc(this.sql, "writes_ok");
      this.scheduleBroadcast();
    }
  }

  private apply(ws: WebSocket, command: ClientCommand): { ok: true; mutate: boolean } | { ok: false; code: string; missing?: unknown } {
    if (this.failNextWrite && command.type !== "hello") {
      this.failNextWrite = false;
      throw new Error("forced storage error");
    }
    const meta = this.meta();
    if (!meta) return { ok: false, code: "not_ready" };
    const attachment = this.attachment(ws);
    if (meta.phase === "closed" && command.type !== "host.updatePitch") return { ok: false, code: "bad_transition" };
    switch (command.type) {
      case "hello":
        return { ok: true, mutate: false };
      case "join":
        return this.join(ws, command.name, command.clientSeq);
      case "reclaim":
        return this.reclaim(ws, command.name);
      case "setScore":
        return this.setScore(attachment, command.pitchId, command.category as CategoryId, command.value);
      case "setChips":
        return this.setChips(attachment, command.pitchId, command.chipIds);
      case "movePitch":
        return this.movePitch(attachment, command.pitchId, command.toIndex);
      case "placePitch":
        return this.placePitch(attachment, command.pitchId);
      case "submitBallot":
        return this.submitBallot(attachment);
      case "host.addPitch":
        return this.addPitch(attachment, command);
      case "host.updatePitch":
        return this.updatePitch(attachment, command);
      case "host.removePitch":
        return this.removePitch(attachment, command.pitchId);
      case "host.setStatus":
        return this.setStatus(attachment, command.pitchId, command.status);
      case "host.startPitching":
        return this.transition(attachment, "pitching");
      case "host.openVoting":
        return this.transition(attachment, "voting");
      case "host.closeVoting":
        return this.closeVoting(attachment);
      case "host.promote":
        return this.promote(attachment, command.name);
      case "host.removePlayer":
        return this.removePlayer(attachment, command.name);
      case "host.releaseName":
        return this.releaseName(attachment, command.name);
      default:
        return { ok: false, code: "bad_message" };
    }
  }

  private async hello(ws: WebSocket, playerId: string | undefined, hostSecret: string | undefined): Promise<void> {
    const meta = this.meta();
    const attachment = this.attachment(ws);
    if (hostSecret) {
      if (!meta || !(await this.hostOk(hostSecret, meta.host_secret_hash))) {
        this.log("warn", "ws.rejected", { code: 4003 });
        ws.close(4003, "bad host secret");
        return;
      }
      attachment.isHost = true;
    }
    attachment.hello = true;
    if (playerId && this.playerById(playerId)) {
      const known = this.rows<{ player_id: string }>(`SELECT player_id FROM disconnected WHERE player_id = ?`, playerId);
      if (known.length > 0) {
        inc(this.sql, "reconnects");
        this.sql.exec(`DELETE FROM disconnected WHERE player_id = ?`, playerId);
      }
      attachment.playerId = playerId;
    }
    this.writeAttachment(ws, attachment);
    this.touch(attachment.playerId);
    this.scheduleBroadcast();
  }

  private join(ws: WebSocket, name: string, clientSeq: number): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const meta = this.meta();
    if (!meta) return { ok: false, code: "not_ready" };
    const existing = this.playerByName(name);
    if (existing) {
      if (existing.join_seq === clientSeq) return { ok: true, mutate: false };
      return { ok: false, code: "name_taken" };
    }
    const attachment = this.attachment(ws);
    const voter = attachment.isHost || (meta.phase === "lobby" && meta.roster_locked === 0);
    const id = crypto.randomUUID();
    this.sql.exec(
      `INSERT INTO players (id, name, role, removed, last_seen, join_seq) VALUES (?, ?, ?, 0, ?, ?)`,
      id,
      name,
      voter ? "voter" : "spectator",
      Date.now(),
      clientSeq,
    );
    attachment.playerId = id;
    attachment.hello = true;
    this.writeAttachment(ws, attachment);
    inc(this.sql, "players_joined");
    this.log("info", "player.joined", { sessionCode: meta.code, playerId: id, role: voter ? "voter" : "spectator" });
    return { ok: true, mutate: true };
  }

  private reclaim(ws: WebSocket, name: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const player = this.playerByName(name);
    if (!player) return { ok: false, code: "not_found" };
    const live = this.ctx.getWebSockets().filter((socket) => {
      if (socket === ws || socket.readyState !== WebSocket.OPEN) return false;
      return this.attachment(socket).playerId === player.id;
    });
    if (live.length > 0) return { ok: false, code: "name_in_use" };
    const attachment = this.attachment(ws);
    attachment.playerId = player.id;
    attachment.hello = true;
    this.writeAttachment(ws, attachment);
    this.sql.exec(`UPDATE players SET last_seen = ? WHERE id = ?`, Date.now(), player.id);
    this.log("info", "player.reclaimed", { playerId: player.id });
    return { ok: true, mutate: true };
  }

  private setScore(attachment: Attachment, pitchId: string, category: CategoryId, value: number): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const gate = this.noteGate(attachment, pitchId);
    if (!gate.ok) return gate;
    if (!scoreValue(category, value)) return { ok: false, code: "bad_score" };
    this.sql.exec(
      `INSERT INTO scores (player_id, pitch_id, category, value) VALUES (?, ?, ?, ?)
       ON CONFLICT(player_id, pitch_id, category) DO UPDATE SET value = excluded.value`,
      attachment.playerId,
      pitchId,
      category,
      value,
    );
    this.log("debug", "score.saved", { playerId: attachment.playerId ?? undefined, pitchId, category });
    return { ok: true, mutate: true };
  }

  private setChips(attachment: Attachment, pitchId: string, chipIds: string[]): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const gate = this.noteGate(attachment, pitchId);
    if (!gate.ok) return gate;
    if (chipIds.some((id) => !VALID_CHIPS.has(id))) return { ok: false, code: "bad_chip" };
    this.sql.exec(`DELETE FROM chips WHERE player_id = ? AND pitch_id = ?`, attachment.playerId, pitchId);
    for (const chipId of new Set(chipIds)) {
      this.sql.exec(`INSERT INTO chips (player_id, pitch_id, chip_id) VALUES (?, ?, ?)`, attachment.playerId, pitchId, chipId);
    }
    return { ok: true, mutate: true };
  }

  private noteGate(attachment: Attachment, pitchId: string): { ok: true } | { ok: false; code: string } {
    const meta = this.meta();
    const player = attachment.playerId ? this.playerById(attachment.playerId) : null;
    if (!meta || !player) return { ok: false, code: "unauthorized" };
    if (player.removed) return { ok: false, code: "unauthorized" };
    if (player.role !== "voter") return { ok: false, code: "unauthorized" };
    if (meta.phase === "lobby" || meta.phase === "closed") return { ok: false, code: "bad_transition" };
    const pitch = this.pitch(pitchId);
    if (!pitch) return { ok: false, code: "not_found" };
    if (pitch.presenter_player_id === player.id) return { ok: false, code: "own_pitch" };
    if (meta.phase !== "voting" && pitch.status === "upcoming") return { ok: false, code: "bad_transition" };
    return { ok: true };
  }

  private movePitch(attachment: Attachment, pitchId: string, toIndex: number): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const ballot = this.requireBallot(attachment);
    if (!ballot.ok) return ballot;
    const next = applyMove(ballot.draft, pitchId, toIndex);
    this.saveBallot(attachment.playerId!, next.order, next.placed, ballot.submitted);
    this.log("debug", "ballot.reordered", { playerId: attachment.playerId ?? undefined });
    return { ok: true, mutate: true };
  }

  private placePitch(attachment: Attachment, pitchId: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    const ballot = this.requireBallot(attachment);
    if (!ballot.ok) return ballot;
    const next = applyPlace(ballot.draft, pitchId);
    this.saveBallot(attachment.playerId!, next.order, next.placed, ballot.submitted);
    return { ok: true, mutate: true };
  }

  private submitBallot(attachment: Attachment): { ok: true; mutate: boolean } | { ok: false; code: string; missing?: unknown } {
    const ballot = this.requireBallot(attachment);
    if (!ballot.ok) return ballot;
    const state = this.viewState();
    const input = {
      playerId: attachment.playerId!,
      pitches: state.pitches,
      scores: state.scores,
      ballot: ballot.draft,
      newPitchIds: state.newPitchIds,
    };
    if (!ballotComplete(input)) {
      return { ok: false, code: "incomplete", missing: missingItems(input) };
    }
    this.saveBallot(attachment.playerId!, ballot.draft.order, ballot.draft.placed, true);
    inc(this.sql, "ballots_submitted");
    this.log("info", "ballot.submitted", { playerId: attachment.playerId ?? undefined });
    return { ok: true, mutate: true };
  }

  private addPitch(
    attachment: Attachment,
    command: Extract<ClientCommand, { type: "host.addPitch" }>,
  ): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const meta = this.meta();
    if (!meta || meta.phase === "closed") return { ok: false, code: "bad_transition" };
    const position = this.rows<{ max: number | null }>(`SELECT MAX(position) AS max FROM pitches`)[0]?.max ?? 0;
    const id = crypto.randomUUID();
    const addedInVoting = meta.phase === "voting" ? 1 : 0;
    this.sql.exec(
      `INSERT INTO pitches (id, title, presenter_name, presenter_player_id, status, position, added_in_voting)
       VALUES (?, ?, ?, ?, 'upcoming', ?, ?)`,
      id,
      command.title,
      command.presenterName,
      command.presenterPlayerId,
      position + 1,
      addedInVoting,
    );
    if (meta.phase === "voting") this.appendVotingPitch(id, command.presenterPlayerId);
    this.log("info", "pitch.added", { pitchId: id, sessionCode: meta.code });
    return { ok: true, mutate: true };
  }

  private appendVotingPitch(pitchId: string, presenterId: string | null): void {
    for (const player of this.playerRows()) {
      if (player.removed || player.role !== "voter") continue;
      const ballot = this.ballot(player.id);
      if (!ballot) continue;
      const next = player.id === presenterId ? ballot : applyNewPitch(ballot, pitchId);
      this.saveBallot(player.id, next.order, next.placed, false);
    }
  }

  private updatePitch(
    attachment: Attachment,
    command: Extract<ClientCommand, { type: "host.updatePitch" }>,
  ): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const meta = this.meta();
    const pitch = this.pitch(command.pitchId);
    if (!meta || !pitch) return { ok: false, code: "not_found" };
    if (command.presenterPlayerId !== undefined && command.presenterPlayerId !== pitch.presenter_player_id) {
      if (meta.phase === "voting" || meta.phase === "closed") return { ok: false, code: "bad_transition" };
    }
    if (meta.phase === "closed" && command.presenterPlayerId !== undefined && command.presenterPlayerId !== pitch.presenter_player_id) {
      return { ok: false, code: "bad_transition" };
    }
    this.sql.exec(
      `UPDATE pitches SET title = ?, presenter_name = ?, presenter_player_id = ? WHERE id = ?`,
      command.title ?? pitch.title,
      command.presenterName ?? pitch.presenter_name,
      command.presenterPlayerId === undefined ? pitch.presenter_player_id : command.presenterPlayerId,
      pitch.id,
    );
    this.log("info", "pitch.updated", { pitchId: pitch.id });
    return { ok: true, mutate: true };
  }

  private removePitch(attachment: Attachment, pitchId: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    if (!this.pitch(pitchId)) return { ok: false, code: "not_found" };
    this.sql.exec(`DELETE FROM scores WHERE pitch_id = ?`, pitchId);
    this.sql.exec(`DELETE FROM chips WHERE pitch_id = ?`, pitchId);
    for (const player of this.playerRows()) {
      const ballot = this.ballot(player.id);
      if (!ballot) continue;
      const next = applyRemovePitch(ballot, pitchId);
      this.saveBallot(player.id, next.order, next.placed, this.ballotSubmitted(player.id));
    }
    this.sql.exec(`DELETE FROM pitches WHERE id = ?`, pitchId);
    this.log("info", "pitch.removed", { pitchId });
    return { ok: true, mutate: true };
  }

  private setStatus(attachment: Attachment, pitchId: string, status: PitchStatus): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const pitch = this.pitch(pitchId);
    if (!pitch) return { ok: false, code: "not_found" };
    if (status === "presenting") {
      this.sql.exec(`UPDATE pitches SET status = 'done' WHERE status = 'presenting' AND id != ?`, pitchId);
    }
    this.sql.exec(`UPDATE pitches SET status = ? WHERE id = ?`, status, pitchId);
    this.log("info", "pitch.status", { pitchId, status });
    return { ok: true, mutate: true };
  }

  private transition(attachment: Attachment, to: Phase): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const meta = this.meta();
    if (!meta) return { ok: false, code: "not_ready" };
    if (meta.phase === to) return { ok: true, mutate: false };
    const allowed = (meta.phase === "lobby" && to === "pitching") || (meta.phase === "pitching" && to === "voting");
    if (!allowed) return { ok: false, code: "bad_transition" };
    if (to === "pitching") {
      this.sql.exec(`UPDATE meta SET phase = 'pitching', roster_locked = 1`);
      const voters = this.playerRows().filter((player) => player.role === "voter" && !player.removed).length;
      this.log("info", "roster.locked", { voters, sessionCode: meta.code });
    } else {
      this.sql.exec(`UPDATE meta SET phase = 'voting'`);
      this.createBallots();
    }
    this.log("info", "phase.changed", { from: meta.phase, to, sessionCode: meta.code });
    return { ok: true, mutate: true };
  }

  private createBallots(): void {
    const pitches = this.pitchRows();
    for (const player of this.playerRows()) {
      if (player.removed || player.role !== "voter") continue;
      if (this.ballot(player.id)) continue;
      const order = pitches.filter((pitch) => pitch.presenter_player_id !== player.id).map((pitch) => pitch.id);
      this.saveBallot(player.id, order, order, false);
      this.log("info", "ballot.created", { playerId: player.id });
    }
  }

  private closeVoting(attachment: Attachment): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const meta = this.meta();
    if (!meta) return { ok: false, code: "not_ready" };
    if (meta.phase === "closed") return { ok: true, mutate: false };
    if (meta.phase !== "voting") return { ok: false, code: "bad_transition" };
    if (this.failNextTally) {
      this.failNextTally = false;
      throw new Error("forced tally error");
    }
    const started = Date.now();
    const snapshot = this.snapshot();
    let results: Results;
    try {
      results = computeResults(snapshot);
    } catch (error) {
      this.raiseTally(error);
      return { ok: false, code: "tally_failed" };
    }
    const closedAt = Date.now();
    this.sql.exec(`INSERT INTO results (id, json, computed_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, computed_at = excluded.computed_at`, JSON.stringify(results), closedAt);
    this.sql.exec(`UPDATE meta SET phase = 'closed', closed_at = ?`, closedAt);
    void this.ctx.storage.setAlarm(closedAt + RETENTION_MS);
    const counted = results.countedPlayerIds.length;
    const voided = results.voidedPlayerIds.length;
    this.log("info", "tally.computed", { counted, voided, ms: Date.now() - started, sessionCode: meta.code });
    this.log("info", "voting.closed", { counted, voided, sessionCode: meta.code });
    inc(this.sql, "tallies_run");
    return { ok: true, mutate: true };
  }

  private promote(attachment: Attachment, name: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const meta = this.meta();
    const player = this.playerByName(name);
    if (!meta || !player) return { ok: false, code: "not_found" };
    if (meta.phase === "voting" || meta.phase === "closed") return { ok: false, code: "bad_transition" };
    if (player.role === "voter") return { ok: true, mutate: false };
    this.sql.exec(`UPDATE players SET role = 'voter' WHERE id = ?`, player.id);
    this.log("info", "player.promoted", { playerId: player.id });
    return { ok: true, mutate: true };
  }

  private removePlayer(attachment: Attachment, name: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const player = this.playerByName(name);
    if (!player) return { ok: false, code: "not_found" };
    this.sql.exec(`UPDATE players SET removed = 1 WHERE id = ?`, player.id);
    this.log("info", "player.removed", { playerId: player.id });
    return { ok: true, mutate: true };
  }

  private releaseName(attachment: Attachment, name: string): { ok: true; mutate: boolean } | { ok: false; code: string } {
    if (!this.host(attachment)) return { ok: false, code: "unauthorized" };
    const player = this.playerByName(name);
    if (!player) return { ok: false, code: "not_found" };
    for (const socket of this.ctx.getWebSockets()) {
      if (this.attachment(socket).playerId !== player.id) continue;
      socket.close(4000, "released");
    }
    return { ok: true, mutate: true };
  }

  private requireBallot(attachment: Attachment):
    | { ok: true; draft: { order: string[]; placed: string[] }; submitted: boolean }
    | { ok: false; code: string } {
    const meta = this.meta();
    const player = attachment.playerId ? this.playerById(attachment.playerId) : null;
    if (!meta || !player || player.removed || player.role !== "voter") return { ok: false, code: "unauthorized" };
    if (meta.phase !== "voting") return { ok: false, code: "bad_transition" };
    const draft = this.ballot(player.id);
    if (!draft) return { ok: false, code: "not_found" };
    return { ok: true, draft, submitted: this.ballotSubmitted(player.id) };
  }

  private snapshot(): SessionSnapshot {
    const state = this.viewState();
    return {
      players: state.players.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        removed: player.removed,
      })),
      pitches: state.pitches.map((pitch) => ({
        id: pitch.id,
        title: pitch.title,
        presenterId: pitch.presenterId,
        status: pitch.status,
      })),
      ballots: state.ballots,
      scores: state.scores,
    };
  }

  private metric(name: string): number {
    return readMetrics(this.sql)[name] ?? 0;
  }

  private viewState(): ViewState {
    const meta = this.meta();
    const live = new Set(
      this.ctx.getWebSockets().flatMap((socket) => {
        const playerId = this.attachment(socket).playerId;
        return playerId && socket.readyState === WebSocket.OPEN ? [playerId] : [];
      }),
    );
    const ballots = this.ballots();
    const submitted = new Map(ballots.map((ballot) => [ballot.playerId, ballot.submitted]));
    const resultsRow = this.rows<{ json: string }>(`SELECT json FROM results`);
    return {
      phase: meta?.phase ?? "lobby",
      rosterLocked: (meta?.roster_locked ?? 0) === 1,
      players: this.playerRows().map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        removed: player.removed === 1,
        connected: live.has(player.id),
        submitted: submitted.get(player.id) ?? false,
      })),
      pitches: this.pitchRows().map((pitch) => ({
        id: pitch.id,
        title: pitch.title,
        presenterName: pitch.presenter_name,
        presenterId: pitch.presenter_player_id,
        status: pitch.status,
        position: pitch.position,
      })),
      scores: this.rows<{ player_id: string; pitch_id: string; category: CategoryId; value: number }>(
        `SELECT player_id, pitch_id, category, value FROM scores`,
      ).map((row) => ({ playerId: row.player_id, pitchId: row.pitch_id, category: row.category, value: row.value })),
      chips: this.rows<{ player_id: string; pitch_id: string; chip_id: string }>(
        `SELECT player_id, pitch_id, chip_id FROM chips`,
      ).map((row) => ({ playerId: row.player_id, pitchId: row.pitch_id, chipId: row.chip_id })),
      ballots,
      newPitchIds: this.pitchRows().filter((pitch) => pitch.added_in_voting === 1).map((pitch) => pitch.id),
      results: resultsRow[0] ? (JSON.parse(resultsRow[0].json) as Results) : null,
      writesFailed: this.metric("writes_failed"),
      reconnects: this.metric("reconnects"),
    };
  }

  private scheduleBroadcast(): void {
    if (this.broadcastTimer !== null) return;
    const wait = Math.max(0, 100 - (Date.now() - this.lastFlush));
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = null;
      this.lastFlush = Date.now();
      this.flush();
    }, wait);
  }

  private flush(): void {
    const state = this.viewState();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const attachment = this.attachment(socket);
      if (!attachment.hello) continue;
      const view = buildView(state, { playerId: attachment.playerId, isHost: attachment.isHost });
      const body = JSON.stringify({ type: "view", view });
      this.log("debug", "view.sent", { bytes: body.length, playerId: attachment.playerId ?? undefined });
      socket.send(body);
    }
  }

  private seedCrowd(): number {
    if (!this.meta()) {
      this.sql.exec(
        `INSERT INTO meta (code, phase, roster_locked, created_at, closed_at, host_secret_hash, schema_version)
         VALUES ('CROWD1', 'voting', 1, ?, NULL, 'hash', 2)`,
        Date.now(),
      );
    }
    for (let index = 0; index < 25; index += 1) {
      const id = `player-${index}`;
      this.sql.exec(`INSERT OR IGNORE INTO players (id, name, role, removed, last_seen, join_seq) VALUES (?, ?, 'voter', 0, ?, 1)`, id, `Player ${index}`, Date.now());
    }
    for (let index = 0; index < 10; index += 1) {
      this.sql.exec(
        `INSERT OR IGNORE INTO pitches (id, title, presenter_name, presenter_player_id, status, position, added_in_voting)
         VALUES (?, ?, ?, NULL, 'done', ?, 0)`,
        `pitch-${index}`,
        `Pitch title number ${index} with enough words to look like a real card`,
        `Presenter ${index}`,
        index + 1,
      );
    }
    const view = buildView(this.viewState(), { playerId: "player-0", isHost: true });
    return JSON.stringify({ type: "view", view }).length;
  }

  private constraintProbe(): { duplicateName: boolean; scoreRange: boolean; upsert: number } {
    let duplicateName = false;
    try {
      this.sql.exec(`INSERT INTO players (id, name, role, removed, last_seen, join_seq) VALUES ('c1', 'Ann', 'voter', 0, NULL, 1)`);
      this.sql.exec(`INSERT INTO players (id, name, role, removed, last_seen, join_seq) VALUES ('c2', 'ann', 'voter', 0, NULL, 2)`);
    } catch {
      duplicateName = true;
    }
    let scoreRange = false;
    try {
      this.sql.exec(`INSERT INTO scores (player_id, pitch_id, category, value) VALUES ('c1', 'pitch', 'hotness', 99)`);
    } catch {
      scoreRange = true;
    }
    this.sql.exec(
      `INSERT INTO scores (player_id, pitch_id, category, value) VALUES ('c1', 'pitch', 'funniness', 3)
       ON CONFLICT(player_id, pitch_id, category) DO UPDATE SET value = excluded.value`,
    );
    this.sql.exec(
      `INSERT INTO scores (player_id, pitch_id, category, value) VALUES ('c1', 'pitch', 'funniness', 4)
       ON CONFLICT(player_id, pitch_id, category) DO UPDATE SET value = excluded.value`,
    );
    const upsert = this.rows<{ value: number }>(
      `SELECT value FROM scores WHERE player_id = 'c1' AND pitch_id = 'pitch' AND category = 'funniness'`,
    )[0]?.value ?? 0;
    return { duplicateName, scoreRange, upsert };
  }

  private expirePendingHellos(): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (!this.attachment(socket).hello && socket.readyState === WebSocket.OPEN) socket.close(4001, "hello timeout");
    }
  }

  private takeToken(ws: WebSocket): boolean {
    const attachment = this.attachment(ws);
    const now = Date.now();
    const elapsed = (now - attachment.tokenAt) / 1000;
    attachment.tokens = Math.min(RATE, attachment.tokens + elapsed * RATE);
    attachment.tokenAt = now;
    if (attachment.tokens >= 1) {
      attachment.tokens -= 1;
      this.writeAttachment(ws, attachment);
      return true;
    }
    attachment.strikes += 1;
    this.writeAttachment(ws, attachment);
    this.log("warn", "rate.limited", { strikes: attachment.strikes, playerId: attachment.playerId ?? undefined });
    inc(this.sql, "rate_limited");
    if (attachment.strikes >= 3) ws.close(4008, "rate limited");
    return false;
  }

  private seqScope(ws: WebSocket, command: ClientCommand): string | null {
    if (!("clientSeq" in command)) return null;
    if (command.type === "join" || command.type === "reclaim") return `${command.type}:${command.name.toLowerCase()}`;
    const playerId = this.attachment(ws).playerId;
    if (playerId) return playerId;
    if (this.attachment(ws).isHost) return "host";
    return null;
  }

  private seen(scope: string, clientSeq: number): boolean {
    return this.rows(`SELECT 1 AS ok FROM seqs WHERE scope = ? AND client_seq = ?`, scope, clientSeq).length > 0;
  }

  private remember(scope: string, clientSeq: number): void {
    this.sql.exec(`INSERT OR IGNORE INTO seqs (scope, client_seq) VALUES (?, ?)`, scope, clientSeq);
    this.sql.exec(
      `DELETE FROM seqs WHERE scope = ? AND client_seq NOT IN (
        SELECT client_seq FROM seqs WHERE scope = ? ORDER BY client_seq DESC LIMIT 200
      )`,
      scope,
      scope,
    );
  }

  private async hostOk(secret: string, hash: string): Promise<boolean> {
    return safeEqual(await sha256(secret), hash);
  }

  private meta(): Meta | null {
    const rows = this.rows<Meta>(
      `SELECT code, phase, roster_locked, created_at, closed_at, host_secret_hash, schema_version FROM meta`,
    );
    return rows[0] ?? null;
  }

  private playerRows(): PlayerRow[] {
    return this.rows<PlayerRow>(`SELECT id, name, role, removed, last_seen, join_seq FROM players ORDER BY rowid`);
  }

  private playerById(id: string): PlayerRow | null {
    return this.rows<PlayerRow>(`SELECT id, name, role, removed, last_seen, join_seq FROM players WHERE id = ?`, id)[0] ?? null;
  }

  private playerByName(name: string): PlayerRow | null {
    return (
      this.rows<PlayerRow>(`SELECT id, name, role, removed, last_seen, join_seq FROM players WHERE name = ? COLLATE NOCASE`, name)[0] ??
      null
    );
  }

  private pitchRows(): PitchRow[] {
    return this.rows<PitchRow>(
      `SELECT id, title, presenter_name, presenter_player_id, status, position, added_in_voting FROM pitches ORDER BY position`,
    );
  }

  private pitch(id: string): PitchRow | null {
    return this.pitchRows().find((row) => row.id === id) ?? null;
  }

  private ballots(): Ballot[] {
    return this.rows<{ player_id: string; order_json: string; placed_json: string; submitted: number }>(
      `SELECT player_id, order_json, placed_json, submitted FROM ballots`,
    ).map((row) => ({
      playerId: row.player_id,
      order: JSON.parse(row.order_json) as string[],
      placed: JSON.parse(row.placed_json) as string[],
      submitted: row.submitted === 1,
    }));
  }

  private ballot(playerId: string): { order: string[]; placed: string[] } | null {
    return this.ballots().find((ballot) => ballot.playerId === playerId) ?? null;
  }

  private ballotSubmitted(playerId: string): boolean {
    return this.ballots().find((ballot) => ballot.playerId === playerId)?.submitted ?? false;
  }

  private saveBallot(playerId: string, order: string[], placed: string[], submitted: boolean): void {
    this.sql.exec(
      `INSERT INTO ballots (player_id, order_json, placed_json, submitted, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET order_json = excluded.order_json, placed_json = excluded.placed_json, submitted = excluded.submitted`,
      playerId,
      JSON.stringify(order),
      JSON.stringify(placed),
      submitted ? 1 : 0,
      Date.now(),
    );
  }

  private host(attachment: Attachment): boolean {
    return attachment.isHost;
  }

  private touch(playerId: string | null): void {
    if (!playerId) return;
    this.sql.exec(`UPDATE players SET last_seen = ? WHERE id = ?`, Date.now(), playerId);
  }

  private noteDisconnect(ws: WebSocket): void {
    const attachment = this.attachment(ws);
    if (attachment.playerId) this.sql.exec(`INSERT OR IGNORE INTO disconnected (player_id) VALUES (?)`, attachment.playerId);
    this.log("info", "ws.disconnected", { playerId: attachment.playerId ?? undefined, ws_connections: this.ctx.getWebSockets().length });
  }

  private onWriteFailed(ws: WebSocket, error: unknown): void {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "forced tally error") {
      this.log("error", "client.error", { alert: ALERT_A2.code, message });
      this.send(ws, { type: "error", code: "tally_failed" });
      this.send(ws, { type: "serverAlert", alert: ALERT_A2 });
      return;
    }
    inc(this.sql, "writes_failed");
    this.log("error", "write.failed", { message });
    this.send(ws, { type: "error", code: "write_failed" });
    this.send(ws, { type: "serverAlert", alert: ALERT_A1 });
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === ws) continue;
      if (this.attachment(socket).isHost) this.send(socket, { type: "serverAlert", alert: ALERT_A1 });
    }
  }

  private raiseTally(error: unknown): void {
    this.log("error", "client.error", { alert: ALERT_A2.code, message: error instanceof Error ? error.message : "unknown" });
    for (const socket of this.ctx.getWebSockets()) {
      if (!this.attachment(socket).isHost) continue;
      this.send(socket, { type: "serverAlert", alert: ALERT_A2 });
    }
  }

  private reject(ws: WebSocket, code: string, clientSeq?: number, missing?: unknown): void {
    inc(this.sql, "writes_failed");
    this.log("warn", "write.rejected", { code, playerId: this.attachment(ws).playerId ?? undefined });
    this.send(ws, { type: "error", code, clientSeq, missing });
  }

  private send(ws: WebSocket, body: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(body));
  }

  private freshAttachment(): Attachment {
    return { hello: false, playerId: null, isHost: false, strikes: 0, tokens: RATE, tokenAt: Date.now() };
  }

  private attachment(ws: WebSocket): Attachment {
    const stored = ws.deserializeAttachment() as Attachment | null;
    return stored ?? this.freshAttachment();
  }

  private writeAttachment(ws: WebSocket, attachment: Attachment): void {
    ws.serializeAttachment(attachment);
  }

  private rows<T>(query: string, ...values: unknown[]): T[] {
    return [...this.sql.exec<T>(query, ...values)];
  }

  private log(level: "debug" | "info" | "warn" | "error", event: Parameters<typeof log>[0]["event"], fields: Record<string, unknown>): void {
    const meta = this.safeMeta();
    log({
      minLevel: this.env.LOG_LEVEL,
      level,
      event,
      secrets: this.env.CREATE_KEY ? [this.env.CREATE_KEY] : [],
      fields: { reqId: meta?.code ?? "session", sessionCode: meta?.code, ...fields },
    });
  }

  private safeMeta(): Meta | null {
    try {
      return this.meta();
    } catch {
      return null;
    }
  }
}
