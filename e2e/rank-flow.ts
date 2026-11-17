// Drag handle, move buttons, and a late pitch badge (checklist 9).
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
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function positions(page: Page): Promise<string[]> {
  return page.locator(".rank__title").allInnerTexts();
}

const worker = start("npx", ["wrangler", "dev", "--port", "8787"]);
const vite = start("npx", ["vite", "--config", "client/vite.config.ts", "--host", "127.0.0.1", "--port", "5173", "--strictPort"]);
const browser = await chromium.launch();
try {
  await waitFor("http://127.0.0.1:8787/api/health");
  await waitFor("http://127.0.0.1:5173/");
  const host = await browser.newPage();
  await host.goto("http://127.0.0.1:5173/");
  await host.getByRole("button", { name: "Become the Game Master" }).click();
  await host.getByRole("button", { name: "Create Session" }).click();
  await host.getByRole("textbox", { name: "Your name" }).fill("Ada");
  await host.getByRole("button", { name: "Join", exact: true }).click();
  const session = host.url();
  const bea = await (await browser.newContext()).newPage();
  await bea.goto(session.split("#")[0]);
  await bea.getByRole("textbox", { name: "Your name" }).fill("Bea");
  await bea.getByRole("button", { name: "Join", exact: true }).click();
  await host.getByRole("button", { name: "Players" }).click();
  const title = host.locator("input").first();
  await title.fill("Alpha");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await title.fill("Beta");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await host.getByRole("button", { name: "Start pitching" }).click();
  await host.getByRole("button", { name: "Lock roster" }).click();
  await host.getByRole("button", { name: "Open voting" }).click();
  await host.getByRole("button", { name: "Open voting" }).nth(1).click();
  await bea.getByRole("button", { name: "Rank" }).click();
  const before = await positions(bea);
  await bea.getByRole("button", { name: "Move down" }).first().click();
  await bea.waitForFunction((start) => {
    const titles = [...document.querySelectorAll(".rank__title")].map((node) => node.textContent);
    return titles[0] !== start;
  }, before[0]);
  const afterButton = await positions(bea);
  const handle = bea.getByLabel("Drag Beta");
  const box = await handle.boundingBox();
  if (!box) throw new Error("missing drag handle");
  await bea.mouse.move(box.x + 10, box.y + 20);
  await bea.mouse.down();
  await bea.mouse.move(box.x + 10, box.y + 160, { steps: 12 });
  await bea.mouse.up();
  await bea.waitForFunction((start) => [...document.querySelectorAll(".rank__title")].map((node) => node.textContent).join("|") !== start, afterButton.join("|"));
  await host.locator("input").first().fill("Late pitch");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await bea.getByText("NEW", { exact: true }).waitFor({ timeout: 2000 });
  console.log("button move, drag, and new badge");
} finally {
  await browser.close();
  worker.kill("SIGTERM");
  vite.kill("SIGTERM");
}
