// Shared package entry. Pure types and config land here in checklist section 2.
export const APP_NAME = "We Rankin'";

export { EVENTS, type EventName } from "./events";
export { METRIC_NAMES, isMetricName, type MetricName } from "./metrics";
export { ALERT_A1, ALERT_A2, alertForUncaught, alertForWriteFailed, type ServerAlert } from "./alerts";
