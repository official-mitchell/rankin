# We Rankin' — Style Guide v1 (Soviet-Industrial)

Status: draft for sign-off · 2026-11-16 · **Replaces Style Guide v0** (the light "Hot Takes" system in the PRD).
Source of truth: Soviet Spinners — `css/tokens.css`, `css/app.css`, `css/launch.css`, `index.html`, README, `Demo.png`, `Demo2.png`, logo (github.com/official-mitchell/Soviet-Spinners, deployed at soviet-spinners.vercel.app).
Companion files: `we-rankin-tokens.css` (drop-in tokens), `we-rankin-components.css` (reference component CSS), and the rendered specimen page. Layout, tap-target and overflow rules were audited on the specimen at 360, 390 and 430 px wide (0 overflow, 0 targets under 48px, 0 console errors); contrast figures were computed from the hex values.

Legend: **[S]** carried from Soviet Spinners · **[WR]** new or changed for We Rankin' · **[✓n:1]** measured WCAG contrast.

---

## 1. What Soviet Spinners actually is

A dark, desktop-first (1440px, TV/projector) "Soviet-industrial casino" console. Everything is built from five ingredients:

1. **Iron and enamel.** Near-black warm-neutral canvas (#0e0f11), brushed-metal gradients on panels, a faint paper-grain noise overlay (6%), and glossy **red enamel** (three-stop gradient) for the things you press.
2. **Gold as the only edge.** Every important container has a 2px gold frame (#be9134) with a soft gold glow and an inset 1px hairline 8px inside it. Headings are gold. Dividers between reels are translucent gold.
3. **Three accent families used as slot identities** — red, gold, ice (blue) — shown as gradient header bands on each column. Ice doubles as the "frozen/locked" state.
4. **Two voices in type.** Russo One (a single-weight, squared, poster-style face) in uppercase with wide tracking for brand, headings, numerals and signature buttons; Inter for everything you read.
5. **Stars and hardware.** A red ★ flanks titles and eyebrows; corner rivets, LED dots, a lever, and a pressed-button feel (1px translate, inner highlights).

Voice: "Soviet-industrial casino flair" — "★ Spin Slots ★", "Stand by…", "Surprise me", "Game Night Picks", "turns 'who goes next?' into a show". Playful propaganda-poster energy, never political.

## 2. Principles for We Rankin'

1. **Enamel for the one thing to press.** At most one red-enamel primary action per screen state (Join, Submit ballot, Open voting, Close voting). Everything else is quieter.
2. **Gold is the edge, red is the action, ice/gold/red are only categories inside category panels.**
3. **Labels shout, content whispers.** Russo One caps is for short labels, numerals and headings (≤ ~24 characters). Pitch titles, player names, chips and anything a user typed are Inter, sentence case, and **never truncated** [WR].
4. **Every control is a physical part.** Inset shadows when unselected, lit fill when selected, 1px press on `:active`. No hover-dependent affordances (phones).
5. **Phone first, projector never.** The source's 44/40/32px controls, 11px captions and 13px inputs are all raised (see §8).
6. **Flavor lives at the edges.** Themed words appear in eyebrows and empty/celebration states; functional wording carries errors, confirmations and data.

## 3. Foundations

### 3.1 Color

Kept from Soviet Spinners **[S]** unchanged: the neutral, red, gold, ice, green, amber and copper ramps (full values in `we-rankin-tokens.css`). The roles:

| Role | Token | Hex | Use |
|---|---|---|---|
| Canvas | `--bg-canvas` | #0e0f11 | Page background |
| Panel | `--bg-panel` | #141518 | Cards, sheets |
| Raised | `--bg-panel-raised` | #1a1b1f | Nested cards, rank cards, modals |
| Control | `--bg-control` | #23252a | Secondary buttons, pills |
| Inset | `--bg-inset` | #08090a | Phase rail, tab bar, wells |
| Text | `--text-primary` / `-secondary` / `-muted` | #eee8da / #d5cebf / #b0aa9e | Body / supporting / labels |
| Gold text | `--text-gold` / `-muted` | #f8e7ad / #d9b654 | Headings, numerals / eyebrows |
| Ink | `--text-ink` | #0e0f11 | Text on light fills only **[WR]** |
| Gold edge | `--border-gold` | #be9134 | Frames, input borders |
| Functional edge | `--border-strong` | #85827c | Outline buttons, pills **[WR: raised from #5a5c63]** |
| Brand red | `--red-600` family | #a8131d | Enamel buttons, active tab, NEW badge |
| Status | green-300 / amber-300 / red-300 | #79d792 / #f3c663 / #ef5356 | LEDs, success/warning/danger text |

### 3.2 Contrast ledger (measured, WCAG 2.x)

Allowed text pairings. Anything not listed needs a new measurement.

| Text | On | Ratio |
|---|---|---|
| primary #eee8da | canvas / panel / red-800 | 15.7 / 14.9 / 11.5 ✓ |
| secondary #d5cebf | panel | 11.7 ✓ |
| **muted #b0aa9e (floor for readable text)** | panel / raised / control | 7.9 / 7.5 / 6.6 ✓ |
| disabled #85827c | panel | 4.8 ✓ (disabled is never the only signal) |
| gold-100 | panel | 14.8 ✓ |
| gold-100 | **red enamel**, top → bottom stops (red-500 → red-800) | 4.7 → 11.4 ✓ |
| gold-100 | gold band/button (gold-600 → gold-800) | 6.6 → 13.3 ✓ |
| gold-300 | panel / raised | 9.4 / 8.8 ✓ |
| ice-050 | ice band (ice-600 → ice-800) | 8.8 → 15.4 ✓ |
| ink | selected fills: ice-300 / gold-300 / red-300 / green-300 / neutral-300 / copper-300 | 8.8 / 9.8 / 5.5 / 10.9 / 8.3 / 10.2 ✓ |
| green-300 chip text | panel-raised | 9.8 ✓ |
| neutral-300 chip text | panel-raised | 7.5 ✓ |
| amber-300 (flags, warnings) | panel-raised | 10.7 ✓ |

**Do not use as text:** `neutral-500` #5a5c63 (2.7 ✗), `red-500` (3.1, large only), `red-400` (4.0, decorative/large only), `gold-500/600` on red (3.0 / 1.7 ✗), `ink` on `red-400` (4.2 ✗ — use red-300 for fills).
**Non-text (≥3:1 needed):** gold-400 border 6.3 ✓ · gold-500 border 3.8 ✓ · neutral-400 border 4.8 ✓ · `neutral-600/700` borders (1.9 / 1.4) are **decorative only**. A red-600 fill against the panel is only 2.4:1, so **every red-enamel control carries its gold 2px edge** — the edge, not the fill, is what makes it perceivable.

### 3.3 Typography

- **Russo One** 400 — display. **Inter** 400/500/600/700 — body. Bundle both via `@fontsource/russo-one` and `@fontsource/inter` (no CDN; the PRD already requires this for Inter).
- Russo One has one weight. Never set `font-weight: 700` on it — browsers fake a bold. Set `font-synthesis: none` on `body`. **[WR: the source did this in several places]**
- Scale (PRD v0 values kept; Soviet display sizes folded in):

| Token | Size | Face | Use |
|---|---|---|---|
| numeral | 40 | Russo | Big stats, results scores (24 inside list rows) |
| title | 28 | Russo caps, +0.06em, gold-100 | Landing/results titles. **24px in the app header** so it fits beside the connection pill |
| card-title | 20 | Inter 600 | Pitch title on Notes |
| body | 16 | Inter 400–600 | Default; **all inputs ≥16px** (iOS zooms smaller) |
| label | 13 | Inter 600 caps +0.1em, or Russo caps | Eyebrows, tab labels, tags. **13px is the floor** — source's 11px caption is dropped |

- Russo caps tracking: +0.06em titles, +0.10em labels and buttons, +0.24em session code. Line-height 1.0–1.2.
- Russo for ≤ ~24 characters. Pitch titles (≤80 chars), names (≤24), chips: **Inter, sentence case, wrap, never `text-overflow: ellipsis` or line-clamp.**
- **Gold-gradient text** (source's button labels) fades to gold-500/600 over red-800 → 1.7–3.0:1 at the bottom of the glyphs. **[WR] Use flat gold-100.** Gradient text is allowed only ≥ 28px on enamel with every stop ≥ gold-200.
- Russo caps = brand/status/headings/**signature actions** (Join, Submit ballot, Now presenting). Inter sentence case = **utility actions** (Copy host link, Keep open, Download raw JSON). Same split the source uses ("★ SPIN SLOTS ★" vs "Add slot", "Import CSV").

### 3.4 Space, radius, border, tap

- 4px grid: 4 8 12 16 20 24 32 40 48. Page gutter 16px; **12px at ≤380px** so 5-up score pads stay ≥48px wide at 360 **[WR]**.
- Radius: 4 badge · 8 score button/small controls · 12 buttons, inputs, nested cards · 16 panels (PRD v0 "card 16" kept) · 24 hero housings · pill for primary CTA, chips, LED pills.
- Border: 1px hairline · **2px = interactive/frame** · 4px reserved for hero frames.
- **Tap target 48×48 minimum; primary CTA 56px tall** [WR; source 32–44]. 8px minimum gap between adjacent targets.
- Safe areas: `viewport-fit=cover`, bottom tab bar adds `env(safe-area-inset-bottom)`.

### 3.5 Surfaces and ornaments

| Recipe | Spec | Use |
|---|---|---|
| **Gold frame panel** [S] | `bg-panel`, 2px `gold-400` border, radius 16, `shadow-panel` + `glow-gold` | Default primary container |
| **Inset hairline** [S] | `::after` inset 8px, 1px `rgba(190,145,52,.22)`, radius −4 | Landing, results, any "hero" panel |
| **Metal** [S] | `linear-gradient(180deg, neutral-750, neutral-950)` + inset bottom shadow | Join/hero panels |
| **Quiet panel** [WR] | `bg-panel-raised`, 1px `border-subtle`, no glow | Lists (roster, waiting), so gold stays rare |
| **Locked panel** [WR] | transparent, 1px **dashed** `border-strong`, opacity .78, no glow (✓5.7 muted text) | Upcoming pitch, "Your pitch" |
| **Red enamel** [S] | `linear-gradient(180deg, red-500 0%, red-600 46%, red-800 100%)` + inner top highlight + **gold edge: 2px on buttons, 1px on tags/pills** | The primary action (button); NEW badge and live pill (tags) |
| **Gold enamel** [S] | `gold-600 → gold-700 → gold-800` | Secondary signature actions |
| **Noise** [S, WR] | 6% fractal-noise SVG, **tiled at 256px** (source stretched one tile over the viewport) | `body::before`, fixed, `pointer-events:none` |
| **Rivets** [S] | 4 corner dots, gold 35%, 2px | Hero housings only, never repeated lists |
| **★** [S] | Five-point star as a **CSS clip-path shape** (not the ★ glyph — font fallback varies), `red-400` + red glow in titles/eyebrows; gold-300 elsewhere | Flank titles/eyebrows; max 2 per heading |
| **LED** [S, 8px → 10px] | 10px circle; off `neutral-500`, ok `green-300`, wait `amber-300`, bad `red-300`, each with a 10px glow | Connection, roster presence, waiting list, live pitch |

Allowed iconography: ★, LEDs, triangles (▲▼ as clip-path shapes), dot-grid drag handle, CSS check. **No hammer-and-sickle, no portraits, no faux-Cyrillic lettering.**

### 3.6 Motion

| Token | ms | Use |
|---|---|---|
| instant | 80 | Press feedback |
| **fast** | **120** | **Default transition; fits the PRD's ≤150ms cap** |
| emphasis | 240 | Results reveal, ballot submitted (needs sign-off, D3) |
| ease-standard | cubic-bezier(.2,0,0,1) | Default |
| ease-settle | cubic-bezier(.15,.8,.25,1.05) | Drop-in settle on rank change |

- Drag/reorder: no animation except the position settle (PRD). Lifted card: scale 1.02 + gold glow.
- **One ambient loop allowed:** Submit button "ready" pulse (3.2s red glow) when the ballot is complete **[S, restricted]**. Source's 4.2s result shimmer, lock pulse and spin sequences are dropped.
- `prefers-reduced-motion`: collapse all to 0.01ms (source rule kept) — also what the screenshot loop forces.
- No audio in v1 (source ships four mp3 cues; 25 phones in one room, autoplay rules).

## 4. Category and semantic color assignments

**Categories reuse the three slot accents of Soviet Spinners [WR — Option A, see D1]:**

| Category | Accent | Band (header) | Selected-score fill | Dot in rank cards |
|---|---|---|---|---|
| Compellingness 1–5 | **Ice** | ice-600 → ice-800, text ice-050 | ice-200 → ice-300, ink text | ice-300 |
| Funniness 1–5 | **Gold** | gold-700 → gold-800, text gold-100 | gold-200 → gold-300, ink text | gold-300 |
| Hotness 1–10 | **Red** | red-700 → red-800, text gold-100 | red-300 (flat + highlight), ink text | red-300 |

Reservation rule (replaces v0's "category hues reserved for their scores only"): **category fills and bands appear only inside a category panel, a score dot, or that category's result bar. Chips, phase UI and buttons never use band-style fills.** Brand-red enamel is shaped and placed differently (pill, full-width, gold-edged), so Hotness-red and CTA-red don't collide in practice.
Ice is therefore **not** the "frozen/locked" color here (it is in the source); locked = dashed iron panel.

| Meaning | Treatment |
|---|---|
| Investable chip | green-300 outline → filled green-300 + ink text + ✓ when selected |
| Cautious chip | neutral-300 outline → filled neutral-300 + ink text + ✓ |
| Voter / Spectator tag | green-300 outline caps / neutral outline caps |
| Live / now presenting | red enamel pill + red LED |
| Coming up / locked | dashed neutral pill/panel |
| Done | green outline pill + ✓ |
| Submitted / present | green LED · pending: amber LED · offline: neutral LED · error: red LED |
| Medals (results) | 1st gold-300 · 2nd neutral-200 · 3rd copper-300 disc, ink numeral; 4th+ gold-edged outline disc |
| Disagreement flag | amber-300 text + amber-500 outline, ▲/▼ + "N on scores" (never color alone) |
| Voided | quiet panel, `text-muted`, strikethrough name, functional copy |

## 5. Components

Rendered and audited in the specimen except **Toast/error, Voided state and the host-link plate**, which are specs only (verify in the screenshot loop). `sel` = selected state. Heights are minimums.

| Component | Spec |
|---|---|
| **App header** | 56px. Left: red ★ + "WE RANKIN'" (Russo 24, gold-100, `nowrap`). Right: **connection pill** (32px tall visual, `nowrap`; LED + "Saved ✓" / "Saving…" / "Reconnecting…"). |
| **Phase rail** | 4-up segmented, `bg-inset`, 1px gold border, 40px steps, Russo 13 caps. Done: `text-muted` · active: `red-800` + 3px gold bottom bar + gold-050 text · future: `text-disabled`. Replaces the source's sidebar nav. |
| **Bottom tabs** (Notes · Rank · Players) | 56px, `bg-inset`, gold border, radius 16. Russo 14 caps gold-100. Active = `red-800` + 3px gold **top** bar (the source's left bar, rotated). |
| **Primary button** | 56px pill, red enamel, 2px gold-400 edge, Russo 18 caps +0.1em, **flat gold-100**, ★ prefix optional, full width on phones. `:active` −1px translate, darker enamel. Disabled: opacity .45 and **always paired with a reason list above it**. |
| **Gold action** | 48px, radius 12, gold enamel, Russo 15 caps gold-100. |
| **Secondary / ghost** | 48px, Inter 600. Secondary: `bg-control`, 2px `border-strong`. Ghost: transparent, same border. |
| **Danger** | 48px, `red-700` fill, 2px `red-400` border, `red-100` Inter text (✓9.0). Label states the consequence: "Close & void 2 ballots". |
| **Input** | 56px, radius 12, 2px gold border, `neutral-700 → neutral-850` fill, **Inter 500 18px, no uppercase transform** (names are case-sensitive for collisions), gold-100 text, gold-300 placeholder. Focus: gold-200 border + gold glow. |
| **Session code plate** | Gold-framed well, Russo 36, +0.24em tracking (add equal left padding to stay centered), radial gold wash at top. The same plate holds the **host link** (Inter 14, wraps) with a 48px "Copy host link" secondary button beneath it. |
| **Score pad** | Inside a category panel: 5-column grid, gap 8, inner padding 12×8. **Score button 52px tall, ≥48 wide**, radius 8, 2px `gold-500` border, `neutral-850 → 900` fill + inset shadow, Russo 22 numeral. `sel`: category fill, ink numeral, gold-200 border + gold glow. **No default selection, no sliders.** Hotness 1–10 = two rows of 5. |
| **Category panel** | `bg-panel-raised`, 1px subtle border, radius 12, clipped; 44px **band** (§4) with Russo 13 caps name left and `1–5` / `1–10` range right, 1px gold bottom edge. |
| **Chip** | 48px pill, 2px border in chip color, Inter 600 14. `sel`: filled + ink text + CSS ✓. Wraps freely; group titled by eyebrow with colored ★. |
| **Pitch header** | Status pill (28px) · title Inter 600 20 · "Presented by …" `label`. |
| **Rank card** | Grid `40px handle · 44px position disc · 1fr body · 48px ▲▼ stack`; **min-height 100px** (so both 48px arrows clear the borders), radius 12, 1px gold border, `bg-panel-raised`. Handle: dark strip + dot grid, `touch-action:none`, press-delay drag. Position disc: 40px, 2px gold ring, Russo 20 gold-100. Title Inter 600 16, **wraps fully**. Score recap: three Russo 13 numerals with 8px category-color dots. ▲/▼: 48×48 `bg-control`, gold-100 clip-path triangles; disabled at ends = `neutral-500` (non-text, decorative). `dragging`: scale 1.02, gold-200 border + glow. |
| **NEW badge / row** | Dashed `red-300` card border; red-enamel "NEW" tag (Russo 13) next to the title; gold-action "Place here" (48px) inside the card. |
| **Submit bar** | Blocked: a **Missing list** — each row a 48px full-width link, `red-700` 35% tint, 1px `red-400` border, `red-100` text, gold "Jump ›" — above a disabled primary. Ready: primary + "ready" pulse. |
| **Waiting list** | Quiet panel; eyebrow "Awaiting ballots · 3 of 14"; wrap of 36px pills (amber LED + name). Empty → "All ballots in ★" and host's Close button takes the pulse. |
| **Roster row** | 48px, bottom hairline, LED + name (Inter 600, wraps) + tag. |
| **Result row** | `44px medal · 1fr title+bar · score`; 1st row gets a 2px gold-300 frame plus the gold tint from the source's `stat-card--total` recipe. Score = Russo 24, gold-100, 6px bar (inset track, gold-500 → gold-200). Flag under the title. |
| **Close-confirm modal** | Scrim `rgba(0,0,0,.72)`, modal `bg-panel-raised`, 1px gold border, radius 16, padding 20. Title Russo 18 caps gold-100. Body lists the **voided names**. **Buttons stack full-width on phones** (safe action first, danger second). |
| **Toast / error** | Source's `spin-error`: `red-700` 35% tint, 1px `red-400` border, `red-100` text, radius 8. Plain-English copy, no flavor. |

## 6. Screen recipes (maps to PRD scenes)

| Scene | Recipe |
|---|---|
| `join` | Centered, canvas + radial gold wash (source `launch.css`). Eyebrow "★ Session code ★", code plate, name input, primary "Join". |
| `lobby-*` | Header + phase rail; Players quiet panel (LED + tag); host: host-link plate + primary "Start pitching". |
| `notes-*` | Pitch panel (gold frame) → three category panels → chip groups. "Coming up" and "Your pitch" use the locked panel. |
| `ranking-*` | Eyebrow "Your ballot", rank list, NEW cards inline, submit bar below. List scrolls with page; **drag handle only** captures touch. |
| `submit-blocked` / `waiting-list` | Missing list + disabled primary; waiting panel under it. |
| `host-controls` | Gold-frame panel with the phase's one primary (Open voting / Close voting), then secondary/ghost utilities (Copy host link, Download raw JSON). |
| `closed-voided` | Quiet panel, "Polls closed", counted vs voided lists in `text-muted`. |
| `results-*` | Hero panel (inset hairline, optional rivets): eyebrow "★ Borda ranking ★", result rows, then "Score leaderboard" quiet panel. |

## 7. Voice and copy

Rule: **functional label first, flavor in the eyebrow or empty state, one flavor per screen.** Never flavor errors, confirmations, results data or destructive actions.

| Surface | Functional (required) | Flavor (optional) |
|---|---|---|
| Landing | Create session | "Rank the pitches. Settle it by Borda." |
| Lobby eyebrow | Players · 14 | "★ Awaiting the comrades ★" |
| Pitching | Now presenting | — |
| Voting | Submit ballot | "★ Ballots open ★" |
| Waiting | Awaiting ballots · 3 of 14 | "All ballots in ★" |
| After submit | Ballot submitted | "Ballot received ★" |
| Empty pitch list | No pitches yet | "Stand by…" (source phrase) |
| Closed | Voting closed | "★ Polls closed ★" |
| Void | Not submitted before close — ballot not counted | — |
| Errors / reconnect | Plain English | — |

Casing: Russo labels UPPERCASE; buttons and body sentence case; no exclamation marks; no mock accents.

## 8. Defects in the source — do not port

1. Faux bold: `font-weight:700` on Russo One (single weight).
2. Gradient button labels that fall to 1.7–3.0:1 at glyph bottoms.
3. Controls 32/40/44px; 11px captions; 13px uppercase-Russo inputs (iOS auto-zoom).
4. `neutral-500` used for disabled icons/borders (2.7:1).
5. `launch.css` references `--type-body-lg` (never defined) and `--text-danger` (only via an inline fallback). We define `--text-danger` and use `--type-body`.
6. Hover-only polish and a 1440px three-column shell, lever, reels, sound — all dropped.
7. Noise overlay stretched to the viewport — tile it.
8. Ice used for both "slot accent" and "frozen" — we assign ice to Compellingness only.

## 9. Decisions needing sign-off

| # | Decision | Recommendation |
|---|---|---|
| D1 | Category colors: **A** Soviet slot accents (ice / gold / red) vs **B** keep v0 hues (blue / violet→pink / red→yellow) inside dark panels | **A.** Violet/pink has no home in this palette; A also maps v0's blue→ice and red→red. |
| D2 | Exported chart-card PNGs (Phase 7.2): keep v0 light "Hot Takes" look or go dark Soviet | **Keep Hot Takes** so cards sit next to prior results; they're exports, not app UI. |
| D3 | Motion: allow the single Submit "ready" pulse + 240ms emphasis (PRD says ≤150ms) | **Allow**, reduced-motion kills it. |
| D4 | Theme intensity: light (flavor in eyebrows only) vs heavy | **Light** — 25 friends on phones need clarity mid-vote. |
| D5 | Wordmark: CSS text now vs a badge like the Soviet Spinners logo | **Text now**; badge later. |

## 10. Impact on PRD and checklist (if adopted)

- PRD **Style Guide v0** section → replace with this doc. Open item "Sign off Style Guide v0 proposed values" → "Sign off Style Guide v1 (D1–D5)".
- Checklist **3.1** items 1–3 (tokens, gradients, type scale), 4 (also bundle Russo One), 6–8 (contrast rules/tests: new ledger in §3.2; "text on gradient uses ink" becomes "text on enamel uses gold-100, on light fills uses ink").
- Checklist **3.5** `docs/style-checklist.md` → Appendix A below.
- **Phase 1.1** "Design tokens file" → `we-rankin-tokens.css`.

---

## Appendix A — `docs/style-checklist.md` (10 yes/no items for the screenshot loop)

Scripted = assert in `npm run shots`; Visual = check the PNG.

1. **Scripted** — Every interactive element (button, chip, link, input, score, tab) is ≥ 48×48 px.
2. **Scripted** — No horizontal overflow at 360×740 and 390×844.
3. **Scripted** — No `text-overflow: ellipsis` / line-clamp on pitch titles, player names, chips.
4. **Scripted** — No text under 13px; all inputs ≥ 16px.
5. **Scripted** — No text uses `neutral-500`, `red-400/500`, or a gradient fill under 28px; Russo One elements all have `font-weight: 400`.
6. **Scripted** — Every red-enamel element has a gold border (2px buttons, 1px tags); ≤ 1 red-enamel **button** visible per screen state.
7. **Visual** — Category bands/fills appear only inside category panels, score dots, or result bars.
8. **Visual** — Pitch titles and names are Inter sentence case; Russo caps only on short labels/numerals/headings.
9. **Visual** — Stars are shapes, ≤ 2 per heading; ≤ 1 line of flavor copy on the screen; errors and confirmations are plain.
10. **Visual** — Locked/upcoming/own pitches read as locked (dashed, no glow) and the blocked Submit shows its reasons.

## Appendix B — Source map

| Extracted | From |
|---|---|
| Palette, semantic roles, type, spacing, radius, border, shadow, glow, motion, easing, surface recipes, noise | `css/tokens.css` |
| Header/nav/frame/rivet/button/input/checkbox/stat-card/LED/modal/error/dashed-eliminated/mobile patterns | `css/app.css` (2,857 lines) |
| Gold radial wash, countdown ring, centered interstitial | `css/launch.css`, `launch.html` |
| Fonts (Google: Inter 400–700, Russo One), favicon, shell | `index.html` |
| Voice, audience, "Soviet-industrial casino flair" | `README.md` |
| Badge anatomy (red star + gold center star, red banner, three stars, rivets, dark steel) | `src/Soviet Spinners Logo.png` |
| Visual confirmation of rendered result | `Demo.png`, `Demo2.png` |

Not verified: the deployed Vercel site returned only its title and viewport meta to my fetch tool, so it was **not** compared against the repo; the repo CSS and the two README screenshots are the basis for everything above.
