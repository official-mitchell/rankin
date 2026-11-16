// Player id is stored in both localStorage and a cookie so a reload can say hello (checklist 6.2).
export function playerKey(code: string): string {
  return `we-rankin:player:${code}`;
}

export function readPlayerId(code: string, storage: Pick<Storage, "getItem">, cookie: string): string | null {
  return storage.getItem(playerKey(code)) ?? readCookie(cookie, code);
}

export function writePlayerId(code: string, playerId: string, storage: Pick<Storage, "setItem">): string {
  storage.setItem(playerKey(code), playerId);
  return `${playerKey(code)}=${encodeURIComponent(playerId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function readCookie(cookie: string, code: string): string | null {
  const prefix = `${playerKey(code)}=`;
  const part = cookie.split("; ").find((item) => item.startsWith(prefix));
  if (!part) return null;
  return decodeURIComponent(part.slice(prefix.length));
}
