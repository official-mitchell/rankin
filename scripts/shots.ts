// Captures fixture scenes for checklist 3.4. Writes shots/*.png and shots/manifest.json.
import { spawn, type ChildProcess } from "node:child_process";
import { get } from "node:http";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { shotFailures } from "./shot-assert.ts";

const PORT = 5173;
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x740", width: 360, height: 740 },
  { name: "430x844", width: 430, height: 844 },
];

type Row = {
  scene: string;
  viewport: string;
  pass: boolean;
  durationMs: number;
  failures: string[];
  notes: string[];
  file: string;
};

async function waitForServer(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    const ok = await new Promise<boolean>((resolve) => {
      const request = get(BASE, (response) => {
        response.resume();
        resolve((response.statusCode ?? 500) < 500);
      });
      request.setTimeout(1000, () => {
        request.destroy();
        resolve(false);
      });
      request.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("vite did not start");
}

function startVite(): ChildProcess {
  return spawn("npx", ["vite", "--config", "client/vite.config.ts", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    stdio: "inherit",
  });
}

const server = startVite();
let exitCode = 0;
try {
  await waitForServer();
  await mkdir("shots", { recursive: true });
  const scenes = (await readdir("client/fixtures")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
  const browser = await chromium.launch();
  const rows: Row[] = [];
  const runStarted = Date.now();
  for (const scene of scenes) {
    for (const viewport of VIEWPORTS) {
      const started = Date.now();
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        hasTouch: true,
      });
      const consoleErrors: string[] = [];
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await page.goto(`${BASE}/__fixtures/${scene}`, { waitUntil: "networkidle" });
      const probe = await page.evaluate(() => {
        const root = document.documentElement;
        const clipped = [...document.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          const hidden = style.overflowX === "hidden" || style.overflowX === "clip" || style.overflow === "hidden";
          return hidden && element.scrollWidth > element.clientWidth + 1;
        }).length;
        const smallTargets = [...document.querySelectorAll("button, a, input, .chip")].filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.width < 48 || box.height < 48);
        }).length;
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, clipped, smallTargets };
      });
      const file = `shots/${scene}.${viewport.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      await page.close();
      const failures = shotFailures({ ...probe, consoleErrors });
      rows.push({
        scene,
        viewport: viewport.name,
        pass: failures.length === 0,
        durationMs: Date.now() - started,
        failures,
        notes: consoleErrors,
        file,
      });
    }
  }
  await browser.close();
  const manifest = {
    durationMs: Date.now() - runStarted,
    pass: rows.every((row) => row.pass),
    rows,
  };
  await writeFile("shots/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  const header = "scene        viewport   pass  ms    failures";
  console.log(header);
  for (const row of rows) {
    console.log(
      `${row.scene.padEnd(12)} ${row.viewport.padEnd(10)} ${row.pass ? "pass" : "FAIL"}  ${String(row.durationMs).padStart(4)}  ${row.failures.join(", ")}`,
    );
  }
  console.log(`total ${manifest.durationMs}ms`);
  if (!manifest.pass || manifest.durationMs > 60_000) exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
process.exit(exitCode);
