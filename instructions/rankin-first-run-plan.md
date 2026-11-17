<!-- Plan of attack for the first-run landing. 2026-11-16: created from host review of the live landing screen. -->

# Rankin' first-run plan

> **For agentic workers:** Do not start implementation from this file until the host says to. This plan overrides the landing copy and chrome in `instructions/we-rankin-prd.md` and `instructions/we-rankin-style-guide.md` where they disagree. Leave those files unchanged until this plan is accepted, then update them add-only.

**Goal:** A first-time visitor understands what Rankin' is, who starts a session, and what the phase marks mean, before any host secret or player tool is on screen.

**Architecture:** Change the landing and the shared shell in `client/src/screens/Landing.tsx` and `client/src/Shell.tsx`. Explain the product once, in a first-visit dialog. Show session phase as a progress mark, not as controls. Hide host setup until someone elects to be the game master. Leave Notes, Rank, and Results behavior alone until the landing reads clearly.

**Tech Stack:** Existing Vite client, fixture scenes in `client/fixtures`, Playwright via `npm run shots`.

## Global constraints

- Product name on screen is **Rankin'**.
- The wordmark has a star on each side.
- The Live pill is not on the landing screen.
- Phase labels are Lobby, Pitching, Voting, Closed. They are not buttons.
- The create key is a game-master secret. It is not the first thing a visitor sees.
- One red-enamel button per screen state still applies once a screen has a real action.
- Compare new shots to `instructions/we-rankin-style-specimen.html` and `docs/style-checklist.md`.

## What is wrong today

Playwright shots of `landing.390x844.png` show the current first screen:

- A Live pill sits beside the title. The host already rejected that.
- The title is “WE RANKIN'” with one star.
- Lobby, Pitching, Voting, and Closed sit in a gold box and look like buttons. Pressing them does nothing, because they are status.
- “Rank the pitches. Settle it by Borda.” does not explain the session.
- Create key and Create session are in front of everyone. A bad key only says it was not accepted.
- Notes, Rank, and Players are tappable with no reason to open them before a session exists.

## Copy to use

First-visit dialog title: **Rankin'**

Body: This is a ranked-choice voting app. It uses a Borda count for live ranked-choice voting after something you just did together.

Rules, in this order:

1. A game master starts the session.
2. The game master sets the start time and the end time.
3. No one can join late.
4. The session starts only after people have committed.
5. The session ends when the game master collects every response. That takes a submission from everyone, or an early close. On an early close, the game master can keep an unfinished person's votes from counting.
6. Results are shown after the session ends.

## Order of attack

Work top to bottom on the first screen. Do not restyle Notes, Rank, or Results in the same pass.

### 1. Header

- Rename the visible title to Rankin'.
- Put one star on the left and one star on the right.
- Remove the Live pill from the landing screen.
- Connection state can return on screens where a session is actually connected. It does not belong on the empty landing.

Files: `client/src/Shell.tsx`, landing fixture, `scripts/shots.ts` assertions if they require the Live string.

Check: `npm run shots`, then read `shots/landing.390x844.png`.

### 2. Phase progress

- Remove the gold box around Lobby, Pitching, Voting, and Closed.
- Render the four labels as a progress sequence. The current phase is marked. Earlier phases read as done. Later phases read as not yet.
- Nothing in that row is a control, and nothing in that row uses the red-enamel button treatment.
- A thin connector between the labels is the progress cue. Text labels stay at least 13px.

Files: `client/src/Shell.tsx`, shell styles, fixtures that mount `Shell`.

Check: landing, a pitching fixture, a voting fixture, and a closed fixture at 390 and 360. No horizontal overflow. Phase row is not in the tab order as buttons.

### 3. First-visit explanation

- Remove “Rank the pitches. Settle it by Borda.”
- On the first landing visit, open a dialog with the copy in **Copy to use**.
- Dismissing it remembers that this browser has seen it.
- A quiet control on the landing screen can open the same dialog again.
- The dialog is plain. No flavor line, no extra star decoration beyond the header rule already set.

Files: `client/src/screens/Landing.tsx`, a small client flag, a landing fixture for the open dialog and one for the dismissed state.

Check: first load shows the dialog. A later load in the same browser does not. Escape and the dismiss control both close it.

### 4. Game master, then create

- The default landing has no create-key field.
- A visitor who wants to host chooses **Become the game master**.
- Only that path shows the create key, the explanation that the key proves you are the game master, and **Create session**.
- A rejected key says what was wrong in plain language, next to the field.
- Everyone else gets the path for joining a session that already exists, once that screen exists. Until then, the landing must not pretend the create key is a general login.

Files: `client/src/screens/Landing.tsx`, landing fixtures `landing`, plus a host-elected fixture and the existing create-key error fixture.

Check: cold landing has no key field. After electing game master, the field is there. A bad key does not look like a mystery failure.

### 5. Bottom row

- Notes, Rank, and Players stay out of the landing screen until the viewer is inside a session.
- When they return, each label needs one line of purpose, or the row waits until the phase where that tool matters. Notes during pitching. Rank during voting. Players when the roster matters.
- Do not invent a third navigation model in this pass. Hide the row on landing first.

Files: `client/src/Shell.tsx`. Landing calls the shell without the player tabs.

Check: `shots/landing.390x844.png` has no Notes / Rank / Players bar. A voting fixture still reaches Rank.

### 6. Record the override

After the host accepts the shots:

- Add the new landing rules to `instructions/we-rankin-prd.md` and `instructions/we-rankin-style-guide.md` without deleting the older rules. Mark the older landing lines as superseded and point here.
- Update `docs/style-checklist.md` only if a scripted check changed.

## Out of this pass

- Rewriting the rank ballot, note chips, or results board.
- Changing Borda math, late-join enforcement, or the close-without-counting rule. Those rules are explained in the dialog. Their server behavior stays as already built unless a later pass finds it wrong.
- Committing screenshot baselines. That still waits for host approval.

## Changelog

- 2026-11-16: Created from host review of the running landing screen. Decisions recorded: drop Live on landing, name the product Rankin' with a star on each side, make phase a progress mark, replace the Borda tagline with a first-visit rules dialog, hide the create key until someone elects to be game master, and remove Notes / Rank / Players from the empty landing.
- 2026-11-16: Steps 1–5 implemented in the client shell and landing. New shot scenes: `landing` (dialog), `landing-ready`, `landing-host`.
- 2026-11-16: Landing is two buttons with no panel: Become the Game Master starts a session with no typed key. Join a game accepts a full link or a bare session code. The shared CREATE_KEY check on POST /api/sessions is no longer required.
