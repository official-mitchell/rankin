// Reads #h= from the session URL, stores it, and returns a fragment-free URL (checklist 3.2).
// A device remembers every session it has hosted or joined so a refresh can list them and say hello again.
const KEY_PREFIX = "we-rankin:host:";
const EDITED_PREFIX = "we-rankin:edited:";
const PLAYER_PREFIX = "we-rankin:player:";
const NAME_PREFIX = "we-rankin:name:";

export type DeviceSession = { code: string; role: "host" | "player"; name: string | null; editedAt: number | null };

type ListStorage = Pick<Storage, "getItem" | "key" | "length">;

export function touchSession(code: string, storage: Pick<Storage, "setItem">, at = Date.now()): void {
  storage.setItem(`${EDITED_PREFIX}${code}`, String(at));
}

export function sessionEditedAt(code: string, storage: Pick<Storage, "getItem">): number | null {
  const raw = storage.getItem(`${EDITED_PREFIX}${code}`);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

export function rememberPlayer(code: string, name: string, storage: Pick<Storage, "setItem">): void {
  storage.setItem(`${NAME_PREFIX}${code}`, name);
  touchSession(code, storage);
}

export function listDeviceSessions(storage: ListStorage): DeviceSession[] {
  const codes = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index) ?? "";
    if (key.startsWith(KEY_PREFIX)) codes.add(key.slice(KEY_PREFIX.length));
    if (key.startsWith(PLAYER_PREFIX)) codes.add(key.slice(PLAYER_PREFIX.length));
  }
  return [...codes]
    .map((code) => ({
      code,
      role: storage.getItem(hostSecretKey(code)) ? ("host" as const) : ("player" as const),
      name: storage.getItem(`${NAME_PREFIX}${code}`),
      editedAt: sessionEditedAt(code, storage),
    }))
    .sort((left, right) => (right.editedAt ?? 0) - (left.editedAt ?? 0));
}

export function forgetSession(code: string, storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(hostSecretKey(code));
  storage.removeItem(`we-rankin:host-link:${code}`);
  storage.removeItem(`${EDITED_PREFIX}${code}`);
  storage.removeItem(`${PLAYER_PREFIX}${code}`);
  storage.removeItem(`${NAME_PREFIX}${code}`);
}

export function hostSecretKey(code: string): string {
  return `${KEY_PREFIX}${code}`;
}

export function captureHostSecret(href: string, storage: Pick<Storage, "setItem">): string | null {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  const secret = params.get("h");
  if (!secret) return null;
  const code = url.pathname.match(/^\/s\/([^/]+)/)?.[1] ?? "";
  storage.setItem(hostSecretKey(code), secret);
  params.delete("h");
  const hash = params.toString();
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}
