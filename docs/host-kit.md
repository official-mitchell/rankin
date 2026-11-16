<!-- 2026-11-16: One-page host kit for checklist 12.5. -->

# Host kit

One page for the night of the event. Print this sheet. The phone checks in section 12.3 and the multi-device rehearsal in 12.4 are still host tasks.

## Links

- Player link: `https://we-rankin.opatowsky77.workers.dev/s/CODE`
- Host link: the same URL plus `#h=` and the secret. It is shown once at create time. Copy it, then paste it into a password manager and into a note on a second device.
- Health: `https://we-rankin.opatowsky77.workers.dev/api/health` should return 200.

## Phase order

1. Lobby. Everyone joins. Add pitches. **Start pitching** locks the roster. Anyone who joins after that is a spectator.
2. Pitching. The live pitch can be scored. Upcoming pitches stay locked. A presenter cannot score their own pitch.
3. Voting. Ballots open. **Open voting** creates one ballot per voter. A pitch added now lands at the end as NEW and must be placed.
4. Closed. Scores and ranks freeze. The host can still rename a title or a presenter name. Everyone sees the Borda board.

## What "voided" means

A voter who has not pressed Submit when voting closes is voided. Their ballot and their scores are left out of the tally. Their name is listed under "Not submitted before close" with a strikethrough. Spectators are not counted either.

## Exports de-anonymize ballots

Raw JSON and the ballots CSV with **Include names** attach real names to scores and ranks. The confirm copy is "de-anonymizes ballots". Leave names off unless you mean to share that file. The summary CSV and the chart PNGs do not include voter names.

## Paper fallback

If the app fails after pitches exist:

1. Download raw JSON first if the server still answers.
2. Hand out the paper rank sheets (`docs/paper-rank-sheet.md`).
3. Tally with Borda. For a ballot of length n, a pitch at position p (first place is 1) scores `(n - p) / (n - 1)`. Average that across the ballots that contain the pitch. Sort high to low. Ties break by more first-place votes, then by the score total.
4. Worked line: three pitches, a ballot ranked Alpha, Gamma, Beta. n = 3. Alpha is position 1, so `(3 - 1) / (3 - 1) = 1`. Gamma is position 2, so `(3 - 2) / 2 = 0.5`. Beta is position 3, so `0`.

## T-60

- [ ] `/api/health` returns 200
- [ ] Create a session with the create key
- [ ] Two phones join on cellular
- [ ] `npx wrangler tail` is open
- [ ] Host link is saved in two places
- [ ] Paper sheets are printed

## Changelog

- 2026-11-16: Added the one-page kit: links, phase order, voided meaning, de-anonymize warning, paper fallback, and the T-60 list. Phones, printing, and the live tail are still host tasks.
