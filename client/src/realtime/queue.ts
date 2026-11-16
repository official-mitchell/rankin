// Ordered write queue for checklist 5.3 and host console writes (checklist 7).
import { applyMove, applyPlace } from "@we-rankin/shared";
import type { CategoryId, ClientView } from "@we-rankin/shared";

export type WriteBody =
  | { type: "setScore"; pitchId: string; category: CategoryId; value: number }
  | { type: "setChips"; pitchId: string; chipIds: string[] }
  | { type: "movePitch"; pitchId: string; toIndex: number }
  | { type: "placePitch"; pitchId: string }
  | { type: "submitBallot" }
  | { type: "join"; name: string }
  | { type: "reclaim"; name: string }
  | { type: "host.promote"; name: string }
  | { type: "host.removePlayer"; name: string }
  | { type: "host.releaseName"; name: string }
  | { type: "host.startPitching" }
  | { type: "host.openVoting" }
  | { type: "host.closeVoting" }
  | { type: "host.addPitch"; title: string; presenterName: string; presenterPlayerId: string | null }
  | { type: "host.updatePitch"; pitchId: string; title?: string; presenterName?: string; presenterPlayerId?: string | null }
  | { type: "host.removePitch"; pitchId: string }
  | { type: "host.setStatus"; pitchId: string; status: "upcoming" | "presenting" | "done" };

export type PendingWrite = {
  clientSeq: number;
  body: WriteBody;
  before: ClientView | null;
};

export function nextSeq(lastSeq: number): number {
  return lastSeq + 1;
}

export function applyOptimistic(view: ClientView, body: WriteBody): ClientView {
  if (body.type === "setScore" && view.self?.playerId) {
    const scores = (view.scores ?? []).filter(
      (score) => !(score.playerId === view.self?.playerId && score.pitchId === body.pitchId && score.category === body.category),
    );
    scores.push({ playerId: view.self.playerId, pitchId: body.pitchId, category: body.category, value: body.value });
    return { ...view, scores };
  }
  if (body.type === "setChips") {
    const chips = (view.chips ?? []).filter((set) => set.pitchId !== body.pitchId);
    chips.push({ pitchId: body.pitchId, chipIds: body.chipIds });
    return { ...view, chips };
  }
  if (!view.ballot) return view;
  if (body.type === "movePitch") {
    return { ...view, ballot: { ...view.ballot, ...applyMove(view.ballot, body.pitchId, body.toIndex) } };
  }
  if (body.type === "placePitch") {
    return { ...view, ballot: { ...view.ballot, ...applyPlace(view.ballot, body.pitchId) } };
  }
  if (body.type === "submitBallot") return { ...view, ballot: { ...view.ballot, submitted: true } };
  return view;
}

export function enqueue(
  view: ClientView | null,
  pending: readonly PendingWrite[],
  body: WriteBody,
  lastSeq: number,
): { view: ClientView | null; pending: PendingWrite[]; lastSeq: number } {
  const clientSeq = nextSeq(lastSeq);
  const nextView = view ? applyOptimistic(view, body) : view;
  return { view: nextView, pending: [...pending, { clientSeq, body, before: view }], lastSeq: clientSeq };
}

export function ack(view: ClientView | null, pending: readonly PendingWrite[], clientSeq: number): { view: ClientView | null; pending: PendingWrite[] } {
  return { view, pending: pending.filter((item) => item.clientSeq !== clientSeq) };
}

export function rejectWrite(
  view: ClientView | null,
  pending: readonly PendingWrite[],
  clientSeq: number | undefined,
): { view: ClientView | null; pending: PendingWrite[]; toast: string } {
  const item = pending.find((entry) => entry.clientSeq === clientSeq);
  const rest = pending.filter((entry) => entry.clientSeq !== clientSeq);
  let next = item?.before ?? view;
  for (const entry of rest) {
    if (next) next = applyOptimistic(next, entry.body);
  }
  return { view: next, pending: rest, toast: "That change was not saved" };
}

export function paintPending(view: ClientView, pending: readonly PendingWrite[]): ClientView {
  return pending.reduce((current, item) => applyOptimistic(current, item.body), view);
}

export function wireMessage(item: PendingWrite): WriteBody & { clientSeq: number } {
  return { ...item.body, clientSeq: item.clientSeq };
}
