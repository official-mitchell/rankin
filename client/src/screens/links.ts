// Player and host links for checklist 6.1. The host link carries the secret once, in the hash.
// 2026-11-16: a pasted player link, host link, or bare session code all resolve to /s/CODE.
import { CODE_ALPHABET, CODE_LENGTH } from "@we-rankin/shared";

export function sessionLinks(origin: string, code: string, hostSecret: string): { player: string; host: string } {
  const player = `${origin}/s/${code}`;
  return { player, host: `${player}#h=${encodeURIComponent(hostSecret)}` };
}

export function hostLinkKey(code: string): string {
  return `we-rankin:host-link:${code}`;
}

function sessionCode(value: string): string | null {
  const code = value.toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  if ([...code].some((char) => !CODE_ALPHABET.includes(char))) return null;
  return code;
}

/** Full link, path, or bare code. Keeps a host hash so the secret can be stored. */
export function sessionTarget(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const bare = sessionCode(text);
  if (bare) return `/s/${bare}`;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://local.invalid/${text.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  const match = url.pathname.match(/\/s\/([^/]+)/i);
  if (!match) return null;
  const code = sessionCode(decodeURIComponent(match[1] ?? ""));
  if (!code) return null;
  return `/s/${code}${url.hash}`;
}
