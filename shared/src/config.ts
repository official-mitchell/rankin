// Seed config for checklist 2.1. Chip copy is the PRD v0.2 seed list.
import type { CategoryId } from "./types";

export const NAME_MIN = 1;
export const NAME_MAX = 24;
export const TITLE_MIN = 1;
export const TITLE_MAX = 80;
export const CODE_LENGTH = 6;

/** Unambiguous alphabet: no 0, O, 1, I, or L. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type CategoryConfig = {
  id: CategoryId;
  label: string;
  min: number;
  max: number;
  weight: number;
};

export const CATEGORIES: readonly CategoryConfig[] = [
  { id: "compellingness", label: "Compellingness", min: 1, max: 5, weight: 1 },
  { id: "funniness", label: "Funniness", min: 1, max: 5, weight: 1 },
  { id: "hotness", label: "Hotness", min: 1, max: 10, weight: 0.5 },
];

export const HOTNESS_WEIGHT = 0.5;

/** Compellingness max + Funniness max + Hotness max × 0.5. */
export const MAX_SCORE_TOTAL = CATEGORIES.reduce((sum, category) => sum + category.max * category.weight, 0);

export type ChipGroupId = "investable" | "cautious";

export type Chip = { id: string; label: string; group: ChipGroupId };

const INVESTABLE_LABELS = [
  "Huge market",
  "Sticky recurring revenue",
  "Defensible moat",
  "Killer founder energy",
  "Scales absurdly fast",
  "Clear first customer",
  "Pitch was airtight",
] as const;

const CAUTIOUS_LABELS = [
  "Lawsuit magnet",
  "Unit economics are fiction",
  "Regulators will notice",
  "Founder is the risk",
  "Zero repeat customers",
  "Reputationally radioactive",
  "Execution nightmare",
] as const;

function chipId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function chips(group: ChipGroupId, labels: readonly string[]): Chip[] {
  return labels.map((label) => ({ id: chipId(label), label, group }));
}

export const CHIP_GROUPS: Record<ChipGroupId, readonly Chip[]> = {
  investable: chips("investable", INVESTABLE_LABELS),
  cautious: chips("cautious", CAUTIOUS_LABELS),
};

export const CHIPS: readonly Chip[] = [...CHIP_GROUPS.investable, ...CHIP_GROUPS.cautious];
