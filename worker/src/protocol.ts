// Zod schemas for checklist 4.4. Writes carry clientSeq. Unknown types become bad_message.
import { CATEGORIES, NAME_MAX, TITLE_MAX } from "@we-rankin/shared";
import { z } from "zod";

const categoryIds = CATEGORIES.map((category) => category.id) as [string, ...string[]];
const seq = z.number().int();
const name = z.string().trim().min(1).max(NAME_MAX);
const title = z.string().trim().min(1).max(TITLE_MAX);

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    playerId: z.string().min(1).optional(),
    hostSecret: z.string().min(1).optional(),
  }),
  z.object({ type: z.literal("join"), name, clientSeq: seq }),
  z.object({ type: z.literal("reclaim"), name, clientSeq: seq }),
  z.object({
    type: z.literal("setScore"),
    pitchId: z.string().min(1),
    category: z.enum(categoryIds),
    value: z.number().int(),
    clientSeq: seq,
  }),
  z.object({
    type: z.literal("setChips"),
    pitchId: z.string().min(1),
    chipIds: z.array(z.string().min(1)).max(32),
    clientSeq: seq,
  }),
  z.object({
    type: z.literal("movePitch"),
    pitchId: z.string().min(1),
    toIndex: z.number().int(),
    clientSeq: seq,
  }),
  z.object({ type: z.literal("placePitch"), pitchId: z.string().min(1), clientSeq: seq }),
  z.object({ type: z.literal("submitBallot"), clientSeq: seq }),
  z.object({
    type: z.literal("host.addPitch"),
    title,
    presenterName: name,
    presenterPlayerId: z.string().min(1).nullable(),
    clientSeq: seq,
  }),
  z.object({
    type: z.literal("host.updatePitch"),
    pitchId: z.string().min(1),
    title: title.optional(),
    presenterName: name.optional(),
    presenterPlayerId: z.string().min(1).nullable().optional(),
    clientSeq: seq,
  }),
  z.object({ type: z.literal("host.removePitch"), pitchId: z.string().min(1), clientSeq: seq }),
  z.object({ type: z.literal("host.reorderPitches"), pitchIds: z.array(z.string().min(1)).max(80), clientSeq: seq }),
  z.object({
    type: z.literal("host.setStatus"),
    pitchId: z.string().min(1),
    status: z.enum(["upcoming", "presenting", "done"]),
    clientSeq: seq,
  }),
  z.object({ type: z.literal("host.startPitching"), clientSeq: seq }),
  z.object({ type: z.literal("host.openVoting"), clientSeq: seq }),
  z.object({ type: z.literal("host.closeVoting"), clientSeq: seq }),
  z.object({ type: z.literal("host.promote"), name, clientSeq: seq }),
  z.object({ type: z.literal("host.removePlayer"), name, clientSeq: seq }),
  z.object({ type: z.literal("host.releaseName"), name, clientSeq: seq }),
  z.object({
    type: z.literal("client.error"),
    message: z.string().max(500),
    stack: z.string().max(1024).optional(),
  }),
]);

export type ClientCommand = z.infer<typeof clientMessageSchema>;

const OPEN = new Set(["hello", "join", "reclaim"]);

export function isOpenCommand(type: string): boolean {
  return OPEN.has(type);
}

export function parseClientMessage(raw: string): { ok: true; command: ClientCommand } | { ok: false; code: "bad_message" } {
  if (raw.length > 8 * 1024) return { ok: false, code: "bad_message" };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, code: "bad_message" };
  }
  const parsed = clientMessageSchema.safeParse(body);
  if (!parsed.success) return { ok: false, code: "bad_message" };
  return { ok: true, command: parsed.data };
}
