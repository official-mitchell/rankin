// Light Hot Takes chart cards (checklist 11.2). These SVGs do not use the app tokens.
import type { ExportBundle } from "./table-export";
import type { CategoryId, CategoryStats } from "./types";

export type ChartVotes = Record<CategoryId, number[]>;

export type ChartPitch = {
  pitchId: string;
  title: string;
  presenterName: string;
  votes: ChartVotes;
  categories: Record<CategoryId, CategoryStats>;
  scoreTotal: number | null;
};

const PAPER = "#f7f4ee";
const INK = "#1c1915";
const MUTED = "#5c574e";
const GRID = "#e4ddd0";
const FILLS: Record<CategoryId, string> = {
  compellingness: "#3b6fd8",
  funniness: "#7c3aed",
  hotness: "#dc2626",
};

const WIDTH = 2000;

export function chartFontFace(base64: string): string {
  return `@font-face{font-family:'Inter';src:url(data:font/woff2;base64,${base64}) format('woff2');font-weight:400 700;}`;
}

export function leaderboardSvg(pitches: ChartPitch[], fontBase64: string): string {
  const plotLeft = 720;
  const plotRight = 1800;
  const top = 180;
  const blocks = pitches.map((pitch) => {
    const title = wrapTitle(pitch.title, 640, 32);
    const height = Math.max(72, title.lines.length * 40 + 16);
    return { pitch, title, height };
  });
  let y = top;
  const bars = blocks.map((block) => {
    const comp = block.pitch.categories.compellingness.mean ?? 0;
    const fun = block.pitch.categories.funniness.mean ?? 0;
    const hot = (block.pitch.categories.hotness.mean ?? 0) / 2;
    const barY = y + block.height / 2 - 18;
    let cursor = plotLeft;
    const parts = [
      segment(cursor, barY, comp, plotLeft, plotRight, FILLS.compellingness),
      segment((cursor += widthOf(comp, plotLeft, plotRight)), barY, fun, plotLeft, plotRight, FILLS.funniness),
      segment(cursor + widthOf(fun, plotLeft, plotRight), barY, hot, plotLeft, plotRight, FILLS.hotness),
    ];
    const labels = block.title.lines
      .map((line, index) => text(24, y + 32 + index * 40, block.title.fontSize, INK, "start", line))
      .join("");
    const total = block.pitch.scoreTotal === null ? "—" : block.pitch.scoreTotal.toFixed(1);
    const chunk = `${labels}${parts.join("")}${text(plotRight + 24, barY + 28, 28, INK, "start", total)}`;
    y += block.height;
    return chunk;
  });
  const height = y + 80;
  const axis = [0, 5, 10, 15]
    .map((tick) => {
      const x = plotLeft + (tick / 15) * (plotRight - plotLeft);
      return `<line x1="${x}" y1="${top - 12}" x2="${x}" y2="${y}" stroke="${GRID}" stroke-width="2"/>${text(x, y + 40, 22, MUTED, "middle", String(tick))}`;
    })
    .join("");
  return svg(
    height,
    fontBase64,
    `${text(24, 72, 48, INK, "start", "Score leaderboard")}${text(24, 124, 28, MUTED, "start", "Hotness ÷ 2 · axis 0–15")}${axis}${bars.join("")}`,
  );
}

export function pitchCardSvg(pitch: ChartPitch, fontBase64: string): string {
  const title = wrapTitle(pitch.title, 1900, 56);
  const header = 88 + title.lines.length * (title.fontSize + 12);
  const lane = 200;
  const height = header + 3 * lane + 120;
  const lanes = (["compellingness", "funniness", "hotness"] as const).map((category, index) => laneSvg(pitch, category, header + index * lane));
  const total = pitch.scoreTotal === null ? "—" : `${pitch.scoreTotal.toFixed(1)} / 15`;
  const titleText = title.lines.map((line, index) => text(48, 80 + index * (title.fontSize + 8), title.fontSize, INK, "start", line)).join("");
  return svg(
    height,
    fontBase64,
    `${titleText}${text(48, header - 28, 24, MUTED, "start", pitch.presenterName)}${lanes.join("")}${text(1952, height - 48, 36, INK, "end", total)}`,
  );
}

export function chartPitches(bundle: ExportBundle): ChartPitch[] {
  const counted = new Set(bundle.results.countedPlayerIds);
  return bundle.results.pitches.map((row) => {
    const pitch = bundle.pitches.find((entry) => entry.id === row.pitchId);
    const votes: ChartVotes = { compellingness: [], funniness: [], hotness: [] };
    for (const score of bundle.scores) {
      if (score.pitchId !== row.pitchId || !counted.has(score.playerId)) continue;
      votes[score.category].push(score.value);
    }
    return {
      pitchId: row.pitchId,
      title: pitch?.title ?? row.pitchId,
      presenterName: pitch?.presenterName ?? "",
      votes,
      categories: row.categories,
      scoreTotal: row.scoreTotal,
    };
  });
}

export function pngFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "pitch"}.png`;
}

/** Shrinks the type until every line fits. A title is never cut off with an ellipsis. */
export function wrapTitle(title: string, maxWidth: number, fontSize: number): { lines: string[]; fontSize: number } {
  let size = fontSize;
  while (size >= 22) {
    const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.52)));
    const lines = wrapWords(title, maxChars);
    const widest = Math.max(...lines.map((line) => line.length * size * 0.52));
    if (widest <= maxWidth) return { lines, fontSize: size };
    size -= 2;
  }
  const maxChars = Math.max(8, Math.floor(maxWidth / (22 * 0.52)));
  return { lines: wrapWords(title, maxChars), fontSize: 22 };
}

function laneSvg(pitch: ChartPitch, category: CategoryId, y: number): string {
  const min = 1;
  const max = category === "hotness" ? 10 : 5;
  const x0 = 280;
  const x1 = 1680;
  const mid = y + 100;
  const stats = pitch.categories[category];
  const scale = (value: number) => x0 + ((value - min) / (max - min)) * (x1 - x0);
  const whisker =
    stats.min !== null && stats.max !== null
      ? `<line x1="${scale(stats.min)}" y1="${mid}" x2="${scale(stats.max)}" y2="${mid}" stroke="${INK}" stroke-width="4"/>`
      : "";
  const band =
    stats.p25 !== null && stats.p75 !== null
      ? `<rect x="${scale(Math.min(stats.p25, stats.p75))}" y="${mid - 28}" width="${Math.max(2, Math.abs(scale(stats.p75) - scale(stats.p25)))}" height="56" fill="${FILLS[category]}" opacity="0.28"/>`
      : "";
  const dots = pitch.votes[category]
    .map((value, index) => {
      const jitter = unit(hash(`${pitch.pitchId}:${category}:${index}`)) - 0.5;
      return `<circle cx="${scale(value)}" cy="${mid + jitter * 36}" r="7" fill="${FILLS[category]}"/>`;
    })
    .join("");
  const mean =
    stats.mean === null
      ? ""
      : `<circle cx="${scale(stats.mean)}" cy="${mid}" r="12" fill="${FILLS[category]}" stroke="#ffffff" stroke-width="4"/>`;
  const sd = stats.sd === null ? "SD —" : `SD ${stats.sd.toFixed(2)}`;
  const axisLabel = category === "hotness" ? "1–10" : "1–5";
  return `${text(48, y + 40, 28, INK, "start", category)}${text(x1, y + 40, 22, MUTED, "end", axisLabel)}${whisker}${band}${dots}${mean}${text(1720, mid + 8, 24, MUTED, "start", sd)}`;
}

function segment(x: number, y: number, value: number, plotLeft: number, plotRight: number, fill: string): string {
  const width = widthOf(value, plotLeft, plotRight);
  if (width <= 0) return "";
  return `<rect x="${x}" y="${y}" width="${width}" height="36" fill="${fill}"/>`;
}

function widthOf(value: number, plotLeft: number, plotRight: number): number {
  return Math.max(0, (value / 15) * (plotRight - plotLeft));
}

function svg(height: number, fontBase64: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}"><style>${chartFontFace(fontBase64)}</style><rect width="100%" height="100%" fill="${PAPER}"/>${body}</svg>`;
}

function text(x: number, y: number, size: number, fill: string, anchor: string, value: string): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="Inter, Helvetica, sans-serif" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function wrapWords(title: string, maxChars: number): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [title];
}

function hash(value: string): number {
  let hashValue = 2166136261;
  for (const char of value) hashValue = Math.imul(hashValue ^ char.charCodeAt(0), 16777619);
  return hashValue >>> 0;
}

function unit(seed: number): number {
  return ((Math.imul(seed, 2246822519) >>> 0) % 1000) / 1000;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
