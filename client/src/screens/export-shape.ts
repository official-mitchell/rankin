// Checks a raw session download against docs/export-format.md (checklist 7.3).
const TABLES = ["meta", "players", "pitches", "scores", "chips", "ballots", "results", "metrics"] as const;

export function exportShapeErrors(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return ["export is not an object"];
  const record = body as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of TABLES) {
    if (!(key in record)) errors.push(`missing ${key}`);
  }
  if (JSON.stringify(record).includes("hostSecret") || JSON.stringify(record).includes("host_secret\"")) {
    errors.push("plaintext host secret");
  }
  const meta = Array.isArray(record.meta) ? record.meta[0] : null;
  if (meta && typeof meta === "object" && !("host_secret_hash" in meta)) errors.push("missing host_secret_hash");
  return errors;
}
