// Borda headline, score bars, flags, and counted versus voided names (checklist 10.1).
import type { CategoryStats, PitchResult, Results } from "@we-rankin/shared";

export type ResultPitch = { id: string; title: string };
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
}: {
  results: Results;
  pitches: ResultPitch[];
  players: ResultPlayer[];
}) {
  const titleOf = new Map(pitches.map((pitch) => [pitch.id, pitch.title]));
  const borda = [...results.pitches].sort((left, right) => left.bordaRank - right.bordaRank || right.borda - left.borda);
  const counted = namesFor(results.countedPlayerIds, players);
  const voided = namesFor(results.voidedPlayerIds, players);

  return (
    <div className="row results">
      <section className="panel panel--quiet">
        <p className="eyebrow">★ Polls closed ★</p>
        <p className="label">Counted</p>
        <p className="voter-names">{counted.length === 0 ? "None" : counted.join(", ")}</p>
        <p className="label">Not submitted before close — ballot not counted</p>
        <p className="voter-names voter-names--void">{voided.length === 0 ? "None" : voided.join(", ")}</p>
      </section>
      <section className="panel panel--inset-frame">
        <p className="eyebrow">★ Borda ranking ★</p>
        {borda.map((row) => {
          const flag = flagLabel(row);
          return (
            <article key={row.pitchId} className={row.bordaRank === 1 ? "result result--1" : "result"} data-rank={row.bordaRank}>
              <div className={`medal medal--${row.bordaRank <= 3 ? row.bordaRank : "n"}`}>{row.bordaRank}</div>
              <div>
                <h4 className="result__title">{titleOf.get(row.pitchId) ?? row.pitchId}</h4>
                {flag ? <div className="result__meta"><span className="flag">{flag}</span></div> : null}
                <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, row.borda * 100))}%` }} /></div>
              </div>
              <div className="result__score"><div className="numeral">{bordaLabel(row.borda)}</div></div>
            </article>
          );
        })}
      </section>
      <section className="panel panel--quiet">
        <p className="eyebrow">Score leaderboard</p>
        <p className="label">Hotness ÷ 2</p>
        {scoreOrder(results.pitches).map((row) => {
          const widths = stackWidths(row.categories);
          return (
            <article key={row.pitchId} className="score-row">
              <h4 className="result__title">{titleOf.get(row.pitchId) ?? row.pitchId}</h4>
              <div className="stackbar" aria-hidden="true">
                <i className="stackbar__comp" style={{ width: `${widths.comp}%` }} />
                <i className="stackbar__fun" style={{ width: `${widths.fun}%` }} />
                <i className="stackbar__hot" style={{ width: `${widths.hot}%` }} />
              </div>
              <p className="numeral score-row__total">{row.scoreTotal === null ? "—" : `${row.scoreTotal.toFixed(1)} / 15`}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
