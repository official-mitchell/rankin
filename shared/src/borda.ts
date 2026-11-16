// Borda scores and tie-breaks for checklist 2.3.
export type RankRow = {
  pitchId: string;
  borda: number;
  firstPlaceCount: number;
  scoreTotal: number | null;
};

export type RankedRow = RankRow & { rank: number };

/**
 * Mean of (n − pos) / (n − 1) over ballots that contain the pitch.
 * Position is 1-indexed. Ballots shorter than 2 contribute nothing.
 * A pitch on no contributing ballot scores 0.
 */
export function borda(pitchId: string, ballots: readonly (readonly string[])[]): number {
  const points: number[] = [];
  for (const ballot of ballots) {
    const n = ballot.length;
    if (n < 2) continue;
    const index = ballot.indexOf(pitchId);
    if (index < 0) continue;
    const position = index + 1;
    points.push((n - position) / (n - 1));
  }
  if (points.length === 0) return 0;
  let sum = 0;
  for (const point of points) sum += point;
  return sum / points.length;
}

/** First-place votes on ballots long enough to award Borda points. */
export function firstPlaceCount(pitchId: string, ballots: readonly (readonly string[])[]): number {
  let count = 0;
  for (const ballot of ballots) {
    if (ballot.length < 2) continue;
    if (ballot[0] === pitchId) count += 1;
  }
  return count;
}

function scoreKey(value: number | null): number {
  return value === null ? Number.NEGATIVE_INFINITY : value;
}

/**
 * Order: higher Borda, then more 1st-place votes, then higher score total.
 * Equal on all three keys share a rank (1, 2, 2, 4).
 */
export function rankPitches(rows: readonly RankRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.borda !== b.borda) return b.borda - a.borda;
    if (a.firstPlaceCount !== b.firstPlaceCount) return b.firstPlaceCount - a.firstPlaceCount;
    const scoreDelta = scoreKey(b.scoreTotal) - scoreKey(a.scoreTotal);
    if (scoreDelta !== 0) return scoreDelta;
    return a.pitchId < b.pitchId ? -1 : a.pitchId > b.pitchId ? 1 : 0;
  });

  const ranked: RankedRow[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const row = sorted[index]!;
    const previous = ranked[index - 1];
    const shared =
      previous !== undefined &&
      previous.borda === row.borda &&
      previous.firstPlaceCount === row.firstPlaceCount &&
      previous.scoreTotal === row.scoreTotal;
    ranked.push({ ...row, rank: shared ? previous.rank : index + 1 });
  }
  return ranked;
}
