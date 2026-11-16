// Host-console banners. No pager. Both tell the host to download raw JSON.
export type ServerAlert = {
  code: "A1" | "A2";
  message: string;
};

export const ALERT_A1: ServerAlert = {
  code: "A1",
  message: "Save failed — download raw JSON now",
};

export const ALERT_A2: ServerAlert = {
  code: "A2",
  message: "Server error — download raw JSON now",
};

export function alertForWriteFailed(count: number): ServerAlert | null {
  return count >= 1 ? ALERT_A1 : null;
}

export function alertForUncaught(): ServerAlert {
  return ALERT_A2;
}
