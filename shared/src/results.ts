// Results assembly for checklist 2.5.
import { borda, firstPlaceCount, rankPitches } from "./borda";
import { CATEGORIES } from "./config";
import { competitionRank, max, mean, min, percentile, popSD, scoreTotal } from "./stats";
import type { CategoryId, CategoryStats, PitchResult, Results, SessionSnapshot } from "./types";

export function computeResults(snapshot: SessionSnapshot): Results {
  const submitted = new Set(
    snapshot.ballots.filter((ballot) => ballot.submitted).map((ballot) => ballot.playerId),
  );
  const counted = snapshot.players.filter(
    (player) => player.role === "voter" && !player.removed && submitted.has(player.id),
  );
  const countedIds = new Set(counted.map((player) => player.id));
  const countedPlayerIds = counted.map((player) => player.id);
  const voidedPlayerIds = snapshot.players.filter((player) => !countedIds.has(player.id)).map((player) => player.id);

  const ballots = snapshot.ballots
    .filter((ballot) => countedIds.has(ballot.playerId))
    .map((ballot) => ballot.order);

  const ranked = rankPitches(
    snapshot.pitches.map((pitch) => ({
      pitchId: pitch.id,
      borda: borda(pitch.id, ballots),
      firstPlaceCount: firstPlaceCount(pitch.id, ballots),
      scoreTotal: totalFor(snapshot, pitch.id, countedIds),
    })),
  );
  const bordaRank = new Map(ranked.map((row) => [row.pitchId, row.rank]));
  const scoreValues = ranked.map((row) => row.scoreTotal);
  const scoreRanks = scoreRanksFor(scoreValues);

  const pitches: PitchResult[] = ranked.map((row, index) => {
    const categories = categoryStats(snapshot, row.pitchId, countedIds);
    const rank = bordaRank.get(row.pitchId) ?? index + 1;
    const scoreRank = scoreRanks[index] ?? null;
    return {
      pitchId: row.pitchId,
      borda: row.borda,
      bordaRank: rank,
      firstPlaceCount: row.firstPlaceCount,
      categories,
      scoreTotal: row.scoreTotal,
      scoreRank,
      disagreement: disagreement(rank, scoreRank),
    };
  });

  return { countedPlayerIds, voidedPlayerIds, pitches };
}

function totalFor(snapshot: SessionSnapshot, pitchId: string, countedIds: ReadonlySet<string>): number | null {
  const stats = categoryStats(snapshot, pitchId, countedIds);
  return scoreTotal(stats.compellingness.mean, stats.funniness.mean, stats.hotness.mean);
}

function categoryStats(
  snapshot: SessionSnapshot,
  pitchId: string,
  countedIds: ReadonlySet<string>,
): Record<CategoryId, CategoryStats> {
  const stats = {} as Record<CategoryId, CategoryStats>;
  for (const category of CATEGORIES) {
    const values = snapshot.scores
      .filter(
        (score) =>
          score.pitchId === pitchId && score.category === category.id && countedIds.has(score.playerId),
      )
      .map((score) => score.value);
    stats[category.id] = {
      mean: mean(values),
      sd: popSD(values),
      min: min(values),
      max: max(values),
      p25: percentile(values, 25),
      p75: percentile(values, 75),
    };
  }
  return stats;
}

/** Null totals have no score rank. Numeric ties use competition ranking (1, 2, 2, 4). */
function scoreRanksFor(totals: readonly (number | null)[]): (number | null)[] {
  const numeric = totals.filter((value): value is number => value !== null);
  const numericRanks = competitionRank(numeric);
  let numericIndex = 0;
  return totals.map((value) => {
    if (value === null) return null;
    const rank = numericRanks[numericIndex] ?? null;
    numericIndex += 1;
    return rank;
  });
}

function disagreement(
  bordaRank: number,
  scoreRank: number | null,
): PitchResult["disagreement"] {
  if (scoreRank === null) return null;
  if (Math.abs(bordaRank - scoreRank) < 2) return null;
  return {
    direction: bordaRank < scoreRank ? "crowd" : "scores",
    bordaRank,
    scoreRank,
  };
}
