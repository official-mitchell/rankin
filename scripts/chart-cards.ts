// Renders three pitch cards and the leaderboard to PNGs (checklist 11.2). Light Hot Takes palette.
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { leaderboardSvg, pitchCardSvg, pngFileName, type ChartPitch } from "../shared/src/charts.ts";

const font = readFileSync("node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2").toString("base64");

const pitches: ChartPitch[] = [
  {
    pitchId: "a",
    title: "Uber for Dog Walkers, but the Dogs Pay in Tennis Balls",
    presenterName: "Ada",
    votes: { compellingness: [5, 4, 3], funniness: [4, 5, 2], hotness: [9, 7, 8] },
    categories: {
      compellingness: { mean: 4, sd: 0.82, min: 3, max: 5, p25: 3.5, p75: 4.5 },
      funniness: { mean: 3.7, sd: 1.25, min: 2, max: 5, p25: 3, p75: 4.5 },
      hotness: { mean: 8, sd: 0.82, min: 7, max: 9, p25: 7.5, p75: 8.5 },
    },
    scoreTotal: 11.7,
  },
  {
    pitchId: "b",
    title: "Slack for Cats",
    presenterName: "Bea",
    votes: { compellingness: [3, 2, 4], funniness: [5, 5, 4], hotness: [6, 5, 7] },
    categories: {
      compellingness: { mean: 3, sd: 0.82, min: 2, max: 4, p25: 2.5, p75: 3.5 },
      funniness: { mean: 4.7, sd: 0.47, min: 4, max: 5, p25: 4.5, p75: 5 },
      hotness: { mean: 6, sd: 0.82, min: 5, max: 7, p25: 5.5, p75: 6.5 },
    },
    scoreTotal: 10.7,
  },
  {
    pitchId: "c",
    title: "Airbnb for Parking Spaces Inside Airbnbs",
    presenterName: "Cam",
    votes: { compellingness: [2, 2, 3], funniness: [3, 2, 2], hotness: [4, 5, 3] },
    categories: {
      compellingness: { mean: 2.3, sd: 0.47, min: 2, max: 3, p25: 2, p75: 2.5 },
      funniness: { mean: 2.3, sd: 0.47, min: 2, max: 3, p25: 2, p75: 2.5 },
      hotness: { mean: 4, sd: 0.82, min: 3, max: 5, p25: 3.5, p75: 4.5 },
    },
    scoreTotal: 6.6,
  },
];

const files = [
  { name: "leaderboard.png", svg: leaderboardSvg(pitches, font) },
  ...pitches.map((pitch) => ({ name: pngFileName(pitch.title), svg: pitchCardSvg(pitch, font) })),
];

await mkdir("shots/charts", { recursive: true });
const browser = await chromium.launch();
try {
  for (const file of files) {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${file.svg}</body>`);
    const width = Number(await page.locator("svg").getAttribute("width"));
    const height = Number(await page.locator("svg").getAttribute("height"));
    if (width !== 2000) throw new Error(`${file.name} is ${width}px`);
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `shots/charts/${file.name}` });
    await page.close();
    console.log(file.name);
  }
} finally {
  await browser.close();
}
await writeFile("shots/charts/manifest.json", `${JSON.stringify(files.map((file) => file.name), null, 2)}\n`);
