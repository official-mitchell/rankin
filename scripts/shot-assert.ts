// Pure checks used by npm run shots. The broken samples below are the checklist 3.4 tripwires; no broken scene is kept.
export type ShotProbe = {
  scrollWidth: number;
  clientWidth: number;
  clipped: number;
  smallTargets: number;
  consoleErrors: string[];
};

export function shotFailures(probe: ShotProbe): string[] {
  const failures: string[] = [];
  if (probe.scrollWidth > probe.clientWidth) failures.push("horizontal overflow");
  if (probe.clipped > 0) failures.push("clipped text");
  if (probe.smallTargets > 0) failures.push("tap target under 48px");
  if (probe.consoleErrors.length > 0) failures.push("console error");
  return failures;
}
