// Ballot transforms for checklist 2.4. Pure; callers persist the returned state.
import { CATEGORIES } from "./config";
import type { Ballot, CategoryId, MissingItem, Pitch, Score } from "./types";

export type BallotDraft = {
  order: string[];
  placed: string[];
};

export function eligiblePitches(playerId: string, pitches: readonly Pitch[]): Pitch[] {
  return pitches.filter((pitch) => pitch.presenterId !== playerId);
}

export function applyNewPitch(ballot: BallotDraft, pitchId: string): BallotDraft {
  if (ballot.order.includes(pitchId)) return { order: [...ballot.order], placed: [...ballot.placed] };
  return { order: [...ballot.order, pitchId], placed: [...ballot.placed] };
}

export function applyMove(ballot: BallotDraft, pitchId: string, toIndex: number): BallotDraft {
  const from = ballot.order.indexOf(pitchId);
  if (from < 0) return { order: [...ballot.order], placed: [...ballot.placed] };
  const without = ballot.order.filter((id) => id !== pitchId);
  const clamped = clamp(toIndex, 0, without.length);
  const order = [...without.slice(0, clamped), pitchId, ...without.slice(clamped)];
  const placed = ballot.placed.includes(pitchId) ? [...ballot.placed] : [...ballot.placed, pitchId];
  return { order, placed };
}

export function applyPlace(ballot: BallotDraft, pitchId: string): BallotDraft {
  if (ballot.placed.includes(pitchId)) return { order: [...ballot.order], placed: [...ballot.placed] };
  return { order: [...ballot.order], placed: [...ballot.placed, pitchId] };
}

export function applyRemovePitch(ballot: BallotDraft, pitchId: string): BallotDraft {
  return {
    order: ballot.order.filter((id) => id !== pitchId),
    placed: ballot.placed.filter((id) => id !== pitchId),
  };
}

export function missingItems(input: {
  playerId: string;
  pitches: readonly Pitch[];
  scores: readonly Score[];
  ballot: BallotDraft;
  newPitchIds: readonly string[];
}): MissingItem[] {
  const eligible = eligiblePitches(input.playerId, input.pitches);
  const missing: MissingItem[] = [];
  const newIds = new Set(input.newPitchIds);
  for (const pitch of eligible) {
    for (const category of CATEGORIES) {
      const scored = input.scores.some(
        (score) =>
          score.playerId === input.playerId &&
          score.pitchId === pitch.id &&
          score.category === category.id &&
          Number.isFinite(score.value),
      );
      if (!scored) missing.push({ kind: "score", pitchId: pitch.id, category: category.id });
    }
    if (newIds.has(pitch.id) && !input.ballot.placed.includes(pitch.id)) {
      missing.push({ kind: "unplaced", pitchId: pitch.id });
    }
  }
  return missing;
}

export function ballotComplete(input: {
  playerId: string;
  pitches: readonly Pitch[];
  scores: readonly Score[];
  ballot: BallotDraft;
  newPitchIds: readonly string[];
}): boolean {
  if (missingItems(input).length > 0) return false;
  const eligibleIds = eligiblePitches(input.playerId, input.pitches).map((pitch) => pitch.id);
  if (input.ballot.order.length !== eligibleIds.length) return false;
  const eligible = new Set(eligibleIds);
  return input.ballot.order.every((id) => eligible.has(id));
}

export function fullScores(
  playerId: string,
  pitches: readonly Pitch[],
  value: Partial<Record<CategoryId, number>> = { compellingness: 3, funniness: 3, hotness: 5 },
): Score[] {
  const scores: Score[] = [];
  for (const pitch of eligiblePitches(playerId, pitches)) {
    for (const category of CATEGORIES) {
      const categoryValue = value[category.id];
      if (categoryValue === undefined) continue;
      scores.push({ playerId, pitchId: pitch.id, category: category.id, value: categoryValue });
    }
  }
  return scores;
}

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
