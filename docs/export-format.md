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
