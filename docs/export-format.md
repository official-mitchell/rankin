# Raw session export

`GET /api/s/:code/export` with header `x-host-secret` returns this JSON at any phase. The plaintext host secret is not stored. `host_secret_hash` is SHA-256 hex.

```json
{
  "meta": [{ "code": "", "phase": "lobby", "roster_locked": 0, "created_at": 0, "closed_at": null, "host_secret_hash": "", "schema_version": 2 }],
  "players": [{ "id": "", "name": "", "role": "voter", "removed": 0, "last_seen": null }],
  "pitches": [{ "id": "", "title": "", "presenter_name": "", "presenter_player_id": null, "status": "upcoming", "position": 1, "added_in_voting": 0 }],
  "scores": [{ "player_id": "", "pitch_id": "", "category": "compellingness", "value": 1 }],
  "chips": [{ "player_id": "", "pitch_id": "", "chip_id": "" }],
  "ballots": [{ "player_id": "", "order_json": "[]", "placed_json": "[]", "submitted": 0, "created_at": 0 }],
  "results": [{ "json": "{}", "computed_at": 0 }],
  "metrics": { "sessions_created": 1 }
}
```

`order_json` and `placed_json` are JSON arrays of pitch ids. `results.json` is the `Results` object from `computeResults`. A restore loads these tables back into a session Durable Object at schema version 2.

Closed sessions delete this storage 30 days after `closed_at`.

## Closed table exports (checklist 11.1)

After the phase is `closed`, the same path accepts `?format=`:

- `ballots` — CSV rows `voterIndex, pitch, C, F, H, chips, rankPosition, counted`. `names=1` adds `voterName` after the host confirms that this de-anonymizes ballots. `voterIndex` is shuffled on every request.
- `summary` — one row per pitch with Borda, both ranks, the disagreement flag, and mean / sd / min / max / p25 / p75 for C, F, and H.
- `markdown` — leaderboard, score totals, and the top chips per pitch.
- `charts` — JSON vote lists for the light chart-card PNGs. Counted ballots only.

Each of these logs `export.raw` with `format` and `rows`. A format request before close returns 409.
