// Reads #h= from the session URL, stores it, and returns a fragment-free URL (checklist 3.2).
const KEY_PREFIX = "we-rankin:host:";

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
