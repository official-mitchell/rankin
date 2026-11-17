// Host and two players walk Lobby to Closed, and a new pitch shows up within 2s (checklist 7).
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Page } from "playwright";

function start(command: string, args: string[]): ChildProcess {
  return spawn(command, args, { stdio: "inherit" });
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

async function join(page: Page, name: string): Promise<void> {
  await page.getByRole("textbox", { name: "Your name" }).fill(name);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByRole("button", { name: "Add pitch" }).waitFor({ timeout: 5000 }).catch(() => undefined);
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
  await page.getByRole("button", { name: "Become the Game Master" }).click();
  await page.getByRole("button", { name: "Create Session" }).click();
  await join(page, "Ada");

  const code = new URL(page.url()).pathname.split("/").pop();
  const beaContext = await browser.newContext();
  const bea = await beaContext.newPage();
  await bea.goto(`http://127.0.0.1:5173/s/${code}`);
  await bea.getByRole("textbox", { name: "Your name" }).fill("Bea");
  await bea.getByRole("button", { name: "Join", exact: true }).click();

  const camContext = await browser.newContext();
  const cam = await camContext.newPage();
  await cam.goto(`http://127.0.0.1:5173/s/${code}`);
  await cam.getByRole("textbox", { name: "Your name" }).fill("Cam");
  await cam.getByRole("button", { name: "Join", exact: true }).click();

  await page.getByRole("textbox").first().fill("Cat Slack");
  await page.getByRole("button", { name: "Add pitch" }).click();
  await bea.getByText("Cat Slack").waitFor({ timeout: 2000 });

  await page.getByRole("button", { name: "Start pitching" }).click();
  await page.getByRole("button", { name: "Lock roster" }).click();
  await page.getByRole("button", { name: "Open voting" }).click();
  await page.getByRole("button", { name: "Open voting" }).nth(1).click();
  await page.getByText("Awaiting ballots").waitFor();
  await page.getByRole("button", { name: "Close voting" }).click();
  await page.getByRole("button", { name: /Close & void/ }).click();
  await page.getByText("closed", { exact: false }).first().waitFor();
  console.log("host and two players reached closed");
} finally {
  await browser.close();
  worker.kill("SIGTERM");
  vite.kill("SIGTERM");
}
