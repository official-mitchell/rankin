// Pitch-by-pitch results. Each pitch starts collapsed behind an award header. The open panel explains the total score, crowd placement, and first-place votes, then shows category ranges and only the traits that received votes.
import { CATEGORIES, CHIP_GROUPS, type CategoryStats, type PitchResult, type Results } from "@we-rankin/shared";

export type ResultPitch = { id: string; title: string; presenterName?: string };
export type ResultPlayer = { id: string; name: string };

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
  const counted = results.countedPlayerIds.map((id) => ({ id, name: players.find((player) => player.id === id)?.name ?? id }));
  const voided = results.voidedPlayerIds.map((id) => ({ id, name: players.find((player) => player.id === id)?.name ?? id }));

  return (
    <div className="row results">
      {onNewSession ? (
        <button type="button" className="btn btn--primary btn--block" onClick={onNewSession}>
          Create a new session
        </button>
      ) : null}
      <section className="panel panel--quiet">
        <p className="eyebrow eyebrow--center">★ Polls closed ★</p>
        <p className="label">Counted</p>
        {counted.length === 0 ? (
          <p className="voter-names">None</p>
        ) : (
          <ol className="voter-names voter-names--list">
            {counted.map((player) => (
              <li key={player.id}>{player.name}</li>
            ))}
          </ol>
        )}
        {voided.length > 0 ? (
          <>
            <p className="label">Not submitted before close — ballot not counted</p>
            <ol className="voter-names voter-names--list voter-names--void">
              {voided.map((player) => (
                <li key={player.id}>{player.name}</li>
              ))}
            </ol>
          </>
        ) : null}
      </section>
      {borda.map((row) => {
        const pitch = pitches.find((item) => item.id === row.pitchId);
        const flag = flagLabel(row);
        const title = pitch?.title ?? titleOf.get(row.pitchId) ?? row.pitchId;
        const medal = row.bordaRank <= 3 ? `medal--${row.bordaRank}` : "medal--n";
        return (
          <details key={row.pitchId} className="panel pitch-result" data-rank={row.bordaRank}>
            <summary className="pitch-result__summary">
              <span className={`medal ${medal}`} aria-hidden="true">
                {row.bordaRank}
              </span>
              <span className="pitch-result__identity">
                <h3 className="card-title">{title}</h3>
                {pitch?.presenterName ? <p className="label">Presented by {pitch.presenterName}</p> : null}
              </span>
            </summary>
            <div className="pitch-result__body">
              <div className="pitch-result__score">
                <p className="pitch-result__score-value">{row.scoreTotal === null ? "—" : row.scoreTotal.toFixed(1)}</p>
                <p className="pitch-result__score-caption">
                  Total score. Compellingness and Investability count in full. Hotness ÷ 2, so the highest possible total is 15.
                </p>
              </div>
              <dl className="pitch-result__explain">
                <div>
                  <dt>Crowd placement {row.borda.toFixed(2)}</dt>
                  <dd>How near the top voters ranked this pitch. 1.00 means every ballot put it first. 0.00 means it finished last whenever it was ranked.</dd>
                </div>
                <div>
                  <dt>First-place votes {row.firstPlaceCount}</dt>
                  <dd>Ballots that ranked this pitch number one.</dd>
                </div>
              </dl>
              {flag ? <p className="flag">{flag}</p> : null}
              <div className="boxcharts">
                {CATEGORIES.map((category) => (
                  <BoxChart key={category.id} label={category.label} stats={row.categories[category.id]} minScale={category.min} maxScale={category.max} />
                ))}
              </div>
              <PropertyCounts counts={row.chipCounts ?? {}} />
            </div>
          </details>
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
        <span>Average {stats.mean === null ? "—" : stats.mean.toFixed(1)}</span>
      </div>
      {ready ? (
        <>
          <div className="boxchart__track" role="img" aria-label={`${label} from ${stats.min} to ${stats.max}, average ${stats.mean?.toFixed(1)}`}>
            <i className="boxchart__scale" />
            <i className="boxchart__whisker" style={{ left: `${at(stats.min!)}%`, width: `${at(stats.max!) - at(stats.min!)}%` }} />
            <i className="boxchart__box" style={{ left: `${at(stats.p25!)}%`, width: `${Math.max(at(stats.p75!) - at(stats.p25!), 2)}%` }} />
            <i className="boxchart__mean" style={{ left: `${at(stats.mean!)}%` }} />
          </div>
          <p className="boxchart__ends">
            <span>{minScale}</span>
            <span>
              Lowest {stats.min} · Highest {stats.max}
            </span>
            <span>{maxScale}</span>
          </p>
        </>
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
      {groups.map((group) => {
        const picked = group.chips
          .map((chip) => ({ ...chip, votes: counts[chip.id] ?? 0 }))
          .filter((chip) => chip.votes > 0)
          .sort((left, right) => right.votes - left.votes || left.label.localeCompare(right.label));
        if (picked.length === 0) return null;
        const peak = picked[0]?.votes ?? 1;
        return (
          <div key={group.title}>
            <h3 className="property-counts__title">{group.title}</h3>
            <ul>
              {picked.map((chip) => (
                <li key={chip.id}>
                  <span>{chip.label}</span>
                  <b style={{ color: voteColor(chip.votes, peak) }}>{chip.votes}</b>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function voteColor(votes: number, peak: number): string {
  const share = peak === 0 ? 0 : votes / peak;
  const mix = Math.round(share * 100);
  return `color-mix(in srgb, var(--gold-200) ${mix}%, var(--text-muted))`;
}
