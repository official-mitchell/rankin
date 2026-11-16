// Session route wiring for checklist 5 and the notes screen (checklist 8). Closed shows results and locks writes (checklist 10).
// Host exports CSV, Markdown, and chart PNGs after close (checklist 11).
import { useEffect, useRef, useState } from "react";
import type { ChartPitch, ClientView, ServerAlert } from "@we-rankin/shared";
import { chartFiles, saveBlob } from "../screens/chart-file";
import { hostSecretKey } from "../host-secret";
import { HostConsole } from "../screens/HostConsole";
import { Notes } from "../screens/Notes";
import { RankList } from "../screens/Rank";
import { waitingOn, myMissing } from "./store";
import { JoinPanel } from "../screens/JoinPanel";
import { readPlayerId, writePlayerId } from "../screens/identity";
import { hostLinkKey } from "../screens/links";
import { ResultsBoard } from "../screens/Results";
import { Roster } from "../screens/Roster";
import { Shell } from "../Shell";
import { AlertBanner } from "./AlertBanner";
import { ConnectionManager, type ConnectionStatus } from "./connection";
import { ack, enqueue, paintPending, rejectWrite, wireMessage, type WriteBody } from "./queue";
import { connectionLabel, emptyState, type RealtimeState } from "./store";

export function SessionScreen({
  code,
  socket,
  onSend,
  lab = false,
}: {
  code: string;
  socket?: (url: string) => WebSocket;
  onSend?: (message: unknown) => void;
  lab?: boolean;
}) {
  const [state, setState] = useState<RealtimeState>(emptyState);
  const [tab, setTab] = useState<"Notes" | "Rank" | "Players">("Notes");
  const [joinIssue, setJoinIssue] = useState<"name_taken" | "name_in_use" | null>(null);
  const stateRef = useRef(state);
  const managerRef = useRef<ConnectionManager | null>(null);
  const onSendRef = useRef(onSend);
  stateRef.current = state;
  onSendRef.current = onSend;

  useEffect(() => {
    const manager = new ConnectionManager({
      code,
      playerId: readPlayerId(code, window.localStorage, document.cookie),
      hostSecret: window.localStorage.getItem(hostSecretKey(code)),
      socket: socket ?? ((url) => new WebSocket(url)),
      onView: (view) => {
        const current = stateRef.current;
        const painted = paintPending(view, current.pending);
        const next = { ...current, view: painted };
        stateRef.current = next;
        setState(next);
      },
      onAck: (clientSeq) => {
        const current = stateRef.current;
        const result = ack(current.view, current.pending, clientSeq);
        const next = { ...current, ...result, toast: null };
        stateRef.current = next;
        setState(next);
      },
      onCommandError: (clientSeq, codeText) => {
        const current = stateRef.current;
        const result = rejectWrite(current.view, current.pending, clientSeq);
        if (codeText === "name_taken" || codeText === "name_in_use") setJoinIssue(codeText);
        const next = { ...current, view: result.view, pending: result.pending, toast: codeText === "name_taken" || codeText === "name_in_use" ? null : `${result.toast} (${codeText})` };
        stateRef.current = next;
        setState(next);
      },
      onAlert: (alert) => {
        const next = { ...stateRef.current, alert };
        stateRef.current = next;
        setState(next);
      },
      onStatus: (status, reconnect) => {
        const current = stateRef.current;
        if (status === "online") {
          if (reconnect) console.debug("queue depth", current.pending.length);
          for (const item of current.pending) {
            const message = wireMessage(item);
            manager.send(message);
            onSendRef.current?.(message);
          }
        }
        const next = { ...current, status };
        stateRef.current = next;
        setState(next);
      },
    });
    managerRef.current = manager;
    manager.start();
    return () => manager.stop();
  }, [code, socket]);

  function write(body: WriteBody): void {
    const current = stateRef.current;
    const result = enqueue(current.view, current.pending, body, current.lastSeq);
    const item = result.pending[result.pending.length - 1];
    const next = { ...current, view: result.view, pending: result.pending, lastSeq: result.lastSeq, toast: null };
    stateRef.current = next;
    setState(next);
    if (item && current.status === "online") {
      const message = wireMessage(item);
      managerRef.current?.send(message);
      onSendRef.current?.(message);
    }
  }

  async function download(): Promise<void> {
    const secret = window.localStorage.getItem(hostSecretKey(code)) ?? "";
    const response = await fetch(`/api/s/${code}/export`, { headers: { "x-host-secret": secret } });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${code}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExport(kind: "ballots" | "summary" | "markdown" | "charts", names: boolean): Promise<void> {
    const secret = window.localStorage.getItem(hostSecretKey(code)) ?? "";
    const response = await fetch(`/api/s/${code}/export?format=${kind}&names=${names ? "1" : "0"}`, { headers: { "x-host-secret": secret } });
    if (kind === "charts") {
      const body = (await response.json()) as { pitches: ChartPitch[] };
      for (const file of await chartFiles(body.pitches)) saveBlob(file.png, file.name);
      return;
    }
    saveBlob(await response.blob(), kind === "ballots" ? "ballots.csv" : kind === "summary" ? "summary.csv" : "results.md");
  }

  const playerId = state.view?.self?.playerId ?? null;
  useEffect(() => {
    if (!playerId) return;
    document.cookie = writePlayerId(code, playerId, window.localStorage);
  }, [code, playerId]);

  const label = connectionLabel(state.status, state.pending.length);
  const isHost = Boolean(state.view?.self?.isHost);
  const joined = Boolean(playerId);
  return (
    <Shell phase={state.view?.phase ?? "lobby"} tab={tab} onTab={setTab} conn={label} status={state.status}>
      <section className="session-screen" data-status={state.status} data-conn={label} data-applied={state.pending.map((item) => item.clientSeq).join(",")} data-player={playerId ?? ""}>
        <AlertBanner alert={state.alert} isHost={isHost} onDownload={() => void download()} />
        {state.view?.phase === "voting" ? (
          <p className="notice waiting-banner">
            {waitingOn({ ...state, view: state.view }).length === 0 ? "All ballots in" : `Waiting on: ${waitingOn({ ...state, view: state.view }).join(", ")}`}
          </p>
        ) : null}
        {state.toast ? (
          <p className="toast" role="status">
            {state.toast}
          </p>
        ) : null}
        {lab ? <QueueButtons onWrite={write} /> : null}
        {!lab && !joined ? (
          <JoinPanel
            code={code}
            issue={joinIssue}
            onJoin={(name) => {
              setJoinIssue(null);
              write({ type: "join", name });
            }}
            onReclaim={(name) => {
              setJoinIssue(null);
              write({ type: "reclaim", name });
            }}
          />
        ) : null}
        {!lab && joined && state.view?.phase === "closed" && state.view.results ? (
          <ResultsBoard
            results={state.view.results}
            pitches={state.view.pitches.map((pitch) => ({ id: pitch.id, title: pitch.title }))}
            players={state.view.players.map((player) => ({ id: player.id, name: player.name }))}
          />
        ) : null}
        {!lab && joined && tab === "Notes" ? (
          <Notes
            phase={state.view?.phase ?? "lobby"}
            selfId={playerId}
            pitches={state.view?.pitches ?? []}
            scores={(state.view?.scores ?? []).map((score) => ({ pitchId: score.pitchId, category: score.category, value: score.value }))}
            chips={state.view?.chips ?? []}
            saved={state.status === "online" && state.pending.length === 0}
            onWrite={write}
          />
        ) : null}
        {!lab && joined && tab === "Rank" && state.view?.ballot ? (
          <RankList
            order={state.view.ballot.order}
            placed={state.view.ballot.placed}
            pitches={(state.view.pitches ?? []).map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenterName }))}
            scores={(state.view.scores ?? []).map((score) => ({ pitchId: score.pitchId, category: score.category, value: score.value }))}
            chips={state.view.chips ?? []}
            missing={myMissing(state)}
            submitted={state.view.ballot.submitted}
            locked={state.view.phase === "closed"}
            onWrite={write}
          />
        ) : null}
        {!lab && joined && tab === "Rank" && !state.view?.ballot ? <p className="notice">Ballots open with voting.</p> : null}
        {!lab && joined && tab === "Players" && isHost ? (
          <HostConsole
            code={code}
            phase={state.view?.phase ?? "lobby"}
            players={state.view?.players ?? []}
            pitches={(state.view?.pitches ?? []).map((pitch) => ({
              id: pitch.id,
              title: pitch.title,
              presenterName: pitch.presenterName,
              presenterId: pitch.presenterId,
              status: pitch.status,
            }))}
            counters={{
              writes_failed: state.view?.host?.writes_failed ?? 0,
              reconnects: state.view?.host?.reconnects ?? 0,
              connected: state.view?.host?.connected ?? 0,
            }}
            hostLink={window.localStorage.getItem(hostLinkKey(code)) ?? ""}
            onWrite={write}
            onDownload={() => void download()}
            onExport={(kind, names) => void downloadExport(kind, names)}
            onCopy={(text) => void navigator.clipboard.writeText(text)}
          />
        ) : null}
        {!lab && joined && tab === "Players" ? (
          <Roster
            players={(state.view?.players ?? []).map((player) => ({ ...player, host: isHost && player.id === playerId }))}
            pitches={(state.view?.pitches ?? []).map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenterName }))}
            isHost={isHost}
            spectator={state.view?.self?.role === "spectator"}
            phase={state.view?.phase ?? "lobby"}
            onAction={(action, name) => {
              if (action === "promote" && name) write({ type: "host.promote", name });
              if (action === "remove" && name) write({ type: "host.removePlayer", name });
              if (action === "release" && name) write({ type: "host.releaseName", name });
            }}
          />
        ) : null}
      </section>
    </Shell>
  );
}

function QueueButtons({ onWrite }: { onWrite: (body: WriteBody) => void }) {
  return (
    <div className="queue-lab">
      <button type="button" onClick={() => onWrite({ type: "setScore", pitchId: "p", category: "funniness", value: 3 })}>
        Score one
      </button>
      <button type="button" onClick={() => onWrite({ type: "setScore", pitchId: "p", category: "funniness", value: 4 })}>
        Score two
      </button>
    </div>
  );
}

export function replaceView(view: ClientView, pending: RealtimeState["pending"]): ClientView {
  return paintPending(view, pending);
}

export function statusLabel(status: ConnectionStatus, pending: number): string {
  return connectionLabel(status, pending);
}

export type { ServerAlert };
