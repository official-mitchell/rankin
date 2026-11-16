// View store and selectors for checklist 5.2.
import { eligiblePitches, missingItems, type BallotDraft } from "@we-rankin/shared";
import type { ClientView, MissingItem, Pitch, PlayerRole } from "@we-rankin/shared";
import type { ConnectionStatus } from "./connection";
import type { PendingWrite } from "./queue";

export type RealtimeState = {
  view: ClientView | null;
  status: ConnectionStatus;
  pending: PendingWrite[];
  lastSeq: number;
  alert: { code: "A1" | "A2"; message: string } | null;
  toast: string | null;
};

export function emptyState(): RealtimeState {
  return { view: null, status: "offline", pending: [], lastSeq: 0, alert: null, toast: null };
}

export function me(state: RealtimeState): { playerId: string | null; role: PlayerRole | null; isHost: boolean } | null {
  return state.view?.self ?? null;
}

export function isSpectator(state: RealtimeState): boolean {
  return state.view?.self?.role === "spectator";
}

export function myEligiblePitches(state: RealtimeState): Pitch[] {
  const playerId = state.view?.self?.playerId;
  if (!state.view || !playerId) return [];
  return eligiblePitches(playerId, state.view.pitches);
}

export function myMissing(state: RealtimeState): MissingItem[] {
  const view = state.view;
  const playerId = view?.self?.playerId;
  if (!view || !playerId || !view.ballot) return view?.missing ?? [];
  const ballot: BallotDraft = { order: view.ballot.order, placed: view.ballot.placed };
  return missingItems({
    playerId,
    pitches: view.pitches,
    scores: view.scores ?? [],
    ballot,
    newPitchIds: [],
  });
}

export function waitingOn(state: RealtimeState): string[] {
  return (state.view?.players ?? [])
    .filter((player) => player.role === "voter" && !player.submitted)
    .map((player) => player.name);
}

export function connectionLabel(status: ConnectionStatus, pending: number): string {
  if (pending > 0 && status !== "online") return `Offline — ${pending} pending`;
  if (pending > 0) return "Saving…";
  if (status !== "online") return "Reconnecting…";
  return "Saved ✓";
}
