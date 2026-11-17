// Reads #h= from the session URL, stores it, and returns a fragment-free URL (checklist 3.2).
const KEY_PREFIX = "we-rankin:host:";
const EDITED_PREFIX = "we-rankin:edited:";

export function touchSession(code: string, storage: Pick<Storage, "setItem">, at = Date.now()): void {
  storage.setItem(`${EDITED_PREFIX}${code}`, String(at));
}

export function sessionEditedAt(code: string, storage: Pick<Storage, "getItem">): number | null {
  const raw = storage.getItem(`${EDITED_PREFIX}${code}`);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) ? at : null;
}

export function forgetSession(code: string, storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(hostSecretKey(code));
  storage.removeItem(`we-rankin:host-link:${code}`);
  storage.removeItem(`${EDITED_PREFIX}${code}`);
  storage.removeItem(`we-rankin:player:${code}`);
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
