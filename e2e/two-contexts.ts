// Two browser tabs join one session and see each other within 2s (checklist 6.3).
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

function createKey(): string {
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("CREATE_KEY="));
  if (!line) throw new Error("CREATE_KEY is missing");
  return line.slice("CREATE_KEY=".length).trim();
}

function start(command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, { stdio: "inherit" });
  return child;
}

async function waitFor(url: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

const worker = start("npx", ["wrangler", "dev", "--port", "8787"]);
const vite = start("npx", ["vite", "--config", "client/vite.config.ts", "--host", "127.0.0.1", "--port", "5173", "--strictPort"]);
const browser = await chromium.launch();
try {
  await waitFor("http://127.0.0.1:8787/api/health");
  await waitFor("http://127.0.0.1:5173/");
  const host = await browser.newContext();
  const page = await host.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("#create-key").fill(createKey());
  await page.getByRole("button", { name: "Create session" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  const player = page.getByRole("textbox", { name: "Your name" });
  await player.fill("Ada");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByText("Ada", { exact: false }).first().waitFor();

  const guest = await browser.newContext();
  const other = await guest.newPage();
  await other.goto("http://127.0.0.1:5173/s/" + new URL(page.url()).pathname.split("/").pop());
  await other.getByRole("textbox", { name: "Your name" }).fill("Bea");
  await other.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByText("Bea").waitFor({ timeout: 2000 });
  await other.getByText("Ada").waitFor({ timeout: 2000 });
  console.log("two tabs saw both joins");
} finally {
  await browser.close();
  worker.kill("SIGTERM");
  vite.kill("SIGTERM");
}
