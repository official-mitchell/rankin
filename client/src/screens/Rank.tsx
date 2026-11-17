// Ranking list, NEW pitches, and submit gate (checklist 9.1–9.3). Closed disables moves (checklist 10.2). The handle sets role and tabIndex itself; sortable attributes that repeat those keys are dropped.
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CATEGORIES, CHIPS, type CategoryId, type MissingItem } from "@we-rankin/shared";
import type { WriteBody } from "../realtime/queue";

export type RankPitch = { id: string; title: string; presenterName: string };

export type RankScore = { pitchId: string; category: CategoryId; value: number };

export function missingLabel(item: MissingItem, pitches: RankPitch[]): string {
  const title = pitches.find((pitch) => pitch.id === item.pitchId)?.title ?? "Pitch";
  if (item.kind === "unplaced") return `Place ${title}`;
  const category = CATEGORIES.find((entry) => entry.id === item.category);
  return `${title} · ${category?.label ?? item.category}`;
}

export function RankList({
  order,
  placed,
  pitches,
  scores,
  chips,
  missing,
  submitted,
  locked = false,
  onWrite,
}: {
  order: string[];
  placed: string[];
  pitches: RankPitch[];
  scores: RankScore[];
  chips: Array<{ pitchId: string; chipIds: string[] }>;
  missing: MissingItem[];
  submitted: boolean;
  locked?: boolean;
  onWrite?: (body: WriteBody) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(pitches.map((pitch) => [pitch.id, pitch]));
  const rows = order.map((id) => byId.get(id)).filter((pitch): pitch is RankPitch => Boolean(pitch));

  function move(pitchId: string, toIndex: number): void {
    if (locked) return;
    onWrite?.({ type: "movePitch", pitchId, toIndex });
  }

  function onDragEnd(event: DragEndEvent): void {
    const overId = event.over?.id;
    if (!overId || event.active.id === overId) return;
    const toIndex = order.indexOf(String(overId));
    if (toIndex < 0) return;
    move(String(event.active.id), toIndex);
  }

  return (
    <div className="row rank-screen">
      <p className="eyebrow">Your ballot</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((pitch) => pitch.id)} strategy={verticalListSortingStrategy}>
          <ol className="rank-list">
            {rows.map((pitch, index) => (
              <RankCard
                key={pitch.id}
                pitch={pitch}
                index={index}
                last={index === rows.length - 1}
                isNew={!placed.includes(pitch.id)}
                scores={scores.filter((score) => score.pitchId === pitch.id)}
                chipLabels={(chips.find((set) => set.pitchId === pitch.id)?.chipIds ?? []).map((id) => CHIPS.find((chip) => chip.id === id)?.label ?? id)}
                locked={locked}
                onMove={move}
                onPlace={() => onWrite?.({ type: "placePitch", pitchId: pitch.id })}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <section className={`panel submit-bar ${missing.length === 0 ? "submit-bar--ready" : ""}`}>
        {submitted ? <p className="notice">Submitted ✓ — edits still save</p> : null}
        <button type="button" className="btn btn--primary btn--block btn--ballot" disabled={locked} onClick={() => onWrite?.({ type: "submitBallot" })}>
          Submit ballot
        </button>
      </section>
    </div>
  );
}

function RankCard({
  pitch,
  index,
  last,
  isNew,
  scores,
  chipLabels,
  locked,
  onMove,
  onPlace,
}: {
  pitch: RankPitch;
  index: number;
  last: boolean;
  isNew: boolean;
  scores: RankScore[];
  chipLabels: string[];
  locked: boolean;
  onMove: (pitchId: string, toIndex: number) => void;
  onPlace: () => void;
}) {
  const sortable = useSortable({ id: pitch.id, disabled: locked });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={isNew ? "rank rank--new" : sortable.isDragging ? "rank rank--dragging" : "rank"}
      id={`pitch-${pitch.id}`}
    >
      <div
        className="rank__handle"
        aria-label={`Drag ${pitch.title}`}
        {...sortable.attributes}
        role="button"
        tabIndex={0}
        {...sortable.listeners}
      >
        <i />
      </div>
      <div className="rank__pos">{index + 1}</div>
      <div className="rank__body">
        <p className="rank__title">
          {pitch.title}
          {isNew ? <span className="badge-new">NEW</span> : null}
        </p>
        <p className="label">{pitch.presenterName}</p>
        <div className="rank__scores">
          {CATEGORIES.map((category) => (
            <b key={category.id} style={{ ["--dot" as string]: `var(--cat-${category.id === "compellingness" ? "comp" : category.id === "funniness" ? "fun" : "hot"}-fill)` }}>
              {scores.find((score) => score.category === category.id)?.value ?? "–"}
            </b>
          ))}
        </div>
        {chipLabels.length > 0 ? (
          <ul className="rank__chips">
            {chipLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : null}
        {isNew ? (
          <button type="button" className="btn btn--gold" disabled={locked} onClick={onPlace}>
            Place here
          </button>
        ) : null}
      </div>
      <div className="rank__moves">
        <button type="button" className="rank__move rank__move--up" aria-label="Move up" disabled={locked || index === 0} onClick={() => onMove(pitch.id, index - 1)}>
          <i />
        </button>
        <button type="button" className="rank__move rank__move--down" aria-label="Move down" disabled={locked || last} onClick={() => onMove(pitch.id, index + 1)}>
          <i />
        </button>
      </div>
    </li>
  );
}
