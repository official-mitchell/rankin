// Score stats for checklist 2.2. Empty samples return null, never NaN.
import { HOTNESS_WEIGHT } from "./config";

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Population standard deviation (divide by n, not n − 1). */
export function popSD(values: readonly number[]): number | null {
  const avg = mean(values);
  if (avg === null) return null;
  let sum = 0;
  for (const value of values) {
    const delta = value - avg;
    sum += delta * delta;
  }
  return Math.sqrt(sum / values.length);
}

export function min(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let best = values[0]!;
  for (const value of values) if (value < best) best = value;
  return best;
}

export function max(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let best = values[0]!;
  for (const value of values) if (value > best) best = value;
  return best;
}

/**
 * Percentile in [0, 100] using linear interpolation between closest ranks
 * (NumPy's default `linear` method): index = (n − 1) × (p / 100).
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * (p / 100);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const lowValue = sorted[low]!;
  const highValue = sorted[high]!;
  if (low === high) return lowValue;
  return lowValue + (highValue - lowValue) * (index - low);
}

/** Compellingness mean + Funniness mean + Hotness mean × 0.5. */
export function scoreTotal(
  compellingness: number | null,
  funniness: number | null,
  hotness: number | null,
): number | null {
  if (compellingness === null || funniness === null || hotness === null) return null;
  return compellingness + funniness + hotness * HOTNESS_WEIGHT;
}

/**
 * Competition ranking, higher value is better. Ties share the first rank
 * and the next rank skips: 1, 2, 2, 4.
 */
export function competitionRank(values: readonly number[]): number[] {
  const order = values.map((value, index) => ({ value, index }));
  order.sort((a, b) => b.value - a.value || a.index - b.index);
  const ranks = new Array<number>(values.length);
  let cursor = 0;
  while (cursor < order.length) {
    let end = cursor + 1;
    while (end < order.length && order[end]!.value === order[cursor]!.value) end += 1;
    const rank = cursor + 1;
    for (let i = cursor; i < end; i += 1) ranks[order[i]!.index] = rank;
    cursor = end;
  }
  return ranks;
}
