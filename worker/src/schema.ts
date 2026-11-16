// SQLite migration for checklist 4.1. Version lives in schema_meta and is applied inside blockConcurrencyWhile.
export const SCHEMA_VERSION = 2;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS meta (
    code TEXT PRIMARY KEY,
    phase TEXT NOT NULL,
    roster_locked INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    host_secret_hash TEXT NOT NULL,
    schema_version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    removed INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER,
    join_seq INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS players_name_ci ON players (name COLLATE NOCASE)`,
  `CREATE TABLE IF NOT EXISTS pitches (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    presenter_name TEXT NOT NULL,
    presenter_player_id TEXT,
    status TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_in_voting INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    player_id TEXT NOT NULL,
    pitch_id TEXT NOT NULL,
    category TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (player_id, pitch_id, category),
    CHECK (
      (category = 'compellingness' AND value BETWEEN 1 AND 5) OR
      (category = 'funniness' AND value BETWEEN 1 AND 5) OR
      (category = 'hotness' AND value BETWEEN 1 AND 10)
    )
  )`,
  `CREATE TABLE IF NOT EXISTS chips (
    player_id TEXT NOT NULL,
    pitch_id TEXT NOT NULL,
    chip_id TEXT NOT NULL,
    PRIMARY KEY (player_id, pitch_id, chip_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ballots (
    player_id TEXT PRIMARY KEY,
    order_json TEXT NOT NULL,
    placed_json TEXT NOT NULL,
    submitted INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL,
    computed_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS seqs (
    scope TEXT NOT NULL,
    client_seq INTEGER NOT NULL,
    PRIMARY KEY (scope, client_seq)
  )`,
  `CREATE TABLE IF NOT EXISTS disconnected (
    player_id TEXT PRIMARY KEY
  )`,
  `CREATE TABLE IF NOT EXISTS metrics (name TEXT PRIMARY KEY, n INTEGER NOT NULL)`,
];

export function migrate(sql: SqlStorage): { from: number; to: number; migrated: boolean } {
  sql.exec(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const rows = [...sql.exec<{ value: string }>(`SELECT value FROM schema_meta WHERE key = 'version'`)];
  const from = rows.length === 0 ? 0 : Number(rows[0]?.value ?? 0);
  if (from >= SCHEMA_VERSION) return { from, to: SCHEMA_VERSION, migrated: false };
  for (const statement of STATEMENTS) sql.exec(statement);
  sql.exec(`INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, String(SCHEMA_VERSION));
  return { from, to: SCHEMA_VERSION, migrated: true };
}

export function schemaDump(sql: SqlStorage): Array<{ name: string; sql: string | null }> {
  return [
    ...sql.exec<{ name: string; sql: string | null }>(
      `SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ),
  ];
}
