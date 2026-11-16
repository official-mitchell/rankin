// Shared package entry. Re-exports domain types, config, stats, Borda, ballots, results, and exports (checklist 2 and 11).
export const APP_NAME = "We Rankin'";

export { EVENTS, type EventName } from "./events";
export { METRIC_NAMES, isMetricName, type MetricName } from "./metrics";
export { ALERT_A1, ALERT_A2, alertForUncaught, alertForWriteFailed, type ServerAlert } from "./alerts";
export {
  CATEGORIES,
  CHIP_GROUPS,
  CHIPS,
  CODE_ALPHABET,
  CODE_LENGTH,
  HOTNESS_WEIGHT,
  MAX_SCORE_TOTAL,
  NAME_MAX,
  NAME_MIN,
  TITLE_MAX,
  TITLE_MIN,
  type CategoryConfig,
  type Chip,
  type ChipGroupId,
} from "./config";
export type {
  Ballot,
  CategoryId,
  CategoryStats,
  ClientMessage,
  ClientMessageType,
  ChipSet,
  ClientView,
  ViewPitch,
  DisagreementDirection,
  MissingItem,
  Phase,
  Pitch,
  PitchResult,
  PitchStatus,
  Player,
  PlayerRole,
  Results,
  Score,
  ServerMessage,
  ServerMessageType,
  SessionSnapshot,
} from "./types";
export { competitionRank, max, mean, min, percentile, popSD, scoreTotal } from "./stats";
export { borda, firstPlaceCount, rankPitches, type RankedRow, type RankRow } from "./borda";
export {
  applyMove,
  applyNewPitch,
  applyPlace,
  applyRemovePitch,
  ballotComplete,
  eligiblePitches,
  missingItems,
  type BallotDraft,
} from "./ballot";
export { computeResults } from "./results";
export { ballotCsv, markdownSummary, summaryCsv, voterIndexes, type ExportBundle, type ExportChip, type ExportPitch, type ExportPlayer } from "./table-export";
export { chartFontFace, chartPitches, leaderboardSvg, pitchCardSvg, pngFileName, wrapTitle, type ChartPitch, type ChartVotes } from "./charts";
