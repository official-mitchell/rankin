# We Rankin' — Implementation Checklist v0.2

Source: `claude/we-rankin-prd.md` v0.2
Design system (app UI; replaces Style Guide v0 in the PRD):
- `instructions/we-rankin-style-guide.md` — rules, contrast ledger (§3.2), component specs (§5), screen recipes (§6), voice (§7), open decisions D1–D5 (§9). Screenshot-loop yes/no list is Appendix A.
- `instructions/we-rankin-tokens.css` — drop-in `:root` tokens and base `body` rules. Copy into the client; do not re-invent hex values.
- `instructions/we-rankin-components.css` — reference class recipes (panels, buttons, score pads, rank cards, tabs). Port the look into React; do not ship this file as the app stylesheet.
- `instructions/we-rankin-style-specimen.html` — rendered proof of those recipes (Join, Notes, Rank, Submit, Players, Results, close-confirm, buttons, palette). Open it beside a scene when a shot looks wrong. Toast, voided state, and the host-link plate are specs only (guide §5); verify those in `npm run shots`.
Chart-card PNGs (11.2) stay the light Hot Takes look (guide D2). They do not use these tokens.

Legend: 🧪 test · 🔍 validate · 👁 observe · (host) = host-only task · [post-event ok] = may follow Tue 2026-11-17 event
Stack: Vite + React + TS · Cloudflare Worker + SQLite Durable Object (1 per session) · dnd-kit · Vitest + `@cloudflare/vitest-pool-workers` · Playwright

Observability model (applies to all sections):
- Logging: structured JSON line `{ts, level, event, reqId, sessionCode, playerId?, ...}` via `log()`; secrets never logged
- Metrics: counters in SQLite `metrics` table; gauge `ws_connections` read from live sockets
- Tracing: none (single service); correlate by `reqId`
- Alerting: no pager; host-console banners A1 (storage write failed) and A2 (uncaught server error), both offer raw JSON download; `npx wrangler tail` open during event

---

## 0. Pre-Flight
Requires: nothing
Produces: accounts, secrets plan, tooling, green baseline

### 0.1 Accounts & Access
Requires: nothing
Produces: GitHub repo, Cloudflare account with workers.dev subdomain, CREATE_KEY chosen

- [x] 1. (host) Create empty GitHub repo `we-rankin`; grant Claude session access (add_repo) or agree on zip hand-off
- [x] 2. (host) Create free Cloudflare account; verify email
- [x] 3. (host) Register workers.dev subdomain: Dashboard → Workers & Pages
- [x] 4. (host) Choose CREATE_KEY (≥12 random chars); store in password manager
- [ ] 5. 🔍 Dashboard → Workers & Pages loads with no plan/payment prompt
- [x] 6. 🔍 `git ls-remote` on the repo URL succeeds from the build environment

(no observability required)

### 0.2 Environment Variables
Requires: 0.1 complete
Produces: `.dev.vars.example`, secrets plan

- [x] 1. Create `.dev.vars.example` with `CREATE_KEY=` (source: host's password manager)
- [x] 2. Copy to `.dev.vars` locally; populate CREATE_KEY
- [x] 3. Add `.dev.vars` to `.gitignore`
- [x] 4. Set plain var `LOG_LEVEL=info` in wrangler config (`debug` in `.dev.vars`)
- [x] 5. Prod secret plan: `npx wrangler secret put CREATE_KEY` (or Dashboard → Settings → Variables and Secrets)
- [x] 6. 🔍 `git check-ignore .dev.vars` prints the path
- [x] 7. 🔍 `grep -r CREATE_KEY --include=* . | grep -v -E "dev.vars|node_modules|\.md|example"` returns only code references, no values

(no observability required)

### 0.3 Tooling
Requires: nothing
Produces: working local toolchain

- [x] 1. Confirm Node ≥20: `node -v`
- [x] 2. Confirm npm ≥10: `npm -v`; git: `git --version`
- [x] 3. Wrangler is a devDependency (no global): `npx wrangler --version`
- [ ] 4. Playwright: `npx playwright --version`; browsers: `npx playwright install chromium` (skip in build sandbox; preinstalled)
- [ ] 5. (host) Test devices ready: 1 iPhone (Safari), 1 Android (Chrome)
- [ ] 6. 🔍 All version commands exit 0

(no observability required)

### 0.4 Baseline Validation
Requires: 0.1–0.3 complete
Produces: confirmed working environment before code

- [x] 1. (host) `npx wrangler login`; 🔍 `npx wrangler whoami` shows the account
- [ ] 2. Clone repo; confirm push access: push a README commit
- [ ] 3. 🔍 `npx playwright --version` and a one-page headless screenshot succeed
- [ ] 4. 🔍 Phone on cellular can open any `https://*.workers.dev` URL (rule out network blocks)

(no observability required)

Go when: whoami OK, repo push OK, Playwright screenshot OK, CREATE_KEY chosen

---

## 1. Skeleton & First Deploy
Requires: 0 complete
Produces: deployed hello-world Worker + DO with SPA fallback, logging and metrics baseline

### 1.1 Repo Structure
Requires: 0.4 complete
Produces: workspaces, scripts, strict TS, passing trivial test

- [x] 1. Create `client/`, `worker/`, `shared/`, `e2e/`, `scripts/`, `docs/`
- [x] 2. Shared strict `tsconfig.base.json`; each package extends it
- [x] 3. Vite + React + TS in `client/`; build output `dist/client`
- [x] 4. `shared/` imported by client and worker (no runtime deps)
- [x] 5. npm scripts: `dev`, `build`, `test`, `shots`, `e2e`, `sim`
- [x] 6. 🔍 `npm run build` exits 0
- [x] 7. 🧪 Trivial `shared` test passes via `npm test`

(no observability required)

### 1.2 Worker & Durable Object Skeleton
Requires: 1.1 complete
Produces: `/api/*` routing, `Session` DO with SQLite migration v1, SPA fallback, Workers Logs enabled

- [x] 1. Worker entry: `/api/*` → handlers; all else → static assets
- [x] 2. Wrangler config: assets dir, SPA `not_found_handling`, DO binding `SESSION`, migration tag `v1` with `new_sqlite_classes`
- [x] 3. `Session` DO class: `fetch` returns `{ok:true}`
- [x] 4. Enable observability in wrangler config
- [x] 5. run: `npx wrangler dev`
- [x] 6. 🔍 `curl localhost:8787/api/health` → 200 JSON
- [x] 7. 🔍 `curl localhost:8787/s/ABC234` returns `index.html`
- [x] 8. 🧪 vitest-pool-workers: DO stub responds `{ok:true}`
- [x] 9. 👁 Request log line visible in `wrangler dev` output

### 1.3 Logger & Metrics Baseline
Requires: 1.2 complete
Produces: `log()`, event catalog, `metrics` table helper, alert rule definitions

- [x] 1. Implement `log(level, event, fields)` emitting one JSON line; gate by `LOG_LEVEL`
- [x] 2. Generate `reqId` per HTTP request and per WS message; include in every log
- [x] 3. Redaction: never log host secret, CREATE_KEY, raw headers
- [x] 4. Event catalog `shared/events.ts`: `session.created` `auth.failed` `ws.connected` `ws.disconnected` `ws.rejected` `player.joined` `player.reclaimed` `player.removed` `player.promoted` `roster.locked` `phase.changed` `pitch.added` `pitch.updated` `pitch.removed` `pitch.status` `score.saved` `ballot.created` `ballot.reordered` `ballot.submitted` `voting.closed` `tally.computed` `write.rejected` `write.failed` `rate.limited` `export.raw` `session.expired` `client.error` `db.migrated`
- [x] 5. `metrics` table + `inc(name, n)` helper; names: `sessions_created` `players_joined` `writes_ok` `writes_failed` `reconnects` `ballots_submitted` `rate_limited` `tallies_run`
- [x] 6. Define alert A1: `write.failed` ≥1 → `serverAlert` to host "Save failed — download raw JSON now"
- [x] 7. Define alert A2: uncaught handler exception ≥1 → `serverAlert` to host "Server error — download raw JSON now"
- [x] 8. 🧪 Redaction test: secret strings absent from captured log output
- [x] 9. 🧪 `inc` persists across a fresh DO stub instance
- [ ] 10. 👁 `npx wrangler tail` (local) shows parsed JSON lines with `reqId`

### 1.4 First Deploy
Requires: 1.2, 1.3 complete; 0.4 complete
Produces: live `https://<worker>.<subdomain>.workers.dev` with Git-connected deploys

- [x] 1. (host) Dashboard → Workers & Pages → Create → connect GitHub repo; build `npm run build`; deploy `npx wrangler deploy` (confirm exact fields in dashboard)
- [x] 2. (host) Set prod secret: `npx wrangler secret put CREATE_KEY`
- [x] 3. Push to `main`
- [x] 4. README: deploy steps (≤10), rollback steps, how to tail logs
- [ ] 5. 🔍 Build succeeds on push; DO migration applied
- [ ] 6. 🔍 `/api/health` → 200 from phone on cellular
- [ ] 7. 🔍 `/s/ABC234` loads SPA shell on phone
- [ ] 8. 👁 Dashboard → Workers Logs shows the health request line
- [ ] 9. 🔍 Rollback rehearsal: redeploy previous version from dashboard

Go when: deployed URL loads on phone over cellular, push-to-deploy works, logs visible, rollback tried

---

## 2. Shared Domain Core
Requires: 1.1 complete
Produces: pure, tested types/config/stats/tally/ballot functions used by worker and client

### 2.1 Types & Config
Requires: 1.1 complete
Produces: `shared/types.ts`, `shared/config.ts`

- [x] 1. Types: `Phase`, `PitchStatus`, `CategoryId`, `Player{role: voter|spectator, removed}`, `Pitch`, `Score`, `Ballot{order, placed, submitted}`, `Results`, `ClientView`, message unions (filled in 4.4)
- [x] 2. `config.ts` categories: Compellingness 1–5, Funniness 1–5, Hotness 1–10 with total weight (Hotness ×0.5)
- [x] 3. `config.ts` chips: 7 Investable + 7 Cautious from PRD seed
- [x] 4. Constants: name 1–24 chars, title 1–80, code length 6, code alphabet without `0 O 1 I L`
- [x] 5. 🧪 Max score total = 15
- [x] 6. 🧪 Chip groups each contain 5–8 chips with unique ids

(no observability required: pure data)

### 2.2 Score Stats
Requires: 2.1 complete
Produces: `mean`, `popSD`, `min`, `max`, `percentile`, `scoreTotal`, `competitionRank`

- [x] 1. Implement mean, population SD, min, max
- [x] 2. Implement percentile via linear interpolation between closest ranks (numpy default); use for 25th/75th
- [x] 3. Implement `scoreTotal` = C mean + F mean + H mean ÷ 2
- [x] 4. Implement `competitionRank` (1,2,2,4 on ties)
- [x] 5. 🧪 Hand-computed fixtures with derivation comments (n=1, n=2, n=5, ties)
- [x] 6. 🧪 Empty input returns `null`, never `NaN`
- [x] 7. 🧪 Single vote → SD 0, Q1=Q3=value

(no observability required: pure functions)

### 2.3 Borda & Tie-Breaks
Requires: 2.2 complete
Produces: `borda()`, `rankPitches()`

- [x] 1. `borda`: per pitch, mean over counted ballots containing it of (n − pos) ÷ (n − 1), pos 1-indexed
- [x] 2. Ballots with n < 2 contribute no points; pitch with no contributing ballots → Borda 0
- [x] 3. Tie-break order: more 1st-place votes → higher score total → shared rank
- [x] 4. 🧪 Fixture: 5 voters (2×A>B>C, 2×C>B>A, 1×B>A>C) → B 0.60, A 0.50, C 0.40
- [x] 5. 🧪 Tie fixtures: broken by 1st-place count; by score total; unresolved → shared rank
- [x] 6. 🧪 Presenter-excluded fixture: ballots of different lengths, expected values hand-derived
- [x] 7. 🧪 n=1 ballot contributes nothing

(no observability required: pure functions)

### 2.4 Ballot Rules
Requires: 2.1 complete
Produces: `eligiblePitches`, `ballotComplete`, `applyNewPitch`, `applyRemovePitch`, `applyMove`, `applyPlace`, `missingItems`

- [x] 1. `eligiblePitches(player, pitches)` excludes pitches whose presenter is that player
- [x] 2. `applyNewPitch`: append to `order`, not in `placed`
- [x] 3. `applyMove(order, pitchId, toIndex)`: move, add `pitchId` to `placed`
- [x] 4. `applyPlace(pitchId)`: add to `placed`, order unchanged
- [x] 5. `applyRemovePitch`: drop from `order` and `placed`
- [x] 6. `missingItems`: all unscored categories per eligible pitch + unplaced NEW pitches
- [x] 7. `ballotComplete` = `missingItems` empty and `order` equals eligible set
- [x] 8. 🧪 Table tests for each function incl. out-of-range `toIndex` (clamps) and idempotent replay

(no observability required: pure functions)

### 2.5 Results Assembly & Flags
Requires: 2.2, 2.3, 2.4 complete
Produces: `computeResults(snapshot)`

- [x] 1. Counted = voters ∩ submitted ∩ not removed; all others listed as voided
- [x] 2. Per pitch: Borda, Borda rank, 1st-place count, per-category stats from counted voters, score total, score rank
- [x] 3. Disagreement flag when |Borda rank − score rank| ≥ 2 (with direction)
- [x] 4. 🧪 End-to-end fixture: 6 voters, 1 voided, 1 presenter, 4 pitches; expected JSON hand-derived
- [x] 5. 🧪 Deterministic: identical input → deep-equal output
- [x] 6. 🧪 Voided voter's scores do not alter any mean

(no observability required: pure functions)

Go when: all shared tests green; every fixture has a written derivation; 5-voter example matches

---

## 3. Frontend Foundation & Screenshot Loop
Requires: 1.1, 2.1 complete
Produces: tokens, app shell, fixture harness, capture script, agent loop doc

### 3.1 Design Tokens & Fonts
Requires: 1.1 complete
Produces: client CSS variables copied from `instructions/we-rankin-tokens.css`, bundled Inter + Russo One
Authority: style guide §3 and §4. Values live in the tokens file; this list is the adoption check.

- [x] 1. Copy `we-rankin-tokens.css` primitives and semantic tokens into the client (`--bg-*`, `--text-*`, `--border-*`, `--cat-*`, `--chip-*`, `--medal-*`, type, space, radius, `--tap-min` 48 / `--tap-primary` 56, motion). Do not keep Style Guide v0 light surfaces (#ffffff / #14171f) or v0 category gradients (blue, violet→pink, red→yellow).
- [x] 2. Category accents from tokens (guide §4, D1 = A): Compellingness ice (`--cat-comp-*`), Funniness gold (`--cat-fun-*`), Hotness red (`--cat-hot-*`). Selected score text is `--text-ink`. Enamel button text is flat `--text-gold` (gold-100), not a gold gradient.
- [x] 3. Type scale from tokens: numeral 40, title 28 (header wordmark 24), card-title 20, body 16, label floor 13. 4px spacing grid; page gutter 16 (12 at ≤380px). Radius 16 on panels. Russo One is weight 400 only (`font-synthesis: none`).
- [x] 4. Bundle Inter (400/500/600/700) and Russo One (400) locally — `@fontsource/inter` and `@fontsource/russo-one`, or the woff2 files named in the tokens file. No CDN.
- [x] 5. Base page matches tokens file: canvas background, Inter body, paper-grain noise tiled at 256px, `prefers-reduced-motion` collapsed to 0.01ms.
- [x] 6. Text pairings stay inside the guide §3.2 ledger. Do not use `neutral-500`, `red-400`, or `red-500` as text. Every red-enamel control has its gold edge (2px buttons, 1px tags).
- [x] 7. 🧪 Contrast test asserts the ledger floors: muted (#b0aa9e) on panel ≥7:1; disabled (#85827c) on panel ≥4.5:1; gold-100 on enamel bottom stop (red-800) ≥4.5:1; ink on ice-300, gold-300, and red-300 fills ≥4.5:1.
- [x] 8. 🧪 Banned-pairing test: no computed text color is `neutral-500`, `red-400`, or `red-500`; Russo One rules have `font-weight: 400`.

(no observability required: presentational)

### 3.2 App Shell & Routing
Requires: 3.1 complete
Produces: routes, layout, safe-area handling
Authority: guide §5 (App header, Phase rail, Bottom tabs) and the specimen header / phase rail / tab bar. Class reference: `.app-header`, `.conn`, `.phase-rail`, `.tabbar` in `we-rankin-components.css`.

- [x] 1. Routes: `/` landing, `/s/:code` session, fallback 404 view
- [x] 2. Read host secret from URL fragment `#h=`; store in localStorage; replace URL without fragment
- [x] 3. Layout: 56px header (red star shape + "WE RANKIN'" Russo 24 gold-100, connection pill), phase rail (Lobby · Pitching · Voting · Closed), content, 56px bottom tabs (Notes · Rank · Players). Active tab and active phase use red-800 plus a 3px gold bar.
- [x] 4. `viewport-fit=cover`, safe-area insets on the tab bar, `overscroll-behavior: contain` on app root. Phone width; no 1440px three-column shell.
- [x] 5. 🧪 Route tests: fragment parsed, stored, stripped
- [x] 6. 🔍 Shell renders at 360, 390, and 430 px with no horizontal scroll (same widths the specimen was audited at)

(no observability required: presentational)

### 3.3 Fixture Harness
Requires: 3.2, 2.1 complete
Produces: `/__fixtures/:scene` dev-only route, scene registry

- [x] 1. `client/fixtures/*.json` typed as `ClientView`
- [x] 2. Route `/__fixtures/:scene` renders a screen from fixture; no network
- [x] 3. Freeze clock; disable animations/transitions via flag; seed RNG
- [x] 4. Scene registry `client/fixtures/scenes.ts`; each screen section adds its scenes
- [x] 5. Exclude route from production build
- [x] 6. 🧪 Prod build serves 404 for `/__fixtures/*`
- [x] 7. 🧪 Every registry entry resolves to a fixture file

(no observability required: dev-only)

### 3.4 Capture Script
Requires: 3.3 complete
Produces: `npm run shots` → PNGs + manifest

- [x] 1. `scripts/shots.ts`: scenes × viewports 390×844 and 360×740, scale 2, touch on
- [x] 2. Output `shots/{scene}.{viewport}.png` and `shots/manifest.json`
- [x] 3. Assertion: no horizontal overflow (`scrollWidth ≤ clientWidth`)
- [x] 4. Assertion: no clipped text (overflow-hidden elements with `scrollWidth > clientWidth`)
- [x] 5. Assertion: every button/chip tap target ≥48px
- [x] 6. Assertion: 0 console errors
- [x] 7. Exit non-zero on any assertion failure; print summary table
- [x] 8. run: `npm run shots`
- [x] 9. 🧪 Deliberately broken fixture trips each assertion once, then removed
- [x] 10. 🔍 Full run ≤60 s
- [x] 11. 👁 Manifest records per-scene pass/fail and duration

### 3.5 Agent Loop Doc
Requires: 3.4 complete
Produces: `AGENTS.md`, `docs/style-checklist.md`

- [x] 1. `AGENTS.md`: loop = edit → `npm run shots` → view PNGs against `instructions/we-rankin-style-specimen.html` → check `docs/style-checklist.md` → repeat; stop at 5 passes or all green
- [x] 2. `docs/style-checklist.md`: copy the 10 yes/no items from style guide Appendix A (5 scripted, 5 visual). Do not write a second list.
- [x] 3. Rule: baselines committed only after host approval; later diffs via `toHaveScreenshot`. Compare UI shots to the specimen, not to Style Guide v0.
- [x] 4. 🔍 Dry run on a placeholder scene follows the loop end to end

(no observability required)

Go when: `npm run shots` yields PNGs + manifest, assertions fire on broken fixtures, style checklist agreed

---

## 4. Session Backend (Durable Object)
Requires: 1.2, 1.3, 2 complete
Produces: authoritative, tested session state machine behind WebSocket + HTTP

### 4.1 SQLite Schema
Requires: 1.2 complete
Produces: tables, constraints, migration runner

- [x] 1. Tables: `meta`, `players`, `pitches`, `scores`, `chips`, `ballots`, `results`, `metrics`
- [x] 2. `meta`: code, phase, roster_locked, created_at, closed_at, host_secret_hash, schema_version
- [x] 3. `players`: id, name (unique, case-insensitive), role, removed, last_seen
- [x] 4. `pitches`: id, title, presenter_name, presenter_player_id (nullable), status, position
- [x] 5. `scores`: (player_id, pitch_id, category) unique, value with CHECK per category range
- [x] 6. `chips`: (player_id, pitch_id, chip_id); `ballots`: player_id, order_json, placed_json, submitted, created_at; `results`: json, computed_at
- [x] 7. Migration runner in DO constructor inside `blockConcurrencyWhile`; versioned
- [x] 8. 🧪 Constraint tests: duplicate name (case variant), score out of range, duplicate score upserts
- [x] 9. 🔍 Dump schema; compare with this list
- [x] 10. 👁 log `db.migrated` INFO `{from,to}`

### 4.2 Session Creation Endpoint
Requires: 4.1, 1.3 complete; CREATE_KEY in env
Produces: `POST /api/sessions` → `{code, hostSecret}`

- [x] 1. Constant-time compare body `createKey` to `env.CREATE_KEY`; 401 on mismatch
- [x] 2. Generate 6-char code; DO id = `idFromName(code)`; `init()` fails if already initialized → retry ≤5
- [x] 3. Generate 128-bit host secret; store SHA-256 hash only; return plaintext once
- [x] 4. 🧪 Wrong key → 401; right key → 200 with code regex match
- [x] 5. 🧪 Plaintext secret absent from storage dump
- [x] 6. 🧪 Forced collision retries then succeeds
- [x] 7. 👁 log `session.created` INFO; metric `sessions_created`
- [x] 8. 👁 log `auth.failed` WARN on bad key (no key value logged)
- [x] 9. Alert note: >5 `auth.failed`/min → rotate CREATE_KEY manually

### 4.3 WebSocket Accept & Auth
Requires: 4.2 complete
Produces: hibernation-safe sockets with identity attachment

- [x] 1. `GET /api/s/:code/ws` upgrade → `ctx.acceptWebSocket`
- [x] 2. First message `hello{playerId?, hostSecret?}` within 5 s else close 4001
- [x] 3. Verify `hostSecret` against stored hash; failure → close 4003
- [x] 4. Store `{playerId, isHost}` via `serializeAttachment`; restore after hibernation
- [x] 5. Unauthenticated sockets may send only `hello`, `join`, `reclaim`
- [x] 6. 🧪 Unauthenticated write rejected; bad secret closes 4003
- [x] 7. 🧪 Simulated hibernation wake restores attachment
- [x] 8. 👁 log `ws.connected` / `ws.disconnected` / `ws.rejected`; gauge `ws_connections`; metric `reconnects` on hello with known playerId after a disconnect

### 4.4 Message Protocol & Validation
Requires: 4.3, 2.1 complete
Produces: zod schemas, `clientSeq` ack/dedupe

- [x] 1. Client messages: `hello` `join` `reclaim` `setScore` `setChips` `movePitch{pitchId,toIndex}` `placePitch{pitchId}` `submitBallot` `host.addPitch` `host.updatePitch` `host.removePitch` `host.setStatus` `host.startPitching` `host.openVoting` `host.closeVoting` `host.promote` `host.removePlayer` `host.releaseName`
- [x] 2. Server messages: `view`, `ack{clientSeq}`, `error{clientSeq?, code}`, `serverAlert{kind}`
- [x] 3. Every write carries `clientSeq`; dedupe by (playerId, clientSeq) over last 200
- [x] 4. Max message 8 KB; unknown type → `error bad_message`
- [x] 5. 🧪 Schema accept/reject table
- [x] 6. 🧪 Replayed `clientSeq` has one effect and re-acks
- [x] 7. 👁 log `write.rejected` WARN `{code}`; metrics `writes_ok`, `writes_failed`

### 4.5 View Projection (Privacy)
Requires: 4.4, 2.5 complete
Produces: `buildView(playerId)`, coalesced broadcast

- [x] 1. View contains: phase, roster flag, players `{name, role, connected, submitted}`, pitches, own scores/chips/ballot, `missing[]`, results only when Closed
- [x] 2. Host view adds host control flags; never other players' scores or ballots
- [x] 3. Spectator view omits notes/ballot
- [x] 4. Broadcast after each mutation, coalesced to ≤10/s
- [x] 5. 🧪 Property test: no player's view contains another player's scores/ballot across random sessions
- [x] 6. 🧪 `results` absent before Closed
- [x] 7. 👁 log `view.sent` DEBUG `{bytes}`; assert typical view <20 KB at 25 players × 10 pitches

### 4.6 Join, Reclaim, Roster
Requires: 4.5 complete
Produces: identity and roster rules

- [x] 1. `join{name}`: validate; Lobby → voter; after roster lock → spectator; issue UUID `playerId`
- [x] 2. Name unique case-insensitive; collision → `error name_taken`
- [x] 3. `reclaim{name}`: any phase; reject `name_in_use` while that player has a live socket
- [x] 4. `host.releaseName`: closes that player's socket so reclaim succeeds
- [x] 5. `host.promote`: spectator → voter only before Voting
- [x] 6. `host.removePlayer`: `removed=true`; data excluded from tally
- [x] 7. Host link + `join` creates host as voter by default
- [x] 8. 🧪 Matrix: join per phase; reclaim live vs dead; promote after Voting rejected; remove excludes data
- [x] 9. 👁 log `player.joined` / `player.reclaimed` / `player.promoted` / `player.removed`; metric `players_joined`

### 4.7 Phase Machine
Requires: 4.6 complete
Produces: Lobby → Pitching → Voting → Closed

- [x] 1. Host-only transitions; invalid → `error bad_transition`; repeats idempotent
- [x] 2. `startPitching`: set `roster_locked`
- [x] 3. `openVoting`: create ballot per voter (order = lineup minus own pitch); scoring unlocked for all pitches
- [x] 4. `closeVoting`: run tally (4.11), set `closed_at`, set retention alarm (4.12)
- [x] 5. Closed rejects every write except `host.updatePitch` title/presenter name
- [x] 6. 🧪 Transition table incl. reverse transitions rejected
- [x] 7. 🧪 Ballots created exactly once per voter
- [x] 8. 👁 log `phase.changed` INFO `{from,to}`; `roster.locked` INFO `{voters}`; `voting.closed` INFO `{counted,voided}`

### 4.8 Pitch Management
Requires: 4.7 complete
Produces: pitch CRUD, status, mid-session add rules

- [x] 1. `host.addPitch`: title 1–80; presenter name 1–24; explicit `presenterPlayerId` or `none`; allowed Lobby/Pitching/Voting
- [x] 2. `position` = insertion order; status defaults `upcoming`
- [x] 3. `host.setStatus` presenting → previous presenting becomes `done`
- [x] 4. `host.updatePitch`: title/presenter name editable any phase; presenter link immutable once Voting opens
- [x] 5. `host.removePitch`: purge its scores, chips, ballot entries
- [x] 6. Add during Voting: append unplaced to every eligible ballot; set all voters `submitted=false`
- [x] 7. 🧪 Add during Voting resets submitted flags and excludes presenter's ballot
- [x] 8. 🧪 Presenter link change after Voting rejected
- [x] 9. 🧪 Removal purges all dependent rows
- [x] 10. 👁 log `pitch.added` / `pitch.updated` / `pitch.removed` / `pitch.status`

### 4.9 Notes Writes
Requires: 4.8 complete
Produces: `setScore`, `setChips`

- [x] 1. `setScore{pitchId, category, value}`: voter only; not own pitch; pitch `presenting`/`done` or phase Voting; integer within category range; upsert
- [x] 2. `setChips{pitchId, chipIds}`: ids valid; replaces set; same permission rules
- [x] 3. Reject all in Lobby and Closed
- [x] 4. 🧪 Reject: spectator, own pitch, upcoming pitch before Voting, out-of-range, Closed, removed player
- [x] 5. 🧪 Last-write-wins on rapid duplicate taps
- [x] 6. 👁 log `score.saved` DEBUG; metric `writes_ok`

### 4.10 Ballot Writes
Requires: 4.9 complete
Produces: `movePitch`, `placePitch`, `submitBallot`

- [x] 1. `movePitch`: phase Voting; voter with ballot; applies `applyMove`; marks placed
- [x] 2. `placePitch`: marks placed; order unchanged
- [x] 3. `submitBallot`: `ballotComplete` else `error incomplete{missing[]}`
- [x] 4. Edits after submit keep `submitted=true` (resets only via 4.8)
- [x] 5. 🧪 Move/place idempotent on replay
- [x] 6. 🧪 Submit blocked: missing score, unplaced NEW; allowed when complete
- [x] 7. 🧪 Edit after submit keeps submitted
- [x] 8. 👁 log `ballot.reordered` DEBUG, `ballot.submitted` INFO; metric `ballots_submitted`

### 4.11 Tally on Close
Requires: 4.10, 2.5 complete
Produces: persisted `results` row broadcast to all

- [x] 1. `closeVoting` builds snapshot, calls `computeResults`, persists JSON
- [x] 2. Voided/removed players' data retained in storage, excluded from results
- [x] 3. Broadcast `view` with `results`
- [x] 4. 🧪 Scripted 6-voter session through WebSocket test client equals shared fixture
- [x] 5. 🧪 Tally exception → phase stays Voting, error returned, A2 raised
- [x] 6. 👁 log `tally.computed` INFO `{counted, voided, ms}`; metric `tallies_run`
- [x] 7. 👁 Alert A2 banner appears on host client when tally throws (forced test)

### 4.12 Limits, Export, Retention
Requires: 4.11 complete
Produces: rate limiting, raw export, expiry

- [x] 1. Token bucket 20 msg/s per socket; 3 strikes → close 4008
- [x] 2. `GET /api/s/:code/export` with host secret header: raw JSON of all tables, any phase
- [x] 3. Raw JSON restorable shape documented in `docs/export-format.md`
- [x] 4. Alarm at `closed_at + 30 d` deletes all storage
- [x] 5. Wrap all storage writes: exception → `write.failed` ERROR, metric `writes_failed`, A1 to host
- [x] 6. 🧪 Rate limit trips and closes socket
- [x] 7. 🧪 Export rejects missing/wrong secret
- [x] 8. 🧪 Alarm handler deletes data (fake timers)
- [x] 9. 🧪 Forced storage error raises A1
- [x] 10. 👁 log `rate.limited` WARN, `export.raw` INFO, `session.expired` INFO; metric `rate_limited`

Go when: all backend tests green; scripted full session passes over WebSocket; privacy property test green; forced-failure alerts verified

---

## 5. Client Realtime Layer
Requires: 3.2, 4.3, 4.4, 4.5 complete
Produces: resilient connection, store, write queue, saved indicator, alert banner

### 5.1 Connection Manager
Requires: 4.3 complete
Produces: reconnecting WebSocket client

- [x] 1. Connect to `/api/s/:code/ws`; send `hello` with stored `playerId` / host secret
- [x] 2. Reconnect with backoff 0.5 → 8 s plus jitter
- [x] 3. On `visibilitychange` → visible: reconnect immediately if not open
- [x] 4. On open: server pushes full `view`; replace store
- [x] 5. Status states: `connecting` · `online` · `offline`; shown in header
- [x] 6. `window.onerror` / unhandledrejection → send `client.error{message, stack≤1KB}` when online
- [x] 7. 🧪 Mock-socket tests: backoff schedule, visibility reconnect
- [x] 8. 👁 Server logs `client.error` WARN with `playerId`; client `console.info` state transitions

### 5.2 Store & Selectors
Requires: 5.1, 2.4 complete
Produces: view store, selectors

- [x] 1. Store holds latest `view`, connection status, pending writes
- [x] 2. Selectors: `me`, `eligiblePitches`, `missingItems`, `waitingOn`, `isSpectator`
- [x] 3. 🧪 Selectors against fixtures

(no observability required: derived state)

### 5.3 Write Queue (Ack/Retry)
Requires: 5.2 complete
Produces: optimistic writes, ordered retry, saved indicator

- [x] 1. Assign `clientSeq`; apply optimistic update using shared pure functions
- [x] 2. Mark pending until `ack`; resend pending in order after reconnect
- [x] 3. On `error` for a seq: revert optimistic change; show toast
- [x] 4. Indicator states in the header connection pill (specimen `.conn`): `Saved ✓` · `Saving…` · `Offline — N pending` (guide wording "Reconnecting…" maps to the offline/connecting states here)
- [x] 5. 🧪 Drop socket mid-write → reconnect → one applied effect; order preserved
- [x] 6. 🔍 Playwright offline→online toggle keeps all taps
- [x] 7. 👁 `console.debug` queue depth on reconnect
- [x] 8. Scenes: `saving`, `offline-pending`

### 5.4 Alert Banner
Requires: 5.1 complete
Produces: host `serverAlert` banner

- [x] 1. Render A1/A2 banner on host with "Download raw JSON" button
- [x] 2. Scenes: `banner-a1`, `banner-a2`
- [x] 3. 🧪 Component test: banner shows on `serverAlert`, hidden for players

(no observability required: presentational)

Go when: Playwright test shows zero lost writes across offline/online and background/foreground cycles

---

## 6. Landing, Join & Roster Screens
Requires: 3, 5, 4.2, 4.6 complete
Produces: create, join, reclaim, lobby/roster, spectator screens
Authority: guide §6 (`join`, `lobby-*`) and specimen sections Join and Players. Code and host link use the gold code plate (`.code-plate`). Copy and Download are Inter secondary/ghost buttons, not red enamel. One red-enamel primary per state (Create session, Join, Start pitching).

### 6.1 Landing & Create
Requires: 3.2, 4.2 complete
Produces: create-session flow

- [x] 1. Form: CREATE_KEY input + "Create session"
- [x] 2. Success: show player link + host link; Copy buttons; notice "Save the host link"
- [x] 3. Store host link in localStorage; navigate to session
- [x] 4. Scenes: `landing`, `created`, `create-key-error`
- [x] 5. 🧪 401 shows inline error
- [x] 6. 🔍 `npm run shots` green for new scenes
- [x] 7. 🔍 Copy buttons yield exact links (clipboard test)

(no observability required: server logs cover create/auth)

### 6.2 Join & Reclaim
Requires: 6.1, 5.3, 4.6 complete
Produces: name-only join

- [x] 1. Name field autofocus; limit 24; Enter submits
- [x] 2. `name_taken` → "That's me (reclaim)" or pick another name
- [x] 3. `name_in_use` → message "That name is active on another device"
- [x] 4. Persist `playerId` in cookie + localStorage; reload restores identity
- [x] 5. Scenes: `join`, `join-name-taken`, `join-name-in-use`
- [x] 6. 🧪 Reload restores identity; cleared storage lands on name picker
- [x] 7. 🔍 Shots green

(no observability required: server logs cover join/reclaim)

### 6.3 Lobby & Roster
Requires: 6.2 complete
Produces: roster list, spectator state, host roster actions

- [x] 1. Players list with badges Host / Voter / Spectator and connected dot
- [x] 2. Read-only lineup list
- [x] 3. Spectator banner: "You joined after roster lock — view only"
- [x] 4. Host actions: promote, remove, release name (confirm dialogs)
- [x] 5. Scenes: `lobby-player`, `lobby-host`, `spectator`
- [x] 6. 🧪 Host buttons absent for players
- [x] 7. 🔍 Two browser contexts see each other's join within 2 s
- [x] 8. 🔍 Shots green

(no observability required: presentational)

Go when: create → join ×2 → roster visible live in two contexts; shots green

---

## 7. Host Console
Requires: 4.7, 4.8, 5, 6 complete
Produces: pitch manager, phase controls, waiting panel, raw export
Authority: guide §6 `host-controls` and specimen "Close confirm" / "Submit · blocked + waiting". Phase primary is the only enamel button. Close dialog lists voided names; buttons stack full width, safe action first (`.modal`). Waiting names are amber-LED pills (`.waiting`). Toast/errors use the guide toast recipe (red-100 on red-700 tint), which the specimen does not render.

### 7.1 Pitch Manager
Requires: 6.3, 4.8 complete
Produces: add/rename/remove/status UI

- [ ] 1. Add form: title, presenter dropdown (players + "Not a player"), presenter name
- [ ] 2. List with status chip; "Now presenting" button; rename; remove (confirm)
- [ ] 3. Presenter link control disabled once Voting opens
- [ ] 4. Scenes: `host-pitches`, `host-pitch-form`
- [ ] 5. 🧪 Form validation (empty title, >80 chars)
- [ ] 6. 🔍 Added pitch appears on a second client within 2 s
- [ ] 7. 🔍 Shots green

(no observability required: server logs cover pitch events)

### 7.2 Phase Controls
Requires: 7.1, 4.7 complete
Produces: confirmed transitions

- [ ] 1. Sticky bar: current phase + next action button
- [ ] 2. Confirm dialog per transition with effect text: "Locks roster: N voters" / "Creates N ballots" / "Voids: names"
- [ ] 3. Close dialog lists unsubmitted players
- [ ] 4. Scenes: `host-controls`, `host-close-confirm`
- [ ] 5. 🧪 No transition fires without confirm
- [ ] 6. 🔍 Shots green

(no observability required: server logs `phase.changed`)

### 7.3 Waiting Panel & Safety Net
Requires: 7.2, 4.12, 5.4 complete
Produces: waiting list, debug counters, raw JSON download

- [ ] 1. Waiting list panel + "All ballots in" state
- [ ] 2. Debug toggle shows `writes_failed`, `reconnects`, connected count from view
- [ ] 3. "Download raw JSON" button available in every phase
- [ ] 4. Scenes: `host-waiting`, `host-debug`
- [ ] 5. 🧪 Download returns valid JSON matching `docs/export-format.md`
- [ ] 6. 👁 Server logs `export.raw` on click
- [ ] 7. 🔍 Shots green

Go when: Playwright e2e drives host + 2 players Lobby → Closed through the UI

---

## 8. Notes Screen
Requires: 4.9, 5, 6 complete
Produces: live note-taking UI with autosave

### 8.1 Pitch Card & Scores
Requires: 5.3, 3.1 complete
Produces: three score inputs per pitch

- [ ] 1. Score pads per guide §5 and specimen "Notes · now presenting" (`.cat`, `.pad`, `.score`): Compellingness 1–5 ice band, Funniness 1–5 gold band, Hotness 1–10 red band in two rows of 5. Unselected: dark inset, gold-500 edge, Russo numeral. Selected: category fill, ink numeral, gold-200 edge.
- [ ] 2. No default selection
- [ ] 3. Own pitch → locked card "Your pitch — no scoring" (specimen locked panel: dashed border, no glow)
- [ ] 4. Upcoming pitches → "Coming up" section, same locked treatment, disabled until presenting/done or Voting
- [ ] 5. Each tap sends `setScore` via queue; show Saved indicator
- [ ] 6. Scenes: `notes-empty`, `notes-filled`, `notes-upcoming-locked`, `notes-own-pitch`
- [ ] 7. 🧪 Tap sends one `setScore` with incrementing `clientSeq`
- [ ] 8. 🔍 Playwright: every score button ≥48px, no overlap at 360 px
- [ ] 9. 🔍 Shots green

(no observability required: presentational; server logs `score.saved`)

### 8.2 Chips
Requires: 8.1 complete
Produces: two chip groups

- [ ] 1. Groups "Investable because…" and "Cautious because…"; multi-select toggles; wrap layout. Match specimen chips (`.chip--invest`, `.chip--caution`): 48px pills, Inter 14.
- [ ] 2. Investable = green-300 outline → filled green-300 + ink + check. Cautious = neutral-300 outline → filled neutral-300 + ink + check. No category band fills on chips (guide §4).
- [ ] 3. Each toggle sends `setChips` with full set
- [ ] 4. Scenes: `notes-chips`
- [ ] 5. 🧪 Toggle on/off round trip
- [ ] 6. 🔍 Shots green

(no observability required: presentational)

### 8.3 Focus & Progress
Requires: 8.2 complete
Produces: presenting-pitch focus, progress counter

- [ ] 1. Presenting pitch pinned at top; scroll into view only when status changes
- [ ] 2. Progress "N/M scored" counting complete pitches
- [ ] 3. Scenes: `notes-presenting`
- [ ] 4. 🧪 Host marks next pitch → focus moves on a second client
- [ ] 5. 🔍 Shots green

(no observability required: presentational)

Go when: 3 contexts score concurrently with correct autosave; shots green

---

## 9. Ranking & Submission
Requires: 4.10, 8 complete
Produces: drag/button ranking, NEW handling, submit gating, waiting banner

### 9.1 Ranking List
Requires: 8.1, 4.10 complete
Produces: reorderable list

- [ ] 1. dnd-kit Sortable; handle-only drag; TouchSensor delay 150 ms / tolerance 5; Pointer and Keyboard sensors. Card geometry from guide §5 Rank card and specimen "Rank" (`.rank`): 40px handle, 44px position disc, body, 48px ▲▼ stack, min-height 100px.
- [ ] 2. Handle `touch-action: none`; list scrolls normally elsewhere
- [ ] 3. Up/down buttons (48px, clip-path triangles, gold-100) per card send `movePitch`. Disabled ends use `neutral-500` as non-text only.
- [ ] 4. Card: rank numeral (Russo, gold), title (Inter 16, wraps, no ellipsis), presenter, my 3 scores as Russo numerals with ice/gold/red dots, my chips
- [ ] 5. Send `movePitch` on drop only
- [ ] 6. Scenes: `ranking-default`, `ranking-reordered`
- [ ] 7. 🧪 Reorder uses shared `applyMove` (optimistic = server result)
- [ ] 8. 🔍 Playwright mouse drag and button moves both reorder
- [ ] 9. 🔍 Shots green

(no observability required: presentational; server logs `ballot.reordered`)

### 9.2 NEW Handling
Requires: 9.1 complete
Produces: NEW badge flow

- [ ] 1. NEW badge + "Place here" gold action on unplaced pitches (specimen `.rank--new`, `.badge-new`): dashed red-300 card border, red-enamel "NEW" tag with 1px gold edge
- [ ] 2. Moving a NEW card clears badge
- [ ] 3. Scenes: `ranking-new-badge`
- [ ] 4. 🧪 Host adds pitch in Voting → badge appears on voter within 2 s
- [ ] 5. 🔍 Shots green

(no observability required: presentational)

### 9.3 Submit & Waiting
Requires: 9.2 complete
Produces: gated submit, persistent waiting banner

- [ ] 1. Sticky Submit: one red-enamel primary (56px pill, 2px gold edge, Russo caps, flat gold-100). Disabled shows `missing[]` as 48px jump links (specimen `.missing`). Ready state may use the 3.2s `ready-pulse` (guide D3).
- [ ] 2. Submitted state: "Submitted ✓ — edits still save"
- [ ] 3. Waiting banner "Waiting on: names" on all tabs during Voting; "All ballots in" when empty
- [ ] 4. Scenes: `submit-blocked`, `submit-ok`, `waiting-list`
- [ ] 5. 🧪 Client `missing[]` equals server `missing[]` in fixtures
- [ ] 6. 🧪 Pitch added after submit flips voter back into waiting list
- [ ] 7. 🔍 Shots green

(no observability required: server logs `ballot.submitted`)

Go when: drag + buttons verified in Playwright and on two real phones; submit gating matches server

---

## 10. Results
Requires: 4.11, 2.5, 9 complete
Produces: results screen on all clients
Authority: guide §6 `results-*` and `closed-voided`, specimen "Results". Voided list is a quiet panel, muted text, strikethrough names (spec only — not in the specimen).

### 10.1 Results Screen
Requires: 4.11 complete
Produces: Borda headline, score leaderboard, flags, voter lists

- [ ] 1. Borda leaderboard matches guide §5 Result row and specimen "Results" (`.result`, `.medal`): medal discs (gold / neutral / copper, then gold-edged outline), Inter title that wraps, gold bar, Russo 24 score. 1st row gets the 2px gold-300 frame.
- [ ] 2. Secondary score leaderboard: stacked mini-bars using category fills only inside those bars, total /15, note "Hotness ÷ 2"
- [ ] 3. Flag chips: amber-300 text + amber-500 outline, plus ▲/▼ and words (never color alone). Copy shape "Crowd #2 · Scores #5" stays; treatment is the guide flag, not a category hue.
- [ ] 4. Counted and voided voter names listed
- [ ] 5. Scenes: `results-borda`, `results-flags`, `closed-voided`
- [ ] 6. 🧪 Render from fixture results equals expected order
- [ ] 7. 🔍 Titles never truncated at 360 px
- [ ] 8. 🔍 Shots green

(no observability required: presentational; server logs `tally.computed`)

### 10.2 Closed Behavior
Requires: 10.1, 4.7 complete
Produces: read-only state with host rename exception

- [ ] 1. Disable all inputs when Closed
- [ ] 2. Host-only rename for titles/presenter names stays enabled
- [ ] 3. 🧪 e2e: score tap after close rejected and UI disabled
- [ ] 4. 🧪 e2e: host rename after close updates all clients; results order unchanged

(no observability required)

Go when: full e2e through Closed shows results identical to shared fixture

---

## 11. Exports [post-event ok]
Requires: 10, 4.12 complete
Produces: CSV/MD downloads, chart-card PNGs

### 11.1 Data Exports
Requires: 4.12, 10.1 complete
Produces: CSV ×2, Markdown

- [ ] 1. Export endpoint (after Closed) returns rows; voter index randomized per export
- [ ] 2. CSV 1: voter-pitch rows (voterIndex, pitch, C, F, H, chips, rank position, counted)
- [ ] 3. CSV 2: pitch summary with all stats, Borda, both ranks, flag
- [ ] 4. Host toggle to include names (confirm: "de-anonymizes ballots")
- [ ] 5. Markdown summary: leaderboard, stats, top chips per pitch
- [ ] 6. 🧪 CSV escaping: commas, quotes, newlines in titles
- [ ] 7. 🔍 Open both CSVs in a spreadsheet; values match results screen
- [ ] 8. 👁 server logs `export.raw` / export event with row counts

### 11.2 Chart Cards
Requires: 11.1, 3.1 complete
Produces: leaderboard PNG + per-pitch PNG cards

- [ ] 1. Pure SVG builders in `shared/`: leaderboard (Hotness ÷ 2, axis 0–15) and pitch card (Hotness raw 1–10 axis)
- [ ] 2. Card elements: jittered votes (seeded by pitchId), min–max whisker, IQR band, mean dot with white ring, SD text, total "X.X / 15"
- [ ] 3. Embed Inter as base64 `@font-face` inside SVG (SVG rendered as image cannot load external fonts)
- [ ] 4. SVG → canvas → PNG at 2000 px wide; filenames from pitch titles
- [ ] 5. Measure title width; wrap/scale so titles never truncate
- [ ] 6. "Download all" button
- [ ] 7. Scenes: `card-preview`, `leaderboard-preview`
- [ ] 8. 🧪 SVG snapshot test from fixture
- [ ] 9. 🔍 Render 3 cards + leaderboard via Playwright; view PNGs for clipped/overlapping labels; compare to Hot Takes references. These PNGs stay light (guide D2). Do not restyle them with `we-rankin-tokens.css`.
- [ ] 10. 🔍 Fix title typos via host rename, re-export

(no observability required: client-side rendering)

Go when: 3 cards + leaderboard match reference style with no clipping

---

## 12. QA & Event Readiness
Requires: 1–10 complete (11 optional)
Produces: verified deployed build, host kit, Go/No-Go

### 12.1 Automated E2E
Requires: 10 complete
Produces: `npm run e2e` against local dev

- [ ] 1. Playwright: host + 3 player contexts → Lobby → Closed; screenshot per phase
- [ ] 2. Cases: presenter exclusion, late joiner becomes spectator, unsubmitted voided, pitch added during Voting, reclaim after cleared storage
- [ ] 3. 🧪 Final Borda order equals fixture expectation
- [ ] 4. 🧪 Voided voter absent from counted list
- [ ] 5. 👁 No `write.failed` or ERROR lines in server log during run

### 12.2 Load
Requires: 12.1 complete
Produces: `npm run sim` results

- [ ] 1. `scripts/sim.ts`: 25 WebSocket bots join, score all, rank, submit
- [ ] 2. Measure send→`view` receipt latency
- [ ] 3. 🧪 0 errors; p95 ≤2 s
- [ ] 4. 👁 `metrics` after run: `writes_failed`=0, `rate_limited`=0
- [ ] 5. 🔍 Estimate daily requests vs Workers Free limit; record headroom

### 12.3 Real Devices
Requires: 1.4, 9 complete
Produces: device sign-off

- [ ] 1. (host) iPhone Safari + Android Chrome: join, score, reorder 10 pitches, submit
- [ ] 2. 🔍 No scroll hijack while dragging
- [ ] 3. 🔍 Lock phone 60 s mid-scoring → unlock → no lost taps
- [ ] 4. 🔍 Open link in Messages/Slack in-app browser, then switch to Safari → reclaim works
- [ ] 5. 🔍 Rotate to landscape: no clipped controls

(no observability required: manual device checks; server logs cover traffic)

### 12.4 Rehearsal on Deployed URL
Requires: 12.1–12.3 complete
Produces: rehearsal evidence

- [ ] 1. (host) 3 dummy pitches, ≥3 devices, through Closed on workers.dev
- [ ] 2. 👁 `npx wrangler tail` during run: 0 ERROR lines
- [ ] 3. 🔍 Dashboard usage vs free quotas recorded
- [ ] 4. 🔍 Raw JSON downloaded and opens

### 12.5 Host Kit & Go/No-Go
Requires: 12.4 complete
Produces: printed cheat sheet, T-60 checklist

- [ ] 1. One-page cheat sheet: links, phase order, what "voided" means, raw JSON/CSV-with-names de-anonymize ballots, paper fallback steps
- [ ] 2. Pre-print paper rank sheets (1…N) as fallback
- [ ] 3. Save host link in 2 places
- [ ] 4. T-60 min checks: `/api/health` 200, create-session works, 2 phones join, tail open
- [ ] 5. 🔍 Fallback drill: read raw JSON, hand-tally one ballot with Borda formula

(no observability required)

Go when: rehearsal clean, kit printed, T-60 checklist passes

---

## Cut Line
- Never cut: 0–10, 12.1, 12.3, 12.5, 7.3 raw JSON
- Cut order if late: 11.2 chart cards → 11.1 Markdown → disagreement flags (2.5.3, 10.1.3) → chips (8.2) → pitch rename/remove (7.1.2)
- Fallback if live failure: paper ballots + Borda tally; download raw JSON first

## Changelog
- 2026-11-16: Foundation started. Local toolchain (Node 22, npm 10, Wrangler 4.72), workspaces, Vite client, Session DO skeleton, `.dev.vars` / `.env.example`, `wrangler.jsonc`, `vercel.json`. Health and SPA fallback checked on `wrangler dev`. Vercel remote env and Cloudflare login still host tasks. Playwright and the Durable Object vitest stub are not done yet.
- 2026-11-16: Checklist v0.2. App UI sections now follow Style Guide v1 (`we-rankin-style-guide.md`), `we-rankin-tokens.css`, `we-rankin-components.css`, and `we-rankin-style-specimen.html`. Section 3.1 no longer specifies the v0 light palette. Chart-card exports (11.2) stay Hot Takes (guide D2). Backend, domain, and protocol items are unchanged.
- 2026-11-16: Cloudflare account Alluminate is authenticated via `.env` (`whoami` ok). Git remote is `official-mitchell/rankin`. Logger, metrics, alerts, and the Durable Object vitest stub are in. `wrangler deploy` is live at `https://we-rankin.opatowsky77.workers.dev` (version `79cf9ce7-fe2d-4d51-821f-1ac0fc966fce`). `/api/health` returned 200 from this machine. `CREATE_KEY` secret is set. `main` is pushed (`9f3a453`). `wrangler tail` produced no lines in this session. Phone checks, dashboard logs, Git-build confirmation, and the rollback rehearsal are still open.
- 2026-11-16: Checklist 2.1–2.5. Shared domain lives in `shared/src`: types, config, stats, Borda, ballot rules, `computeResults`. Fixtures in `shared/src/domain.test.ts` (11 tests) plus the existing app-name test. Message payloads are still discriminants only until 4.4. Disagreement direction is `crowd` when the Borda rank is better and `scores` when the score rank is better.
- 2026-11-16: Checklist 3.1–3.5. Client tokens and shell, local Inter and Russo One, `/` and `/s/:code`, dev-only `/__fixtures/:scene` (`shell` placeholder). `npm run shots` writes `shots/*.png` and `shots/manifest.json` (gitignored until host approves baselines). Worker returns 404 for `/__fixtures` via `run_worker_first`. Style loop is `AGENTS.md` and `docs/style-checklist.md` (Appendix A copied as written: items 1–6 scripted, 7–10 visual). Shot script assertions cover overflow, clipped text, 48px targets, and console errors. Appendix items 3–6 are on the checklist for visual/later screens; they are not all enforced in `shots.ts` yet.
- 2026-11-16: Checklist 4.1–4.12. Session Durable Object now owns the SQLite schema, host-secret session create, hibernating WebSocket auth, zod commands, private views, roster and phase rules, pitches, notes, ballots, tally, rate limit, raw export, and the 30-day alarm. Worker tests cover the scripted six-voter tally, privacy, and forced A1/A2 failures.
- 2026-11-16: Checklist 5.1–5.4. The session page reconnects with backoff, replaces the store from each view, queues writes until ack, and shows the Saved / Saving / Offline pill. Host sockets render the A1/A2 banner with raw JSON download. `client.error` is logged at warn with the player id.
- 2026-11-16: Checklist 6.1–6.3. Landing creates a session and shows copyable player and host links. Join stores the player id in localStorage and a cookie. The roster shows Host, Voter, and Spectator, a read-only lineup, the spectator notice, and host confirmations for promote, remove, and release. Two browser tabs saw both joins.
