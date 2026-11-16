// Three voters score at once, and the presenting pitch follows the host (checklist 8).
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

function createKey(): string {
  const line = readFileSync(".dev.vars", "utf8").split("\n").find((entry) => entry.startsWith("CREATE_KEY="));
  if (!line) throw new Error("CREATE_KEY is missing");
  return line.slice("CREATE_KEY=".length).trim();
}

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
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function join(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url);
  await page.getByRole("textbox", { name: "Your name" }).fill(name);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByRole("button", { name: "Notes" }).waitFor();
}

const vite = start("npx", ["vite", "--config", "client/vite.config.ts", "--host", "127.0.0.1", "--port", "5173", "--strictPort"]);
const browser = await chromium.launch();
try {
  await waitFor("http://127.0.0.1:8787/api/health");
  await waitFor("http://127.0.0.1:5173/");
  const host = await browser.newPage();
  await host.goto("http://127.0.0.1:5173/");
  await host.locator("#create-key").fill(createKey());
  await host.getByRole("button", { name: "Create session" }).click();
  await host.getByRole("button", { name: "Enter session" }).click();
  await host.getByRole("textbox", { name: "Your name" }).fill("Ada");
  await host.getByRole("button", { name: "Join", exact: true }).click();
  const code = new URL(host.url()).pathname.split("/").pop();
  const session = `http://127.0.0.1:5173/s/${code}`;
  const bea = await (await browser.newContext()).newPage();
  const cam = await (await browser.newContext()).newPage();
  await join(bea, session, "Bea");
  await join(cam, session, "Cam");
  await host.getByRole("button", { name: "Players" }).click();
  const title = host.locator("input").first();
  await title.fill("First pitch");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await title.fill("Second pitch");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await host.getByRole("button", { name: "Start pitching" }).click();
  await host.getByRole("button", { name: "Lock roster" }).click();
  await host.getByRole("button", { name: "Now presenting" }).first().click();
  await bea.getByRole("button", { name: "Notes" }).click();
  await bea.getByText("First pitch").waitFor({ timeout: 2000 });
  await host.getByRole("button", { name: "Now presenting" }).first().click();
  await bea.getByText("Second pitch").waitFor({ timeout: 2000 });
  await host.getByRole("button", { name: "Open voting" }).click();
  await host.getByRole("button", { name: "Open voting" }).nth(1).click();
  await Promise.all([bea, cam, host].map(async (page) => {
    await page.getByRole("button", { name: "Notes" }).click();
    await page.getByRole("button", { name: "3", exact: true }).first().click();
  }));
  await bea.getByText("Saved", { exact: true }).waitFor();
  console.log("three voters scored and the focus moved");
} finally {
  await browser.close();
  vite.kill("SIGTERM");
}
