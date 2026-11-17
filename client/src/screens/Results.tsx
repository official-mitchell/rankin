// Pitch-by-pitch results: a box chart for each score, plus a count of every chip. A closed poll can return to the landing screen.
import { CATEGORIES, CHIP_GROUPS, type CategoryStats, type PitchResult, type Results } from "@we-rankin/shared";

export type ResultPitch = { id: string; title: string; presenterName?: string };
export type ResultPlayer = { id: string; name: string };

export function bordaLabel(value: number): string {
  const text = value.toFixed(2);
  return text.startsWith("0") ? text.slice(1) : text;
}

export function flagLabel(row: PitchResult): string | null {
  if (!row.disagreement) return null;
  const mark = row.disagreement.direction === "crowd" ? "▲" : "▼";
  return `${mark} Crowd #${row.disagreement.bordaRank} · Scores #${row.disagreement.scoreRank}`;
}

export function scoreOrder(rows: PitchResult[]): PitchResult[] {
  return [...rows].sort((left, right) => {
    if (left.scoreTotal === null && right.scoreTotal === null) return left.bordaRank - right.bordaRank;
    if (left.scoreTotal === null) return 1;
    if (right.scoreTotal === null) return -1;
    if (right.scoreTotal !== left.scoreTotal) return right.scoreTotal - left.scoreTotal;
    return left.bordaRank - right.bordaRank;
  });
}

export function stackWidths(categories: PitchResult["categories"]): { comp: number; fun: number; hot: number } {
  return {
    comp: share(categories.compellingness),
    fun: share(categories.funniness),
    hot: share(categories.hotness) / 2,
  };
}

function share(stats: CategoryStats): number {
  if (stats.mean === null) return 0;
  return (stats.mean / 15) * 100;
}

function namesFor(ids: string[], players: ResultPlayer[]): string[] {
  return ids.map((id) => players.find((player) => player.id === id)?.name ?? id);
}

export function ResultsBoard({
  results,
  pitches,
  players,
  onNewSession,
}: {
  results: Results;
  pitches: ResultPitch[];
  players: ResultPlayer[];
  onNewSession?: () => void;
}) {
  const titleOf = new Map(pitches.map((pitch) => [pitch.id, pitch.title]));
  const borda = [...results.pitches].sort((left, right) => left.bordaRank - right.bordaRank || right.borda - left.borda);
  const counted = namesFor(results.countedPlayerIds, players);
  const voided = namesFor(results.voidedPlayerIds, players);

  return (
    <div className="row results">
      {onNewSession ? (
        <button type="button" className="btn btn--primary btn--block" onClick={onNewSession}>
          Create a new session
        </button>
      ) : null}
      <section className="panel panel--quiet">
        <p className="eyebrow">★ Polls closed ★</p>
        <p className="label">Counted</p>
        <p className="voter-names">{counted.length === 0 ? "None" : counted.join(", ")}</p>
        <p className="label">Not submitted before close — ballot not counted</p>
        <p className="voter-names voter-names--void">{voided.length === 0 ? "None" : voided.join(", ")}</p>
      </section>
      {borda.map((row) => {
        const pitch = pitches.find((item) => item.id === row.pitchId);
        const flag = flagLabel(row);
        return (
          <article key={row.pitchId} className="panel pitch-result">
            <p className="eyebrow">Rank {row.bordaRank}</p>
            <h3 className="card-title">{pitch?.title ?? titleOf.get(row.pitchId) ?? row.pitchId}</h3>
            {pitch?.presenterName ? <p className="label">Presented by {pitch.presenterName}</p> : null}
            <p className="pitch-result__stats">
              <span>Borda {bordaLabel(row.borda)}</span>
              <span>First place {row.firstPlaceCount}</span>
              <span>Score {row.scoreTotal === null ? "—" : row.scoreTotal.toFixed(1)}</span>
            </p>
            {flag ? <p className="flag">{flag}</p> : null}
            <div className="boxcharts">
              {CATEGORIES.map((category) => (
                <BoxChart key={category.id} label={category.label} stats={row.categories[category.id]} minScale={category.min} maxScale={category.max} />
              ))}
            </div>
            <PropertyCounts counts={row.chipCounts ?? {}} />
          </article>
        );
      })}
    </div>
  );
}

function BoxChart({ label, stats, minScale, maxScale }: { label: string; stats: CategoryStats; minScale: number; maxScale: number }) {
  const ready = stats.min !== null && stats.max !== null && stats.p25 !== null && stats.p75 !== null && stats.mean !== null;
  const span = maxScale - minScale;
  const at = (value: number) => ((value - minScale) / span) * 100;
  return (
    <div className="boxchart">
      <div className="boxchart__label">
        <span>{label}</span>
        <span>{stats.mean === null ? "—" : stats.mean.toFixed(1)}</span>
      </div>
      {ready ? (
        <div className="boxchart__track" aria-hidden="true">
          <i className="boxchart__whisker" style={{ left: `${at(stats.min!)}%`, width: `${at(stats.max!) - at(stats.min!)}%` }} />
          <i className="boxchart__box" style={{ left: `${at(stats.p25!)}%`, width: `${Math.max(at(stats.p75!) - at(stats.p25!), 2)}%` }} />
          <i className="boxchart__mean" style={{ left: `${at(stats.mean!)}%` }} />
        </div>
      ) : (
        <p className="label">No scores</p>
      )}
    </div>
  );
}

function PropertyCounts({ counts }: { counts: Record<string, number> }) {
  const groups = [
    { title: "Investable", chips: CHIP_GROUPS.investable },
    { title: "Cautious", chips: CHIP_GROUPS.cautious },
  ] as const;
  return (
    <div className="property-counts">
      {groups.map((group) => (
        <div key={group.title}>
          <h4 className="eyebrow">{group.title}</h4>
          <ul>
            {group.chips.map((chip) => (
              <li key={chip.id}>
                <span>{chip.label}</span>
                <b>{counts[chip.id] ?? 0}</b>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
