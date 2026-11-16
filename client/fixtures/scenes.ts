// Scene registry for checklist 3.3. Saving, offline, and alert scenes are checklist 5.3–5.4.
import type { ClientView } from "@we-rankin/shared";
import bannerA1 from "./banner-a1.json";
import bannerA2 from "./banner-a2.json";
import offlinePending from "./offline-pending.json";
import saving from "./saving.json";
import shell from "./shell.json";

export const SCENES = {
  shell: shell as ClientView,
  saving: saving as ClientView,
  "offline-pending": offlinePending as ClientView,
  "banner-a1": bannerA1 as ClientView,
  "banner-a2": bannerA2 as ClientView,
} as const satisfies Record<string, ClientView>;

export type SceneName = keyof typeof SCENES;

export const SCENE_NAMES = Object.keys(SCENES) as SceneName[];
