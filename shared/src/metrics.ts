// Counter names stored in the session Durable Object `metrics` table.
export const METRIC_NAMES = [
  "sessions_created",
  "players_joined",
  "writes_ok",
  "writes_failed",
  "reconnects",
  "ballots_submitted",
  "rate_limited",
  "tallies_run",
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

export function isMetricName(value: string): value is MetricName {
  return (METRIC_NAMES as readonly string[]).includes(value);
}
