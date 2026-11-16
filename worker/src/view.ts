// Per-viewer projection for checklist 4.5 and host debug counters (checklist 7.3).
import { missingItems, type BallotDraft } from "@we-rankin/shared";
import type {
  Ballot,
  CategoryId,
  ChipSet,
  ClientView,
  Phase,
  PlayerRole,
  Results,
  Score,
  ViewPitch,
} from "@we-rankin/shared";

export type ViewPlayer = {
  id: string;
  name: string;
  role: PlayerRole;
  removed: boolean;
  connected: boolean;
  submitted: boolean;
};

export type ViewState = {
  phase: Phase;
  rosterLocked: boolean;
  players: ViewPlayer[];
  pitches: ViewPitch[];
  scores: Score[];
  chips: Array<{ playerId: string; pitchId: string; chipId: string }>;
  ballots: Ballot[];
  newPitchIds: string[];
  results: Results | null;
  writesFailed?: number;
  reconnects?: number;
};

export function buildView(state: ViewState, viewer: { playerId: string | null; isHost: boolean }): ClientView {
  const self = state.players.find((player) => player.id === viewer.playerId) ?? null;
  const spectator = self?.role === "spectator";
  const view: ClientView = {
    phase: state.phase,
    rosterLocked: state.rosterLocked,
    self: {
      playerId: viewer.playerId,
      role: self?.role ?? null,
      isHost: viewer.isHost,
    },
    players: state.players
      .filter((player) => !player.removed)
      .map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        connected: player.connected,
        submitted: player.submitted,
      })),
    pitches: state.pitches,
  };
  if (viewer.isHost) {
    view.host = {
      canStartPitching: state.phase === "lobby",
      canOpenVoting: state.phase === "pitching",
      canCloseVoting: state.phase === "voting",
      writes_failed: state.writesFailed ?? 0,
      reconnects: state.reconnects ?? 0,
      connected: state.players.filter((player) => !player.removed && player.connected).length,
    };
  }
  if (self && !spectator) {
    view.scores = state.scores.filter((score) => score.playerId === self.id);
    view.chips = chipsFor(state, self.id);
    const ballot = state.ballots.find((item) => item.playerId === self.id);
    if (ballot) {
      view.ballot = ballot;
      view.missing = missingItems({
        playerId: self.id,
        pitches: state.pitches,
        scores: state.scores,
        ballot: draft(ballot),
        newPitchIds: state.newPitchIds,
      });
    }
  }
  if (state.phase === "closed" && state.results) view.results = state.results;
  return view;
}

function chipsFor(state: ViewState, playerId: string): ChipSet[] {
  const grouped = new Map<string, string[]>();
  for (const chip of state.chips) {
    if (chip.playerId !== playerId) continue;
    const list = grouped.get(chip.pitchId) ?? [];
    list.push(chip.chipId);
    grouped.set(chip.pitchId, list);
  }
  return [...grouped.entries()].map(([pitchId, chipIds]) => ({ pitchId, chipIds }));
}

function draft(ballot: Ballot): BallotDraft {
  return { order: ballot.order, placed: ballot.placed };
}

export function viewLeaks(state: ViewState): string[] {
  const leaks: string[] = [];
  for (const player of state.players) {
    const view = buildView(state, { playerId: player.id, isHost: false });
    const foreignScore = (view.scores ?? []).some((score) => score.playerId !== player.id);
    const foreignBallot = view.ballot !== undefined && view.ballot.playerId !== player.id;
    const ownChips = new Set(
      state.chips.filter((chip) => chip.playerId === player.id).map((chip) => `${chip.pitchId}:${chip.chipId}`),
    );
    const foreignChip = (view.chips ?? []).some((set) => set.chipIds.some((chipId) => !ownChips.has(`${set.pitchId}:${chipId}`)));
    if (foreignScore || foreignBallot || foreignChip) leaks.push(player.id);
    if (state.phase !== "closed" && view.results !== undefined) leaks.push(`${player.id}:results`);
  }
  return leaks;
}

export function scoreValue(category: CategoryId, value: number): boolean {
  if (category === "hotness") return value >= 1 && value <= 10;
  return value >= 1 && value <= 5;
}
