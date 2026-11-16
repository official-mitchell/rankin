// Host alert for checklist 5.4. Players do not see A1 or A2.
import type { ServerAlert } from "@we-rankin/shared";

export function AlertBanner({
  alert,
  isHost,
  onDownload,
}: {
  alert: ServerAlert | null;
  isHost: boolean;
  onDownload: () => void;
}) {
  if (!alert || !isHost) return null;
  return (
    <div className="alert-banner" role="status">
      <p>
        {alert.code} — {alert.message}
      </p>
      <button type="button" onClick={onDownload}>
        Download raw JSON
      </button>
    </div>
  );
}
