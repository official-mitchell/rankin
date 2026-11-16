// Player and host links for checklist 6.1. The host link carries the secret once, in the hash.
export function sessionLinks(origin: string, code: string, hostSecret: string): { player: string; host: string } {
  const player = `${origin}/s/${code}`;
  return { player, host: `${player}#h=${encodeURIComponent(hostSecret)}` };
}

export function hostLinkKey(code: string): string {
  return `we-rankin:host-link:${code}`;
}
