// Notes: score pads, chips, and the presenting pitch (checklist 8.1–8.3). Closed locks every control (checklist 10.2). Optional card props are omitted when unset so exactOptionalPropertyTypes accepts the build.
import { CATEGORIES, CHIP_GROUPS, type CategoryId, type Phase, type PitchStatus } from "@we-rankin/shared";
import { useEffect, useRef } from "react";
import type { WriteBody } from "../realtime/queue";

export type NotePitch = {
  id: string;
  title: string;
  presenterName: string;
  presenterId: string | null;
  status: PitchStatus;
};

export type NoteScore = { pitchId: string; category: CategoryId; value: number };

type CardKind = "score" | "own" | "upcoming";

export function cardKind(pitch: NotePitch, phase: Phase, selfId: string | null): CardKind {
  if (pitch.presenterId && pitch.presenterId === selfId) return "own";
  if (phase === "voting" || phase === "closed" || pitch.status === "presenting" || pitch.status === "done") return "score";
  return "upcoming";
}

export function progressCount(pitches: NotePitch[], scores: NoteScore[], phase: Phase, selfId: string | null): { done: number; total: number } {
  const open = pitches.filter((pitch) => cardKind(pitch, phase, selfId) === "score");
  const done = open.filter((pitch) => CATEGORIES.every((category) => scores.some((score) => score.pitchId === pitch.id && score.category === category.id))).length;
  return { done, total: open.length };
}

export function toggleChip(selected: readonly string[], chipId: string): string[] {
  return selected.includes(chipId) ? selected.filter((id) => id !== chipId) : [...selected, chipId];
}

export function orderedPitches(pitches: NotePitch[]): NotePitch[] {
  const presenting = pitches.filter((pitch) => pitch.status === "presenting");
  const rest = pitches.filter((pitch) => pitch.status !== "presenting");
  return [...presenting, ...rest];
}

export function Notes({
  phase,
  selfId,
  pitches,
  scores,
  chips,
  saved = false,
  onWrite,
}: {
  phase: Phase;
  selfId: string | null;
  pitches: NotePitch[];
  scores: NoteScore[];
  chips: Array<{ pitchId: string; chipIds: string[] }>;
  saved?: boolean;
  onWrite?: (body: WriteBody) => void;
}) {
  const focusId = pitches.find((pitch) => pitch.status === "presenting")?.id ?? "";
  const focusRef = useRef<HTMLElement | null>(null);
  const seen = useRef(focusId);
  useEffect(() => {
    if (!focusId || focusId === seen.current) return;
    seen.current = focusId;
    focusRef.current?.scrollIntoView({ block: "start" });
  }, [focusId]);

  const progress = progressCount(pitches, scores, phase, selfId);
  const ordered = orderedPitches(pitches);
  const upcoming = ordered.filter((pitch) => cardKind(pitch, phase, selfId) === "upcoming");
  const active = ordered.filter((pitch) => cardKind(pitch, phase, selfId) !== "upcoming");

  return (
    <div className="row notes">
      <p className="eyebrow">{progress.done}/{progress.total} scored</p>
      {saved ? <p className="label">Saved</p> : null}
      {active.map((pitch) => (
        <PitchCard
          key={pitch.id}
          pitch={pitch}
          kind={cardKind(pitch, phase, selfId)}
          scores={scores.filter((score) => score.pitchId === pitch.id)}
          chipIds={chips.find((set) => set.pitchId === pitch.id)?.chipIds ?? []}
          locked={phase === "closed"}
          {...(pitch.id === focusId ? { focusRef } : {})}
          {...(onWrite ? { onWrite } : {})}
        />
      ))}
      {upcoming.length > 0 ? <p className="eyebrow">Coming up</p> : null}
      {upcoming.map((pitch) => (
        <PitchCard
          key={pitch.id}
          pitch={pitch}
          kind="upcoming"
          scores={[]}
          chipIds={[]}
          {...(onWrite ? { onWrite } : {})}
        />
      ))}
    </div>
  );
}

function PitchCard({
  pitch,
  kind,
  scores,
  chipIds,
  focusRef,
  locked = false,
  onWrite,
}: {
  pitch: NotePitch;
  kind: CardKind;
  scores: NoteScore[];
  chipIds: string[];
  focusRef?: { current: HTMLElement | null };
  locked?: boolean;
  onWrite?: (body: WriteBody) => void;
}) {
  if (kind !== "score") {
    return (
      <section className="panel panel--locked" ref={focusRef}>
        <div className="pitch__head">
          <span className="status-pill status-pill--next">{kind === "own" ? "Your pitch" : "Coming up"}</span>
          <h3 className="card-title">{pitch.title}</h3>
          <span className="label">{kind === "own" ? "Your pitch — no scoring" : "Unlocks when presenting"}</span>
        </div>
      </section>
    );
  }
  return (
    <section className="panel" ref={focusRef} data-pitch={pitch.id} id={`pitch-${pitch.id}`}>
      <div className="pitch__head">
        <span className={`status-pill ${pitch.status === "presenting" ? "status-pill--live" : "status-pill--done"}`}>
          {pitch.status === "presenting" ? "Now presenting" : "Done"}
        </span>
        <h3 className="card-title">{pitch.title}</h3>
        <span className="label">Presented by {pitch.presenterName}</span>
      </div>
      {CATEGORIES.map((category) => {
        const selected = scores.find((score) => score.category === category.id)?.value;
        const values = Array.from({ length: category.max - category.min + 1 }, (_, index) => category.min + index);
        return (
          <div key={category.id} className={`cat cat--${category.id === "compellingness" ? "comp" : category.id === "funniness" ? "fun" : "hot"}`}>
            <div className="cat__band">
              <span>{category.label}</span>
              <span className="cat__range">{category.min}–{category.max}</span>
            </div>
            <div className="pad">
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="score"
                  aria-pressed={selected === value}
                  disabled={locked}
                  onClick={() => onWrite?.({ type: "setScore", pitchId: pitch.id, category: category.id, value })}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <ChipGroups
        chipIds={chipIds}
        locked={locked}
        onToggle={(chipId) => onWrite?.({ type: "setChips", pitchId: pitch.id, chipIds: toggleChip(chipIds, chipId) })}
      />
    </section>
  );
}

function ChipGroups({ chipIds, locked, onToggle }: { chipIds: string[]; locked: boolean; onToggle: (chipId: string) => void }) {
  const groups = [
    { title: "Investable because…", tone: "invest", chips: CHIP_GROUPS.investable },
    { title: "Cautious because…", tone: "caution", chips: CHIP_GROUPS.cautious },
  ] as const;
  return (
    <div className="chip-groups">
      {groups.map((group) => (
        <div key={group.tone} className="chip-group">
          <h4 className="eyebrow chip-group__title">{group.title}</h4>
          <div className="chips">
            {group.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`chip chip--${group.tone}`}
                aria-pressed={chipIds.includes(chip.id)}
                disabled={locked}
                onClick={() => onToggle(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
