// Notes: score pads and chips (checklist 8.1–8.3). Every pitch except your own is open, in the game master's order. Closed locks every control (checklist 10.2). An open card closes once it scrolls above the screen. The score count sits under the cards. Submit unlocks Rank and explains that notes can still be edited.
import { CATEGORIES, CHIP_GROUPS, type CategoryId, type Phase, type PitchStatus } from "@we-rankin/shared";
import { useEffect, useRef, useState } from "react";
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

export function cardKind(pitch: NotePitch, _phase: Phase, selfId: string | null, selfName: string | null = null): CardKind {
  if (pitch.presenterId && pitch.presenterId === selfId) return "own";
  const presenter = pitch.presenterName.trim().toLowerCase();
  if (selfName && presenter === selfName.trim().toLowerCase()) return "own";
  return "score";
}

export function progressCount(pitches: NotePitch[], scores: NoteScore[], phase: Phase, selfId: string | null, selfName: string | null = null): { done: number; total: number } {
  const open = pitches.filter((pitch) => cardKind(pitch, phase, selfId, selfName) === "score");
  const done = open.filter((pitch) => CATEGORIES.every((category) => scores.some((score) => score.pitchId === pitch.id && score.category === category.id))).length;
  return { done, total: open.length };
}

export function toggleChip(selected: readonly string[], chipId: string): string[] {
  return selected.includes(chipId) ? selected.filter((id) => id !== chipId) : [...selected, chipId];
}

export function orderedPitches(pitches: NotePitch[]): NotePitch[] {
  return pitches;
}

export function Notes({
  phase,
  selfId,
  selfName = null,
  pitches,
  scores,
  chips,
  saved: _saved = false,
  samples = [],
  onWrite,
  onAddSample,
  onSubmit,
}: {
  phase: Phase;
  selfId: string | null;
  selfName?: string | null;
  pitches: NotePitch[];
  scores: NoteScore[];
  chips: Array<{ pitchId: string; chipIds: string[] }>;
  saved?: boolean;
  samples?: NotePitch[];
  onWrite?: (body: WriteBody) => void;
  onAddSample?: (pitch: NotePitch) => void;
  onSubmit?: () => void;
}) {
  const demo = samples.length > 0;
  const [rankPrompt, setRankPrompt] = useState(false);
  const [scoresSent, setScoresSent] = useState(false);
  const [demoScores, setDemoScores] = useState<NoteScore[]>([]);
  const [demoChips, setDemoChips] = useState<Array<{ pitchId: string; chipIds: string[] }>>([]);
  const focusId = pitches.find((pitch) => pitch.status === "presenting")?.id ?? "";
  const focusRef = useRef<HTMLElement | null>(null);
  const seen = useRef(focusId);
  useEffect(() => {
    if (!focusId || focusId === seen.current) return;
    seen.current = focusId;
    focusRef.current?.scrollIntoView({ block: "start" });
  }, [focusId]);

  const shown = demo ? samples : pitches;
  const shownScores = demo ? demoScores : scores;
  const shownChips = demo ? demoChips : chips;
  const progress = progressCount(shown, shownScores, demo ? "pitching" : phase, demo ? null : selfId, demo ? null : selfName);
  const ordered = orderedPitches(shown);
  function write(body: WriteBody): void {
    if (!demo) {
      onWrite?.(body);
      return;
    }
    if (body.type === "setScore") {
      setDemoScores((current) => [
        ...current.filter((score) => !(score.pitchId === body.pitchId && score.category === body.category)),
        { pitchId: body.pitchId, category: body.category, value: body.value },
      ]);
    }
    if (body.type === "setChips") {
      setDemoChips((current) => [...current.filter((set) => set.pitchId !== body.pitchId), { pitchId: body.pitchId, chipIds: body.chipIds }]);
    }
  }
  return (
    <div className="row notes">
      {ordered.map((pitch) => (
        <PitchCard
          key={pitch.id}
          pitch={pitch}
          kind={demo ? "score" : cardKind(pitch, phase, selfId, selfName)}
          scores={shownScores.filter((score) => score.pitchId === pitch.id)}
          chipIds={shownChips.find((set) => set.pitchId === pitch.id)?.chipIds ?? []}
          locked={!demo && phase === "closed"}
          {...(pitch.id === focusId ? { focusRef } : {})}
          {...(onWrite || demo ? { onWrite: write } : {})}
          {...(demo && onAddSample ? { onAdd: () => onAddSample(pitch) } : {})}
        />
      ))}
      {progress.total > 0 ? (
        <p className="notes-progress">
          {demo ? "Samples are not in the vote until you add them. " : ""}
          {progress.done} of {progress.total} pitches scored
        </p>
      ) : null}
      <button
        type="button"
        className={scoresSent ? "btn btn--join btn--resubmit btn--block" : "btn btn--primary btn--block"}
        disabled={phase === "closed" || progress.total === 0}
        onClick={() => {
          onSubmit?.();
          if (!scoresSent) setRankPrompt(true);
          setScoresSent(true);
        }}
      >
        {scoresSent ? "Resubmit Scores" : "Submit scores"}
      </button>
      {rankPrompt ? (
        <div className="modal-scrim modal-scrim--center">
          <div className="modal" role="dialog" aria-labelledby="rank-prompt-title">
            <h3 className="modal__title" id="rank-prompt-title">Scores submitted</h3>
            <p>Go rank your votes in the Rank tab. You can always come back to modify your notes.</p>
            <div className="modal__actions">
              <button type="button" className="btn btn--primary btn--block" onClick={() => setRankPrompt(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  onAdd,
}: {
  pitch: NotePitch;
  kind: CardKind;
  scores: NoteScore[];
  chipIds: string[];
  focusRef?: { current: HTMLElement | null };
  locked?: boolean;
  onWrite?: (body: WriteBody) => void;
  onAdd?: () => void;
}) {
  const [open, setOpen] = useState(locked || scores.length > 0 || chipIds.length > 0);
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !open) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && entry.boundingClientRect.bottom < 0) setOpen(false);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);
  if (kind !== "score") {
    return (
      <section className="panel panel--locked" ref={focusRef}>
        <div className="pitch__head">
          <span className="status-pill status-pill--next">{kind === "own" ? "Your pitch" : "Coming up"}</span>
          <h3 className="card-title">{pitch.title}</h3>
          <span className="label">Your pitch — no scoring</span>
        </div>
      </section>
    );
  }
  return (
    <section
      className="panel"
      data-pitch={pitch.id}
      id={`pitch-${pitch.id}`}
      ref={(node) => {
        sectionRef.current = node;
        if (focusRef) focusRef.current = node;
      }}
    >
      <button type="button" className="pitch__head" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="pitch__mark" aria-hidden="true" />
        <span className="card-title">{pitch.title}</span>
        <span className="label">Presented by {pitch.presenterName}</span>
      </button>
      {open ? <div className="pitch__body">{CATEGORIES.map((category) => {
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
      {onAdd ? (
        <button type="button" className="btn btn--secondary btn--block" onClick={onAdd}>
          Add to the vote
        </button>
      ) : null}
      </div> : null}
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
