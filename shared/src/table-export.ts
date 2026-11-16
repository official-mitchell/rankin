// Closed-session CSV and Markdown rows (checklist 11.1). Voter indexes are assigned by the caller’s random source.
import { CHIPS } from "./config";
import type { Ballot, CategoryId, Results, Score } from "./types";

export type ExportPlayer = { id: string; name: string; role: string; removed: boolean };
export type ExportPitch = { id: string; title: string; presenterName: string };
export type ExportChip = { playerId: string; pitchId: string; chipId: string };

export type ExportBundle = {
  players: ExportPlayer[];
  pitches: ExportPitch[];
  scores: Score[];
  chips: ExportChip[];
  ballots: Ballot[];
  results: Results;
};

const CATEGORY_IDS: CategoryId[] = ["compellingness", "funniness", "hotness"];

export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n") + "\n";
}

/** Fisher–Yates. Each call can assign a different index to the same voter. */
export function voterIndexes(playerIds: readonly string[], random: () => number): Map<string, number> {
  const order = [...playerIds];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = order[index] ?? "";
    order[index] = order[swap] ?? "";
    order[swap] = current;
  }
  return new Map(order.map((id, index) => [id, index + 1]));
}

export function ballotCsv(bundle: ExportBundle, random: () => number, includeNames: boolean): string {
  const voters = bundle.players.filter((player) => player.role === "voter" && !player.removed);
  const indexes = voterIndexes(voters.map((player) => player.id), random);
  const counted = new Set(bundle.results.countedPlayerIds);
  const headers = ["voterIndex", ...(includeNames ? ["voterName"] : []), "pitch", "C", "F", "H", "chips", "rankPosition", "counted"];
  const rows: (string | number | null)[][] = [];
  for (const player of voters) {
    for (const pitch of bundle.pitches) {
      const ballot = bundle.ballots.find((entry) => entry.playerId === player.id);
      const position = ballot ? ballot.order.indexOf(pitch.id) : -1;
      const chips = bundle.chips
        .filter((chip) => chip.playerId === player.id && chip.pitchId === pitch.id)
        .map((chip) => CHIPS.find((entry) => entry.id === chip.chipId)?.label ?? chip.chipId)
        .join("; ");
      const cells: (string | number | null)[] = [
        indexes.get(player.id) ?? null,
        ...(includeNames ? [player.name] : []),
        pitch.title,
        scoreOf(bundle, player.id, pitch.id, "compellingness"),
        scoreOf(bundle, player.id, pitch.id, "funniness"),
        scoreOf(bundle, player.id, pitch.id, "hotness"),
        chips,
        position < 0 ? null : position + 1,
        counted.has(player.id) ? "yes" : "no",
      ];
      rows.push(cells);
    }
  }
  return toCsv(headers, rows);
}

export function summaryCsv(bundle: ExportBundle): string {
  const headers = [
    "pitch",
    "presenter",
    "borda",
    "bordaRank",
    "firstPlaceCount",
    "scoreTotal",
    "scoreRank",
    "flag",
    "C_mean",
    "C_sd",
    "C_min",
    "C_max",
    "C_p25",
    "C_p75",
    "F_mean",
    "F_sd",
    "F_min",
    "F_max",
    "F_p25",
    "F_p75",
    "H_mean",
    "H_sd",
    "H_min",
    "H_max",
    "H_p25",
    "H_p75",
  ];
  const rows = [...bundle.results.pitches]
    .sort((left, right) => left.bordaRank - right.bordaRank)
    .map((row) => {
      const pitch = bundle.pitches.find((entry) => entry.id === row.pitchId);
      const cells: (string | number | null)[] = [
        pitch?.title ?? row.pitchId,
        pitch?.presenterName ?? "",
        row.borda,
        row.bordaRank,
        row.firstPlaceCount,
        row.scoreTotal,
        row.scoreRank,
        row.disagreement?.direction ?? "",
      ];
      for (const category of CATEGORY_IDS) {
        const stats = row.categories[category];
        cells.push(stats.mean, stats.sd, stats.min, stats.max, stats.p25, stats.p75);
      }
      return cells;
    });
  return toCsv(headers, rows);
}

export function markdownSummary(bundle: ExportBundle): string {
  const titles = new Map(bundle.pitches.map((pitch) => [pitch.id, pitch.title]));
  const borda = [...bundle.results.pitches].sort((left, right) => left.bordaRank - right.bordaRank);
  const lines = ["# Results", "", "## Borda ranking", ""];
  for (const row of borda) {
    const flag = row.disagreement ? ` (${row.disagreement.direction}: scores #${row.disagreement.scoreRank})` : "";
    lines.push(`${row.bordaRank}. ${titles.get(row.pitchId) ?? row.pitchId} — ${row.borda.toFixed(2)}${flag}`);
  }
  lines.push("", "## Score leaderboard", "", "Hotness ÷ 2.", "");
  for (const row of [...bundle.results.pitches].sort((left, right) => (right.scoreTotal ?? -1) - (left.scoreTotal ?? -1))) {
    lines.push(`- ${titles.get(row.pitchId) ?? row.pitchId}: ${row.scoreTotal === null ? "—" : row.scoreTotal.toFixed(1)} / 15`);
  }
  lines.push("", "## Pitch stats", "");
  const counted = new Set(bundle.results.countedPlayerIds);
  for (const row of borda) {
    lines.push(`### ${titles.get(row.pitchId) ?? row.pitchId}`, "");
    for (const category of CATEGORY_IDS) {
      const stats = row.categories[category];
      const mean = stats.mean === null ? "—" : stats.mean.toFixed(2);
      const sd = stats.sd === null ? "—" : stats.sd.toFixed(2);
      lines.push(`- ${category}: mean ${mean}, sd ${sd}, min ${stats.min ?? "—"}, max ${stats.max ?? "—"}`);
    }
    const counts = new Map<string, number>();
    for (const chip of bundle.chips) {
      if (chip.pitchId !== row.pitchId || !counted.has(chip.playerId)) continue;
      counts.set(chip.chipId, (counts.get(chip.chipId) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 3);
    const chipText = top.length === 0 ? "none" : top.map(([id, count]) => `${CHIPS.find((chip) => chip.id === id)?.label ?? id} (${count})`).join(", ");
    lines.push(`- Top chips: ${chipText}`, "");
  }
  return lines.join("\n");
}

function scoreOf(bundle: ExportBundle, playerId: string, pitchId: string, category: CategoryId): number | null {
  return bundle.scores.find((score) => score.playerId === playerId && score.pitchId === pitchId && score.category === category)?.value ?? null;
}
