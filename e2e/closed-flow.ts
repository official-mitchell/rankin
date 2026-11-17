// Closed session: score taps are rejected, and a host rename keeps the Borda order (checklist 10.2).
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
  await page.getByRole("textbox", { name: "Your name" }).waitFor({ state: "hidden" });
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

  const code = new URL(page.url()).pathname.split("/").pop() ?? "";
  const beaContext = await browser.newContext();
  const bea = await beaContext.newPage();
  await bea.goto(`http://127.0.0.1:5173/s/${code}`);
  await join(bea, "Bea");

  await page.getByRole("button", { name: "Players" }).click();
  await page.getByRole("textbox").first().fill("Cat Slack");
  await page.getByRole("button", { name: "Add pitch" }).click();
  await page.getByRole("button", { name: "Start pitching" }).click();
  await page.getByRole("button", { name: "Lock roster" }).click();
  await page.getByRole("button", { name: "Open voting" }).click();
  await page.getByRole("button", { name: "Open voting" }).nth(1).click();
  await page.getByRole("button", { name: "Close voting" }).click();
  await page.getByRole("button", { name: /Close & void/ }).click();
  await page.getByText("Borda ranking").waitFor();

  const before = await bea.locator("[data-rank]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-rank")));
  const pitchId = await bea.locator("[data-pitch]").first().getAttribute("data-pitch");
  const disabled = await bea.locator("button.score:disabled").count();
  if (!pitchId || disabled === 0) throw new Error("score controls stayed enabled after close");
  const rejected = await bea.evaluate(
    ({ sessionCode, id }) =>
      new Promise<string>((resolve) => {
        const playerId = localStorage.getItem(`we-rankin:player:${sessionCode}`);
        const socket = new WebSocket(`${location.origin.replace(/^http/, "ws")}/api/s/${sessionCode}/ws`);
        socket.addEventListener("message", (event) => {
          const body = JSON.parse(String(event.data)) as { type?: string; code?: string };
          if (body.type === "error") resolve(body.code ?? "");
        });
        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ type: "hello", playerId }));
          socket.send(JSON.stringify({ type: "setScore", pitchId: id, category: "funniness", value: 4, clientSeq: 80 }));
        });
      }),
    { sessionCode: code, id: pitchId },
  );
  if (rejected !== "bad_transition") throw new Error(`expected bad_transition, got ${rejected}`);

  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "New title" }).fill("Cat Slack Renamed");
  await page.getByRole("textbox", { name: "Presenter name" }).fill("Ada");
  await page.getByRole("button", { name: "Save title" }).click();
  await bea.getByRole("heading", { name: "Cat Slack Renamed" }).first().waitFor();
  const after = await bea.locator("[data-rank]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-rank")));
  if (before.join("|") !== after.join("|")) throw new Error("results order changed after rename");
  console.log("closed score rejected and rename kept the order");
} finally {
  await browser.close();
  worker.kill("SIGTERM");
  vite.kill("SIGTERM");
}
