// Session route wiring for checklist 5 and the notes screen (checklist 8). Closed shows results and locks writes (checklist 10). An empty lobby explains the player link and can load sample pitches. The session links stay on screen.
// Host exports CSV, Markdown, and chart PNGs after close (checklist 11). The closed panel can reopen results after a reload.
import { useEffect, useRef, useState } from "react";
import type { ChartPitch, ClientView, ServerAlert } from "@we-rankin/shared";
import { chartFiles, saveBlob } from "../screens/chart-file";
import { hostSecretKey, rememberPlayer, touchSession } from "../host-secret";
import { DebugDock, HostConsole } from "../screens/HostConsole";
import { Notes, type NotePitch } from "../screens/Notes";
import { RankList } from "../screens/Rank";
import { waitingOn, myMissing } from "./store";
import { JoinPanel } from "../screens/JoinPanel";
import { readPlayerId, writePlayerId } from "../screens/identity";
import { hostLinkKey, sessionLinks } from "../screens/links";
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
  const [notesReady, setNotesReady] = useState(false);
  const [rankAlert, setRankAlert] = useState(false);
  const [offerResults, setOfferResults] = useState(false);
  const [seeResults, setSeeResults] = useState(false);
  const [samples, setSamples] = useState<NotePitch[]>([]);
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
        const next = { ...current, view: painted, alert: null };
        const self = painted.self;
        if (self?.playerId) {
          const name = painted.players.find((player) => player.id === self.playerId)?.name;
          if (name) rememberPlayer(code, name, window.localStorage);
          else touchSession(code, window.localStorage);
        } else if (window.localStorage.getItem(hostSecretKey(code))) {
          touchSession(code, window.localStorage);
        }
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
    <Shell phase={state.view?.phase ?? "lobby"} tab={isHost ? tab : tab === "Players" ? "Notes" : tab} onTab={(next) => { if (next === "Rank" && !notesReady) return; if (next === "Rank") setRankAlert(false); setTab(next); }} conn={label} status={state.status} showPlayers={isHost} showTabs={!seeResults} showConn={state.status !== "online" || state.pending.length > 0} rankLocked={!notesReady} rankAlert={rankAlert} {...(joined ? { onBack: leaveSession } : {})}>
      <section className="session-screen" data-status={state.status} data-conn={label} data-applied={state.pending.map((item) => item.clientSeq).join(",")} data-player={playerId ?? ""}>
        <AlertBanner alert={state.alert} isHost={isHost} onDownload={() => void download()} />
        {joined && isHost ? (
          <SessionDetails
            code={code}
            hostLink={isHost ? window.localStorage.getItem(hostLinkKey(code)) ?? "" : ""}
            ended={state.view?.phase === "closed"}
            onEnd={() => {
              write({ type: "host.closeVoting" });
              setOfferResults(true);
            }}
          />
        ) : null}
        {joined && (state.view?.pitches.length ?? 0) === 0 && (state.view?.phase ?? "lobby") === "lobby" ? (
          <section className="panel panel--quiet row">
            <p className="notice">Share the player link. People who open it join this lobby. Then add pitches on Players.</p>
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => setSamples((current) => (current.length > 0 ? [] : samplePitches()))}
            >
              {samples.length > 0 ? "Hide sample score cards" : "Show sample score cards"}
            </button>
          </section>
        ) : null}
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
        {offerResults && !seeResults ? (
          <div className="modal-scrim modal-scrim--center">
            <div className="modal" role="dialog" aria-labelledby="view-results-title">
              <h3 className="modal__title" id="view-results-title">Session ended</h3>
              <p>Scoring and ranking are closed. Go view the results.</p>
              <div className="modal__actions">
                <button type="button" className="btn btn--primary btn--block" onClick={() => setSeeResults(true)}>
                  View results
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {!lab && joined && seeResults && !(state.view?.phase === "closed" && state.view.results) ? (
          <section className="panel panel--quiet row">
            <p className="notice">Results are on the way.</p>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => write({ type: "host.closeVoting" })}>
              Close and tally again
            </button>
          </section>
        ) : null}
        {!lab && joined && seeResults && state.view?.phase === "closed" && state.view.results ? (
          <ResultsBoard
            results={state.view.results}
            pitches={state.view.pitches.map((pitch) => ({ id: pitch.id, title: pitch.title, presenterName: pitch.presenterName }))}
            players={state.view.players.map((player) => ({ id: player.id, name: player.name }))}
            onNewSession={() => {
              window.history.pushState(null, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          />
        ) : null}
        {!lab && joined && !seeResults && tab === "Notes" ? (
          <Notes
            phase={state.view?.phase ?? "lobby"}
            selfId={playerId}
            selfName={state.view?.players.find((player) => player.id === playerId)?.name ?? null}
            pitches={state.view?.pitches ?? []}
            scores={(state.view?.scores ?? []).map((score) => ({ pitchId: score.pitchId, category: score.category, value: score.value }))}
            chips={state.view?.chips ?? []}
            saved={state.status === "online" && state.pending.length === 0}
            samples={samples}
            onWrite={write}
            onAddSample={(pitch) => write({ type: "host.addPitch", title: pitch.title, presenterName: pitch.presenterName, presenterPlayerId: null })}
            onSubmit={() => {
              setNotesReady(true);
              setRankAlert(true);
            }}
          />
        ) : null}
        {!lab && joined && !seeResults && tab === "Rank" && state.view?.ballot ? (
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
        {!lab && joined && !seeResults && tab === "Players" && isHost ? (
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
            onViewResults={() => setSeeResults(true)}
            hideDebug
          />
        ) : null}
        {!lab && joined && !seeResults && tab === "Players" ? (
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
        {isHost && !seeResults ? (
          <DebugDock
            code={code}
            counters={{
              writes_failed: state.view?.host?.writes_failed ?? 0,
              reconnects: state.view?.host?.reconnects ?? 0,
              connected: state.view?.host?.connected ?? 0,
            }}
          />
        ) : null}
      </section>
    </Shell>
  );
}

function leaveSession(): void {
  window.history.pushState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function samplePitches(): NotePitch[] {
  return [
    { id: "sample-night", title: "Night market", presenterName: "Ada", presenterId: null, status: "presenting" },
    { id: "sample-plane", title: "Paper plane", presenterName: "Bo", presenterId: null, status: "done" },
    { id: "sample-call", title: "Last call", presenterName: "Cid", presenterId: null, status: "done" },
  ];
}

function SessionDetails({
  code,
  hostLink,
  ended = false,
  onEnd,
}: {
  code: string;
  hostLink: string;
  ended?: boolean;
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const links = sessionLinks(window.location.origin, code, "");
  const player = links.player;
  return (
    <section className="panel panel--quiet row">
      <button type="button" className="btn btn--ghost btn--block" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {open ? "Hide session details" : `Session ${code}`}
      </button>
      {ended ? null : (
        <button type="button" className="btn btn--danger btn--block" onClick={() => setConfirmEnd(true)}>
          End session
        </button>
      )}
      {confirmEnd ? (
        <div className="modal-scrim modal-scrim--center">
          <div className="modal" role="dialog" aria-labelledby="end-session-title">
            <h3 className="modal__title" id="end-session-title">End this session?</h3>
            <p>Scoring and ranking stop. You will see the results.</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirmEnd(false)}>
                Keep going
              </button>
              <button
                type="button"
                className="btn btn--danger btn--block"
                onClick={() => {
                  setConfirmEnd(false);
                  onEnd();
                }}
              >
                End session
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {open ? (
        <>
          <p className="label">Player Link:</p>
          <p className="link-line">{player}</p>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => void navigator.clipboard.writeText(player)}>
            Copy player link
          </button>
          {hostLink ? (
            <>
              <p className="label">Host Link:</p>
              <p className="link-line">{hostLink}</p>
              <button type="button" className="btn btn--secondary btn--block" onClick={() => void navigator.clipboard.writeText(hostLink)}>
                Copy host link
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </section>
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
