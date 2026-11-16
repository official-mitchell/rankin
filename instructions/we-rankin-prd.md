# We Rankin' — PRD v0.2

Target event: Hot Pitch Night, Tue 2026-11-17. Phases 1–6 + 8 must ship. Phase 7 may follow (session data persists after close).

v0.2 changes: presenter link required; host is a player; ballot-creation moment defined; pitch status + scoring gate; Closed-state rename exception; reclaim rules; session-creation key; ack/retry + reconnect on wake; raw JSON export; Playwright screenshot loop; style guide v0; cut line + fallback.

## Assumptions
- 13–25 players, phones only, friends (trust-based identity, no security model)
- Hosting: Cloudflare Workers Free (static assets + SQLite-backed Durable Object per session); host-side account and deploy
- Code delivery: GitHub repo connected to Cloudflare Git deploys (no terminal), fallback wrangler deploy
- Categories: Compellingness 1–5, Funniness 1–5, Hotness 1–10 (novelty & imagination), same as Hot Takes
- Presenters skip scoring and ranking their own pitch (UNCONFIRMED)
- Roster locks at "Start pitching"
- Official result = Borda ranking; score total is supporting evidence
- Screenshot loop runs against local dev server only (build sandbox cannot reach deployed workers.dev)

## Analysis

**Problem:** Run a live, phone-first pitch-night vote where friends take structured notes per pitch, then rank all pitches, with a fair tally and exportable results.

**Goals**
- Zero-friction join: link + name only
- Live note-taking (3 scores + tap chips) feeds a drag-to-rank ballot
- Fair tally: only complete, on-time ballots count

**Requirements**
- Host creates session, adds/edits pitches live; clients update without refresh
- Every counted voter scores and ranks every non-own pitch
- Roster locks at pitching start; late joiners are spectators
- Unsubmitted ballots at close are voided (ballot + scores)
- Live "Waiting on" list visible to everyone during voting
- Ballots editable after submit until host closes
- Borda tally; score leaderboard alongside; disagreement flags
- Export CSV/MD plus chart cards matching Hot Takes style

**Constraints**
- Ship by 2026-11-17; free-tier infrastructure only
- No passwords, emails, or accounts
- Mobile-first (≥360px wide), touch drag must not hijack page scroll
- Chip lists and categories hardcoded in v1, isolated in one data file
- Votes anonymous in UI; host sees submission status only

**Success Criteria**
- Join to first screen ≤10 s, name entry only
- Pitch/phase changes reach clients p95 ≤2 s
- 25 simulated clients complete a full session with 0 errors
- Tally output matches hand-computed fixtures (complete, voided, presenter-excluded, tied)
- 10-item reorder works on iOS Safari and Android Chrome
- Locked phone for 60 s, then unlocked: client resyncs with no lost taps
- Full rehearsal stays within Workers Free daily quotas

## Stack & Session Design
- Workers static assets: developers.cloudflare.com/workers/static-assets
- Durable Objects SQLite + WebSocket Hibernation: developers.cloudflare.com/durable-objects/best-practices/websockets
- Client: Vite + React + TypeScript; dnd-kit (touch sensor); Vitest; Playwright
- Fallback stack: Firebase (Firestore + Anonymous Auth + Hosting); weaker server-side authority for roster lock and ballot privacy
- One Durable Object per session = single writer; all validation (phase, roster, completeness, tally) server-side
- State persisted in SQLite on every write; zero reliance on in-memory state (hibernation clears it)
- Identity: playerId in cookie + localStorage (in-app browsers from Messages/Slack have separate storage)
- Reclaim: allowed after lock; blocked while that player has a live socket; host can force-release
- Host secret: 128-bit, in host link only; host link copyable; works on any device
- Session code: 6 chars, unambiguous alphabet; creation gated by CREATE_KEY entered on landing page
- Retention: alarm deletes session data 30 days after close

## Style Guide v0
Derived from Hot Takes reference images (sampled):
- Surface #ffffff; ink #14171f; muted text #5b6270; faint text/ticks/rank numerals #7a808d; hairline grid #eceef3
- Category gradients: Compellingness #3b6fd8→#c9d3e3; Funniness #7c3aed→#f472b6; Hotness #dc2626→#facc15
- White cards, large radius, big bold numerals, light sans (Inter/Helvetica-class), generous whitespace
- Category hues reserved for their scores only; chips must not reuse them

Proposed (needs sign-off):
- Type scale: 28/32 title, 20 card title, 16 body, 13 label, 40 big numeral
- Tap targets ≥48px; spacing grid 4px; card radius 16px; chip radius full
- Chip colors: Investable emerald, Cautious slate; selected = filled, unselected = outline
- Text on gradient fills uses ink, not white (white on platinum/yellow ends fails contrast)
- Motion: ≤150 ms, none on reorder drop except position settle; respects reduced-motion

## Config Seed (draft, for veto)
- Investable chips (7): Huge market · Sticky recurring revenue · Defensible moat · Killer founder energy · Scales absurdly fast · Clear first customer · Pitch was airtight
- Cautious chips (7): Lawsuit magnet · Unit economics are fiction · Regulators will notice · Founder is the risk · Zero repeat customers · Reputationally radioactive · Execution nightmare

## Implementation Plan

## Phase 1: Foundation, Deploy, Screenshot Loop
### 1.1 Project skeleton
- [ ] Vite + React + TS client served as Worker static assets
- [ ] Session Durable Object class with SQLite migration
- [ ] Local dev runs via wrangler dev
- [ ] Design tokens file (colors, type, spacing) from Style Guide v0
### 1.2 First deploy
- [ ] Host creates GitHub repo and grants access (host task)
- [ ] Host creates free Cloudflare account and registers workers.dev subdomain (host task)
- [ ] Cloudflare Git-connected deploy builds on push; DO migration applies
- [ ] Hello-world loads on phone over cellular
- [ ] README with deploy steps (≤10)
### 1.3 Screenshot loop
- [ ] Dev-only route /__fixtures/:scene renders each screen from static JSON, no backend, frozen clock, animations off, fonts bundled
- [ ] Scene list: join, lobby-player, lobby-host, notes-empty, notes-filled, notes-upcoming-locked, ranking-default, ranking-new-badge, submit-blocked, waiting-list, host-controls, host-close-confirm, spectator, closed-voided, results-borda, results-flags, card-preview
- [ ] Playwright capture script: scenes × viewports (390×844, 360×740) at 2x → /shots/{scene}.{viewport}.png + manifest.json
- [ ] Single command npm run shots, ≤60 s for all scenes
- [ ] Per-scene assertions: no horizontal overflow, no clipped text, tap targets ≥48px, 0 console errors
- [ ] AGENTS.md loop: edit → npm run shots → view PNGs → check against Style Guide v0 → repeat; stop after 5 passes or checklist green
- [ ] Baseline screenshots committed after host approval; later diffs via Playwright toHaveScreenshot

## Phase 2: Sessions, Identity, Roster
### 2.1 Session creation
- [ ] Landing page "Create session" requires CREATE_KEY; generates 6-char code + host secret
- [ ] Returns player link (/s/CODE) and host link; "Copy host link" prominent; host link saved in host's localStorage
### 2.2 Join
- [ ] Join screen: single name field, 1–24 chars, trimmed, HTML-escaped on render
- [ ] Server issues playerId stored in cookie + localStorage; reload restores identity
- [ ] Name collision: "That's me (reclaim)" or choose another; reclaim blocked while old socket live
- [ ] Join after roster lock creates spectator; reclaim still works after lock
- [ ] Host opens host link, enters name, joins roster as voter by default
### 2.3 Roster
- [ ] Player list with voter/spectator badge visible to all
- [ ] Host can promote spectator to voter before voting opens
- [ ] Host can remove a player from roster (their data voided)
- [ ] Host can force-release a name for reclaim

## Phase 3: Realtime & Host Controls
### 3.1 Sync
- [ ] WebSocket per client via Hibernation API; playerId held in socket attachment
- [ ] Server sends per-client view: public state + that client's own notes/ballot only
- [ ] Every write acked; client retry queue with "Saved ✓ / Saving…" indicator
- [ ] Reconnect with backoff on drop and on page visibilitychange; full-state resync
- [ ] Per-socket rate limit and message size cap
### 3.2 Phase machine
- [ ] Phases Lobby → Pitching → Voting → Closed; host-only, server-validated transitions
- [ ] "Start pitching" locks roster
- [ ] "Open voting" creates every voter's ballot, enables Ranking tab, unlocks scoring on all pitches
- [ ] "Close voting" confirmation lists players to be voided
- [ ] Closed state rejects all writes except host edits to pitch titles/presenter names
### 3.3 Pitches
- [ ] Host adds pitch: title, presenter (required: pick a player or "Not a player")
- [ ] Add allowed in Lobby, Pitching, Voting; lineup order = insertion order
- [ ] Pitch status upcoming → presenting → done; "Now presenting" marks previous done
- [ ] Host renames/removes pitch; removal purges its notes and ranks
- [ ] Client Notes tab focuses presenting pitch
- [ ] New pitch appends to bottom of every ranking list
### 3.4 Safety net
- [ ] Host "Download raw JSON" of full session state in any phase

## Phase 4: Note-Taking
### 4.1 Scores
- [ ] Tap-button inputs: Compellingness 1–5, Funniness 1–5, Hotness 1–10; no defaults, no sliders
- [ ] Upcoming pitches shown under "Coming up", unscorable until presenting/done or voting opens
- [ ] Autosave per tap; editable until Closed
- [ ] Presenter-linked player sees own pitch locked ("Your pitch")
### 4.2 Chips
- [ ] Multi-select "Investable" and "Cautious" chip groups per pitch from seed config
- [ ] Chips optional
- [ ] Chip/category config in single data file

## Phase 5: Ranking & Submission
### 5.1 Ranking list
- [ ] Reorderable list of all non-own pitches with drag handle (press-delay touch activation)
- [ ] Up/down buttons on each card as drag fallback
- [ ] Card shows player's own scores and selected chips
- [ ] Initial order = lineup order at ballot creation; reorder autosaves
### 5.2 NEW handling
- [ ] NEW badge on pitches added after ballot creation; cleared by "Place here" tap or by moving it
### 5.3 Lock-in
- [ ] "Submit ballot" disabled until all scores filled and no NEW badges
- [ ] Disabled state lists missing items with jump links
- [ ] Submitted ballot stays editable until Closed; edits keep submitted state
- [ ] Adding a pitch after submit resets all voters to unsubmitted
### 5.4 Waiting list
- [ ] Live "Waiting on: names" visible to voters and spectators during Voting
- [ ] "All ballots in" state when empty; highlights host's Close button

## Phase 6: Close & Tally
### 6.1 Tally logic
- [ ] Counted ballots = roster ∩ submitted at close; all others voided (ballot + scores excluded)
- [ ] Borda per pitch = mean over counted ballots containing it of (n − position) ÷ (n − 1), n = ballot length
- [ ] Order by Borda desc; ties → more 1st-place votes → higher score total → shared rank
- [ ] Per-category stats from counted voters: mean, population SD, min, max, 25th/75th percentile
- [ ] Score total = Compellingness mean + Funniness mean + Hotness mean ÷ 2 (out of 15)
- [ ] Disagreement flag when |Borda rank − score rank| ≥ 2
- [ ] Vitest fixtures: complete ballots, voided ballot, presenter exclusion, tie-breaks
### 6.2 Results screen
- [ ] On Closed, all clients show Borda leaderboard as headline, score leaderboard secondary, with flags
- [ ] Counted and voided voter names listed
- [ ] No individual ballots visible in UI

## Phase 7: Exports (may follow event)
### 7.1 Data
- [ ] CSV per voter-pitch row: anonymous voter id, three scores, chips, rank position
- [ ] CSV pitch summary with all stats and both ranks
- [ ] Host toggle to include voter names in CSV
- [ ] Markdown summary: leaderboard, stats, top chips per pitch
### 7.2 Chart cards (spec: Hot Takes prompt + reference images)
- [ ] Leaderboard PNG: stacked bars, Hotness ÷ 2, axis 0–15, titles never truncated
- [ ] Per-pitch card PNG, 2000px: jittered votes, min–max whisker, IQR band, mean dot, SD, Hotness raw on 1–10 axis, total "X.X / 15"
- [ ] Client-side SVG→PNG with download-all button
- [ ] Playwright check of 3 cards for clipped or overlapping labels

## Phase 8: QA & Event Readiness
### 8.1 Testing
- [ ] Multi-client Playwright e2e: host + 2 player contexts against local dev server through Closed, screenshot at each phase transition
- [ ] Two-phone test (iOS Safari, Android Chrome): join, score, reorder 10 pitches without scroll hijack
- [ ] Phone lock 60 s mid-scoring: no lost taps after unlock
- [ ] Reclaim test: clear storage, rejoin via name picker; in-app browser → Safari switch
- [ ] 25-client simulation script: join, score, rank, submit; 0 errors, p95 sync ≤2 s
- [ ] Full rehearsal with 3 dummy pitches through Closed on deployed URL
- [ ] Workers Free daily request quota checked after rehearsal
### 8.2 Host kit
- [ ] One-page host cheat sheet: links, phase order, what "voided" means, paper fallback steps

## Cut Line & Fallback
- Never cut: join, scores, ranking, waiting list, close, Borda, raw JSON export
- Cut order if late: 7.2 chart cards → 7.1 Markdown → 5.4 NEW/disagreement flags → 4.2 chips → pitch rename/remove
- Fallback if app fails live: paper or Google Form rankings, tallied with the same Borda formula; raw JSON preserves whatever was captured

## Phase 9: Backlog (not scheduled)
- Host-editable categories and chips
- Instant-runoff reveal mode
- Optional free-text comment per pitch
- Host session list and archive/delete

## Open Items
- [ ] Confirm presenters skip own pitch
- [ ] Veto/edit seed chips
- [ ] Confirm roster lock at "Start pitching"
- [ ] Confirm scoring gate (upcoming pitches locked until presenting or voting opens)
- [ ] Sign off Style Guide v0 proposed values
- [ ] Confirm host votes as a player by default
- [ ] Confirm paper fallback
