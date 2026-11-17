// Host pitch manager, phase confirms, waiting list, and raw export (checklist 7.1–7.3). Pitch cards are the presentation order: drag the handle to reorder.
// Closed keeps title and presenter-name rename and drops every other write (checklist 10.2). The presenter list is everyone in the lobby, plus names the game master adds for people who present without joining.
// Closed also offers CSV, Markdown, and chart downloads (checklist 11), and a way back to the results board after a reload.
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TITLE_MAX, type Phase, type PitchStatus } from "@we-rankin/shared";
import { useState, type ReactNode } from "react";
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
  hideDebug = false,
  onWrite,
  onDownload,
  onExport,
  onCopy,
  onViewResults,
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
  hideDebug?: boolean;
  onWrite?: (body: WriteBody) => void;
  onDownload?: () => void;
  onExport?: (kind: "ballots" | "summary" | "markdown" | "charts", names: boolean) => void;
  onCopy?: (text: string) => void;
  onViewResults?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [presenterId, setPresenterId] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renamePresenter, setRenamePresenter] = useState("");
  const [renamePresenterId, setRenamePresenterId] = useState("");
  const [confirmPhase, setConfirmPhase] = useState(initialConfirm === "phase");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [includeNames, setIncludeNames] = useState(false);
  const [confirmNames, setConfirmNames] = useState(false);
  const copy = phaseCopy(phase, players);
  const locked = presenterLocked || phase === "voting" || phase === "closed";
  const waiting = phase === "voting" || phase === "closed" ? unsubmittedNames(players) : [];
  const voters = voterCount(players);
  const remove = pitches.find((pitch) => pitch.id === removeId) ?? null;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent): void {
    const overId = event.over?.id;
    if (phase === "closed" || !overId || event.active.id === overId) return;
    const ids = pitches.map((pitch) => pitch.id);
    const from = ids.indexOf(String(event.active.id));
    const to = ids.indexOf(String(overId));
    if (from < 0 || to < 0) return;
    onWrite?.({ type: "host.reorderPitches", pitchIds: arrayMove(ids, from, to) });
  }

  function addPitch(): void {
    const error = pitchTitleError(title);
    setFormError(error);
    if (error) return;
    const player = players.find((entry) => entry.id === presenterId);
    const guest = presenterId.startsWith("guest:") ? presenterId.slice("guest:".length) : "";
    onWrite?.({
      type: "host.addPitch",
      title: title.trim(),
      presenterName: (player ? player.name : guest || presenterName).trim() || "Presenter",
      presenterPlayerId: player ? player.id : null,
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
        {phase === "closed" && onViewResults ? (
          <button type="button" className="btn btn--primary btn--block" onClick={onViewResults}>
            View results
          </button>
        ) : null}
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
                if (id.startsWith("guest:")) setPresenterName(id.slice("guest:".length));
              }}
            >
              <option value="">Someone who has not joined</option>
              {guests.map((name) => (
                <option key={name} value={`guest:${name}`}>
                  {name}
                </option>
              ))}
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <p className="notice">Joined players are listed above. Add a presenter who will not join the lobby.</p>
          {presenterId === "" ? (
            <label className="field">
              <span className="label-caps">Presenter name</span>
              <input className="input" value={presenterName} disabled={locked} onChange={(event) => setPresenterName(event.target.value)} />
              <button
                type="button"
                className="btn btn--ghost btn--block"
                disabled={locked || !presenterName.trim()}
                onClick={() => {
                  const name = presenterName.trim();
                  if (!name || guests.includes(name) || players.some((player) => player.name === name)) return;
                  setGuests((current) => [...current, name]);
                  setPresenterId(`guest:${name}`);
                }}
              >
                Add presenter
              </button>
            </label>
          ) : null}
          {formError ? <p className="toast">{formError}</p> : null}
          <button type="submit" className="btn btn--secondary btn--block">
            Add pitch
          </button>
        </form>
      ) : null}

      <section className="panel panel--quiet row">
        <p className="eyebrow">Pitches</p>
        {pitches.length === 0 ? <p className="notice">No pitches yet</p> : null}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={pitches.map((pitch) => pitch.id)} strategy={verticalListSortingStrategy}>
        {pitches.map((pitch, index) => (
          <DragCard key={pitch.id} id={pitch.id} index={index} disabled={phase === "closed"}>
            <h3 className="card-title">{pitch.title}</h3>
            <p className="label">Presenter · {pitch.presenterName}</p>
            <span className={`status-pill ${pitch.status === "presenting" ? "status-pill--live" : pitch.status === "done" ? "status-pill--done" : "status-pill--next"}`}>
              {STATUS_LABEL[pitch.status]}
            </span>
            {phase === "pitching" && pitch.status !== "presenting" ? (
              <button type="button" className="btn btn--gold btn--block" onClick={() => onWrite?.({ type: "host.setStatus", pitchId: pitch.id, status: "presenting" })}>
                Now presenting
              </button>
            ) : null}
            {renameId === pitch.id ? (
              <div className="row">
                <label className="field">
                  <span className="label-caps">Pitch name</span>
                  <input className="input" value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} />
                </label>
                <label className="field">
                  <span className="label-caps">Presenter</span>
                  <select
                    className="input"
                    value={renamePresenterId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setRenamePresenterId(id);
                      const player = players.find((entry) => entry.id === id);
                      if (player) setRenamePresenter(player.name);
                      else if (id.startsWith("guest:")) setRenamePresenter(id.slice("guest:".length));
                    }}
                  >
                    <option value="">Someone who has not joined</option>
                    {guests.map((name) => (
                      <option key={name} value={`guest:${name}`}>
                        {name}
                      </option>
                    ))}
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
                {renamePresenterId === "" ? (
                  <label className="field">
                    <span className="label-caps">Presenter name</span>
                    <input className="input" value={renamePresenter} onChange={(event) => setRenamePresenter(event.target.value)} />
                  </label>
                ) : null}
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  onClick={() => {
                    const error = pitchTitleError(renameTitle);
                    setFormError(error);
                    const player = players.find((entry) => entry.id === renamePresenterId);
                    const guest = renamePresenterId.startsWith("guest:") ? renamePresenterId.slice("guest:".length) : "";
                    const name = (player ? player.name : guest || renamePresenter).trim();
                    if (error || !name) return;
                    onWrite?.({
                      type: "host.updatePitch",
                      pitchId: pitch.id,
                      title: renameTitle.trim(),
                      presenterName: name,
                      presenterPlayerId: player ? player.id : null,
                    });
                    setRenameId(null);
                  }}
                >
                  Save pitch
                </button>
              </div>
            ) : (
              <div className="roster__actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setRenameId(pitch.id);
                    setRenameTitle(pitch.title);
                    setRenamePresenter(pitch.presenterName);
                    setRenamePresenterId(pitch.presenterId ?? "");
                  }}
                >
                  Edit
                </button>
                {phase !== "closed" ? (
                  <button type="button" className="btn btn--secondary" onClick={() => setRemoveId(pitch.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            )}
          </DragCard>
        ))}
          </SortableContext>
        </DndContext>
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

      {hideDebug ? null : <DebugDock code={code} counters={counters} open={debugOpen} />}

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

export function DebugDock({ code, counters, open = false }: { code: string; counters: HostCounters; open?: boolean }) {
  const [showDebug, setShowDebug] = useState(open);
  return (
    <section className="panel panel--quiet row debug-dock">
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setShowDebug((current) => !current)}>
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
  );
}

function DragCard({ id, index, disabled, children }: { id: string; index: number; disabled: boolean; children: ReactNode }) {
  const sortable = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <article ref={sortable.setNodeRef} style={style} className={sortable.isDragging ? "pitch-card pitch-card--dragging" : "pitch-card"}>
      <span className="pitch-card__num">{index + 1}</span>
      <div className="pitch-card__main">{children}</div>
      <div className="rank__handle" aria-label="Drag to reorder" {...sortable.attributes} role="button" tabIndex={disabled ? -1 : 0} {...sortable.listeners}>
        <i />
      </div>
    </article>
  );
}
