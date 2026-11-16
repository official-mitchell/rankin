# Style checklist

Copied from `instructions/we-rankin-style-guide.md` Appendix A. Scripted items are asserted by `npm run shots`. Visual items are checked on the PNGs beside `instructions/we-rankin-style-specimen.html`.

- [ ] 1. **Scripted** — Every interactive element (button, chip, link, input, score, tab) is ≥ 48×48 px.
- [ ] 2. **Scripted** — No horizontal overflow at 360×740 and 390×844.
- [ ] 3. **Scripted** — No `text-overflow: ellipsis` / line-clamp on pitch titles, player names, chips.
- [ ] 4. **Scripted** — No text under 13px; all inputs ≥ 16px.
- [ ] 5. **Scripted** — No text uses `neutral-500`, `red-400/500`, or a gradient fill under 28px; Russo One elements all have `font-weight: 400`.
- [ ] 6. **Scripted** — Every red-enamel element has a gold border (2px buttons, 1px tags); ≤ 1 red-enamel **button** visible per screen state.
- [ ] 7. **Visual** — Category bands/fills appear only inside category panels, score dots, or result bars.
- [ ] 8. **Visual** — Pitch titles and names are Inter sentence case; Russo caps only on short labels/numerals/headings.
- [ ] 9. **Visual** — Stars are shapes, ≤ 2 per heading; ≤ 1 line of flavor copy on the screen; errors and confirmations are plain.
- [ ] 10. **Visual** — Locked/upcoming/own pitches read as locked (dashed, no glow) and the blocked Submit shows its reasons.
