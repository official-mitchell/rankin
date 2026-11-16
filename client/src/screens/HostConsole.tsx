// Host pitch manager, phase confirms, waiting list, and raw export (checklist 7.1–7.3).
// Closed keeps title and presenter-name rename and drops every other write (checklist 10.2).
// Closed also offers CSV, Markdown, and chart downloads (checklist 11).
import { TITLE_MAX, type Phase, type PitchStatus } from "@we-rankin/shared";
import { useState } from "react";
import type { WriteBody } from "../realtime/queue";

export type HostPlayer = { id: string; name: string; role: "voter" | "spectator"; connected: boolean; submitted: boolean };

export type HostPitch = { id: string; title: string; presenterName: string; presenterId: string | null; status: PitchStatus };

export type HostCounters = { writes_failed: number; reconnects: number; connected: number };

export function pitchTitleError(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "Enter a title.";
  if ([...trimmed].length > TITLE_MAX) return "Title must be 80 characters or fewer.";
  return null;
}

export function voterCount(players: HostPlayer[]): number {
  return players.filter((player) => player.role === "voter").length;
}

export function unsubmittedNames(players: HostPlayer[]): string[] {
  return players.filter((player) => player.role === "voter" && !player.submitted).map((player) => player.name);
}

export function phaseCopy(phase: Phase, players: HostPlayer[]): { next: string; effect: string; confirm: string } | null {
  const voters = voterCount(players);
  if (phase === "lobby") {
    return { next: "Start pitching", effect: `Locks roster: ${voters} voters`, confirm: "Lock roster" };
  }
  if (phase === "pitching") {
    return { next: "Open voting", effect: `Creates ${voters} ballots`, confirm: "Open voting" };
  }
  if (phase === "voting") {
    const names = unsubmittedNames(players);
    const voids = names.length === 0 ? "none" : names.join(", ");
    return {
      next: "Close voting",
      effect: `Voids: ${voids}`,
      confirm: names.length === 0 ? "Close voting" : `Close & void ${names.length} ballots`,
    };
  }
  return null;
}

const STATUS_LABEL: Record<PitchStatus, string> = {
  upcoming: "Upcoming",
  presenting: "Now presenting",
  done: "Done",
};

export function HostConsole({
  code,
  phase,
  players,
  pitches,
  counters,
  hostLink,
  presenterLocked = false,
  initialConfirm = null,
  debugOpen = false,
  onWrite,
  onDownload,
  onExport,
  onCopy,
}: {
  code: string;
  phase: Phase;
  players: HostPlayer[];
  pitches: HostPitch[];
  counters: HostCounters;
  hostLink: string;
  presenterLocked?: boolean;
  initialConfirm?: "phase" | null;
  debugOpen?: boolean;
  onWrite?: (body: WriteBody) => void;
  onDownload?: () => void;
  onExport?: (kind: "ballots" | "summary" | "markdown" | "charts", names: boolean) => void;
  onCopy?: (text: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [presenterId, setPresenterId] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renamePresenter, setRenamePresenter] = useState("");
  const [confirmPhase, setConfirmPhase] = useState(initialConfirm === "phase");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(debugOpen);
  const [includeNames, setIncludeNames] = useState(false);
  const [confirmNames, setConfirmNames] = useState(false);
  const copy = phaseCopy(phase, players);
  const locked = presenterLocked || phase === "voting" || phase === "closed";
  const waiting = phase === "voting" || phase === "closed" ? unsubmittedNames(players) : [];
  const voters = voterCount(players);
  const remove = pitches.find((pitch) => pitch.id === removeId) ?? null;

  function addPitch(): void {
    const error = pitchTitleError(title);
    setFormError(error);
    if (error) return;
    const player = players.find((entry) => entry.id === presenterId);
    onWrite?.({
      type: "host.addPitch",
      title: title.trim(),
      presenterName: (player ? player.name : presenterName).trim() || "Not a player",
      presenterPlayerId: presenterId || null,
    });
    setTitle("");
    setPresenterName("");
    setPresenterId("");
  }

  return (
    <div className="row host-console">
      <section className="panel panel--inset-frame host-bar row">
        <p className="eyebrow">{phase}</p>
        {copy ? (
          <button type="button" className="btn btn--primary btn--block" onClick={() => setConfirmPhase(true)}>
            {copy.next}
          </button>
        ) : null}
        <button type="button" className="btn btn--secondary btn--block" onClick={() => onCopy?.(hostLink)}>
          Copy host link
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => onDownload?.()}>
          Download raw JSON
        </button>
      </section>

      {phase === "closed" ? (
        <section className="panel row">
          <p className="eyebrow">Exports</p>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => (includeNames ? setIncludeNames(false) : setConfirmNames(true))}>
            {includeNames ? "Names included" : "Include names"}
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => onExport?.("ballots", includeNames)}>
            Download ballots CSV
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => onExport?.("summary", includeNames)}>
            Download summary CSV
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => onExport?.("markdown", includeNames)}>
            Download Markdown
          </button>
          <button type="button" className="btn btn--gold btn--block" onClick={() => onExport?.("charts", false)}>
            Download all
          </button>
        </section>
      ) : null}

      {phase !== "closed" ? (
        <form
          className="panel row"
          onSubmit={(event) => {
            event.preventDefault();
            addPitch();
          }}
        >
          <p className="eyebrow">Add a pitch</p>
          <label className="field">
            <span className="label-caps">Title</span>
            <input className="input" value={title} maxLength={TITLE_MAX + 8} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span className="label-caps">Presenter</span>
            <select
              className="input"
              value={presenterId}
              disabled={locked}
              onChange={(event) => {
                const id = event.target.value;
                setPresenterId(id);
                const player = players.find((entry) => entry.id === id);
                if (player) setPresenterName(player.name);
              }}
            >
              <option value="">Not a player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label-caps">Presenter name</span>
            <input className="input" value={presenterName} disabled={locked} onChange={(event) => setPresenterName(event.target.value)} />
          </label>
          {formError ? <p className="toast">{formError}</p> : null}
          <button type="submit" className="btn btn--secondary btn--block">
            Add pitch
          </button>
        </form>
      ) : null}

      <section className="panel panel--quiet row">
        <p className="eyebrow">Pitches</p>
        <ul className="roster">
          {pitches.length === 0 ? <li><span className="roster__name">No pitches yet</span></li> : null}
          {pitches.map((pitch) => (
            <li key={pitch.id}>
              <span className={`status-pill ${pitch.status === "presenting" ? "status-pill--live" : pitch.status === "done" ? "status-pill--done" : "status-pill--next"}`}>
                {STATUS_LABEL[pitch.status]}
              </span>
              <span className="roster__name">
                {pitch.title}
                <span className="label"> · {pitch.presenterName}</span>
              </span>
              {phase === "pitching" && pitch.status !== "presenting" ? (
                <button type="button" className="btn btn--gold btn--block" onClick={() => onWrite?.({ type: "host.setStatus", pitchId: pitch.id, status: "presenting" })}>
                  Now presenting
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setRenameId(pitch.id);
                  setRenameTitle(pitch.title);
                  setRenamePresenter(pitch.presenterName);
                }}
              >
                Rename
              </button>
              {phase !== "closed" ? (
                <button type="button" className="btn btn--secondary" onClick={() => setRemoveId(pitch.id)}>
                  Remove
                </button>
              ) : null}
              {renameId === pitch.id ? (
                <div className="field">
                  <label className="field">
                    <span className="label-caps">New title</span>
                    <input className="input" value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label-caps">Presenter name</span>
                    <input className="input" value={renamePresenter} onChange={(event) => setRenamePresenter(event.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="btn btn--secondary btn--block"
                    onClick={() => {
                      const error = pitchTitleError(renameTitle);
                      setFormError(error);
                      if (error || !renamePresenter.trim()) return;
                      onWrite?.({ type: "host.updatePitch", pitchId: pitch.id, title: renameTitle.trim(), presenterName: renamePresenter.trim() });
                      setRenameId(null);
                    }}
                  >
                    Save title
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {phase === "voting" ? (
        <section className="panel panel--quiet">
          {waiting.length === 0 ? (
            <p className="eyebrow">All ballots in ★</p>
          ) : (
            <>
              <p className="eyebrow">Awaiting ballots · {waiting.length} of {voters}</p>
              <ul className="waiting">
                {waiting.map((name) => (
                  <li key={name}>
                    <i className="led led--wait" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <section className="panel panel--quiet row">
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setShowDebug((open) => !open)}>
          Debug
        </button>
        {showDebug ? (
          <dl className="debug-counts">
            <div><dt>writes_failed</dt><dd>{counters.writes_failed}</dd></div>
            <div><dt>reconnects</dt><dd>{counters.reconnects}</dd></div>
            <div><dt>connected</dt><dd>{counters.connected}</dd></div>
            <div><dt>session</dt><dd>{code}</dd></div>
          </dl>
        ) : null}
      </section>

      {confirmPhase && copy ? (
        <div className="modal-scrim" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="phase-title">
            <h3 className="modal__title" id="phase-title">{copy.next}?</h3>
            <p className="link-line">{copy.effect}</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirmPhase(false)}>
                Keep
              </button>
              <button
                type="button"
                className="btn btn--danger btn--block"
                data-commit="phase"
                onClick={() => {
                  setConfirmPhase(false);
                  if (phase === "lobby") onWrite?.({ type: "host.startPitching" });
                  if (phase === "pitching") onWrite?.({ type: "host.openVoting" });
                  if (phase === "voting") onWrite?.({ type: "host.closeVoting" });
                }}
              >
                {copy.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmNames ? (
        <div className="modal-scrim" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="names-title">
            <h3 className="modal__title" id="names-title">Include names?</h3>
            <p className="link-line">de-anonymizes ballots</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirmNames(false)}>
                Keep anonymous
              </button>
              <button
                type="button"
                className="btn btn--danger btn--block"
                onClick={() => {
                  setIncludeNames(true);
                  setConfirmNames(false);
                }}
              >
                Include names
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {remove ? (
        <div className="modal-scrim" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="remove-title">
            <h3 className="modal__title" id="remove-title">Remove {remove.title}?</h3>
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary btn--block" onClick={() => setRemoveId(null)}>
                Keep
              </button>
              <button
                type="button"
                className="btn btn--danger btn--block"
                onClick={() => {
                  onWrite?.({ type: "host.removePitch", pitchId: remove.id });
                  setRemoveId(null);
                }}
              >
                Remove pitch
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
