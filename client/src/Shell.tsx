// Header, phase progress, and session tabs. 2026-11-16: title is Rankin' with a star on each side, centered and larger, with a repeating gold shine and a small star bounce. The connection pill and the Notes / Rank / Players row are optional so the empty landing can hide both. Each phase title opens a short explanation. Players is hidden unless the viewer is the game master.
import type { Phase } from "@we-rankin/shared";
import { useEffect, useState, type ReactNode } from "react";

const PHASES: { id: Phase; label: string; detail: string }[] = [
  {
    id: "lobby",
    label: "Lobby",
    detail: "People join and pitches get added. When tracking starts, the roster locks. Anyone who joins after that watches.",
  },
  {
    id: "pitching",
    label: "Tracking",
    detail: "Every pitch can be scored, in the order the game master sets. A presenter cannot score their own pitch.",
  },
  {
    id: "voting",
    label: "Voting",
    detail: "Ballots open, one for each voter. A pitch added now shows up as new and has to be placed.",
  },
  {
    id: "closed",
    label: "Results",
    detail: "Scores and ranks freeze, and everyone sees the board. The game master can still rename a title or a presenter name.",
  },
];

const TABS = ["Notes", "Rank", "Players"] as const;
const TAB_HINT: Record<(typeof TABS)[number], string> = {
  Notes: "Scores",
  Rank: "Ballot",
  Players: "Roster",
};

export function Shell({
  phase,
  tab,
  onTab,
  conn = "Live",
  status = "online",
  showConn = true,
  showTabs = true,
  showPlayers = true,
  rankLocked = false,
  onBack,
  children,
}: {
  phase: Phase;
  tab: (typeof TABS)[number];
  onTab: (tab: (typeof TABS)[number]) => void;
  conn?: string;
  status?: "connecting" | "online" | "offline";
  showConn?: boolean;
  showTabs?: boolean;
  showPlayers?: boolean;
  rankLocked?: boolean;
  onBack?: () => void;
  children: ReactNode;
}) {
  const current = PHASES.findIndex((item) => item.id === phase);
  const [openPhase, setOpenPhase] = useState<Phase | null>(null);
  const open = PHASES.find((item) => item.id === openPhase) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPhase(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={showTabs ? "app" : "app app--solo"}>
      <header className="app-header">
        <h1 className="title">
          <span className="star" aria-hidden="true" />
          <span className="title__word">Rankin'</span>
          <span className="star" aria-hidden="true" />
        </h1>
        {showConn ? (
          <span className="conn" data-status={status}>
            <span className="led" aria-hidden="true" />
            {conn}
          </span>
        ) : null}
      </header>
      {onBack ? (
        <button type="button" className="back-link" onClick={onBack}>
          ← Back
        </button>
      ) : null}
      <ol className="phase-rail" aria-label="Session progress">
        {PHASES.map((item, index) => {
          const state = index < current ? "done" : index === current ? "active" : "ahead";
          return (
            <li
              key={item.id}
              className={`phase-rail__step phase-rail__step--${state}`}
              aria-current={state === "active" ? "step" : undefined}
            >
              <button type="button" className="phase-rail__hit" onClick={() => setOpenPhase(item.id)}>
                <span className="phase-rail__mark" aria-hidden="true" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>
      {open ? (
        <div className="modal-scrim modal-scrim--center">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="phase-info-title">
            <h2 className="modal__title" id="phase-info-title">
              {open.label}
            </h2>
            <p>{open.detail}</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--primary btn--block" onClick={() => setOpenPhase(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <main className="screen">{children}</main>
      {showTabs ? (
        <nav className="tabbar" aria-label="Sections" style={{ gridTemplateColumns: `repeat(${showPlayers ? 3 : 2}, 1fr)` }}>
          {TABS.filter((name) => showPlayers || name !== "Players").map((name) => (
            <button
              key={name}
              type="button"
              className={name === tab ? "tab tab--active" : "tab"}
              disabled={name === "Rank" && rankLocked}
              onClick={() => onTab(name)}
            >
              <span>{name}</span>
              <small>{TAB_HINT[name]}</small>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
