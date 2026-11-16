// Session route wiring for checklist 5.1–5.4.
import { useEffect, useRef, useState } from "react";
import type { ClientView, ServerAlert } from "@we-rankin/shared";
import { hostSecretKey } from "../host-secret";
import { JoinPanel } from "../screens/JoinPanel";
import { readPlayerId, writePlayerId } from "../screens/identity";
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
  const [tab, setTab] = useState<"Notes" | "Rank" | "Players">("Players");
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
        {!lab && joined ? (
          <Roster
            players={(state.view?.players ?? []).map((player) => ({ ...player, host: isHost && player.id === playerId }))}
            pitches={(state.view?.pitches ?? []).map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenterName }))}
            isHost={isHost}
            spectator={state.view?.self?.role === "spectator"}
            phase={state.view?.phase ?? "lobby"}
            onAction={(action, name) => {
              if (action === "start") write({ type: "host.startPitching" });
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
