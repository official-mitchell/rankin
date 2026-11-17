// Lobby roster (checklist 6.3). Host roster actions hide once closed (checklist 10.2). Pitch order lives on the pitch cards.
import type { Phase, PlayerRole } from "@we-rankin/shared";
import { useState } from "react";

export type RosterPlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  connected: boolean;
  host?: boolean;
};

export type LineupPitch = { id: string; title: string; presenterName: string };

type Confirm = { action: "promote" | "remove" | "release"; name: string } | null;

export function Roster({
  players,
  pitches: _pitches,
  isHost,
  spectator,
  phase,
  onAction,
}: {
  players: RosterPlayer[];
  pitches: LineupPitch[];
  isHost: boolean;
  spectator: boolean;
  phase: Phase;
  onAction?: (action: "promote" | "remove" | "release" | "start", name?: string) => void;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  return (
    <div className="row" data-host={isHost ? "yes" : "no"}>
      {spectator ? <p className="notice">You joined after roster lock — view only</p> : null}
      <section className="panel panel--quiet">
        <ul className="roster">
          {players.map((player) => (
            <li key={player.id}>
              <i className={player.connected ? "led led--ok" : "led"} aria-hidden="true" />
              <span className="roster__name">
                {player.name}
                {player.host ? " (host)" : ""}
              </span>
              <span className={player.host ? "tag tag--voter" : player.role === "voter" ? "tag tag--voter" : "tag"}>
                {player.host ? "Host" : player.role === "voter" ? "Voter" : "Spectator"}
              </span>
              {isHost && !player.host && phase !== "closed" ? (
                <span className="roster__actions">
                  {player.role === "spectator" && phase !== "voting" ? (
                    <button type="button" className="btn btn--secondary" onClick={() => setConfirm({ action: "promote", name: player.name })}>
                      Promote
                    </button>
                  ) : null}
                  <button type="button" className="btn btn--secondary" onClick={() => setConfirm({ action: "remove", name: player.name })}>
                    Remove
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirm({ action: "release", name: player.name })}>
                    Release
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {confirm ? (
        <div className="modal-scrim" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="confirm-title">
            <h3 className="modal__title" id="confirm-title">
              {confirm.action} {confirm.name}?
            </h3>
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setConfirm(null)}>
                Keep
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  onAction?.(confirm.action, confirm.name);
                  setConfirm(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
