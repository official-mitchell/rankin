// Host plus three players, Lobby through Closed (checklist 12.1).
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";

function start(command: string, args: string[], lines: string[]): ChildProcess {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const collect = (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);
    lines.push(text);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  return child;
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

async function join(page: Page, name: string): Promise<void> {
  await page.getByRole("textbox", { name: "Your name" }).fill(name);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.getByRole("textbox", { name: "Your name" }).waitFor({ state: "hidden" });
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync("shots/e2e", { recursive: true });
  await page.screenshot({ path: `shots/e2e/${name}.png`, fullPage: true });
}

async function score(page: Page, title: string, values: [number, number, number]): Promise<void> {
  const card = page.locator("[data-pitch]", { has: page.getByRole("heading", { name: title, exact: true }) });
  const pads = card.locator(".cat");
  for (let index = 0; index < values.length; index += 1) {
    await pads.nth(index).getByRole("button", { name: String(values[index]), exact: true }).click();
  }
}

const lines: string[] = [];
const worker = start("npx", ["wrangler", "dev", "--port", "8787"], lines);
const vite = start("npx", ["vite", "--config", "client/vite.config.ts", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], lines);
let browser: Browser | null = null;
try {
  await waitFor("http://127.0.0.1:8787/api/health");
  await waitFor("http://127.0.0.1:5173/");
  browser = await chromium.launch();
  const host = await browser.newPage();
  await host.goto("http://127.0.0.1:5173/");
  await host.getByRole("button", { name: "Become the Game Master" }).click();
  await host.getByRole("button", { name: "Create Session" }).click();
  await join(host, "Ada");
  const code = new URL(host.url()).pathname.split("/").pop() ?? "";

  const bea = await browser.newPage();
  await bea.goto(`http://127.0.0.1:5173/s/${code}`);
  await join(bea, "Bea");
  const cam = await browser.newPage();
  await cam.goto(`http://127.0.0.1:5173/s/${code}`);
  await join(cam, "Cam");
  const dee = await browser.newPage();
  await dee.goto(`http://127.0.0.1:5173/s/${code}`);
  await join(dee, "Dee");
  await host.getByRole("button", { name: "Players" }).click();
  await shot(host, "lobby");

  await host.getByRole("textbox", { name: "Title" }).fill("Alpha");
  await host.getByRole("combobox", { name: "Presenter" }).selectOption({ label: "Bea" });
  await host.getByRole("button", { name: "Add pitch" }).click();
  await host.getByRole("textbox", { name: "Title" }).fill("Beta");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await host.getByRole("textbox", { name: "Title" }).fill("Gamma");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await host.getByRole("button", { name: "Start pitching" }).click();
  await host.getByRole("button", { name: "Lock roster" }).click();
  await shot(host, "pitching");

  const eve = await browser.newPage();
  await eve.goto(`http://127.0.0.1:5173/s/${code}`);
  await join(eve, "Eve");
  await eve.getByRole("button", { name: "Players" }).click();
  await eve.getByText("view only").waitFor();

  await host.getByRole("button", { name: "Open voting" }).click();
  await host.getByRole("button", { name: "Open voting" }).nth(1).click();
  await shot(host, "voting");
  await bea.getByText("Your pitch — no scoring").waitFor();
  await host.getByRole("textbox", { name: "Title" }).fill("Delta");
  await host.getByRole("button", { name: "Add pitch" }).click();
  await cam.getByText("Delta").waitFor();

  await bea.getByRole("button", { name: "Notes" }).click();
  await score(bea, "Beta", [5, 5, 10]);
  await score(bea, "Gamma", [1, 1, 2]);
  await score(bea, "Delta", [3, 3, 6]);
  await bea.getByRole("button", { name: "Rank" }).click();
  await bea.getByRole("button", { name: "Place here" }).click();
  await bea.getByRole("button", { name: "Submit ballot" }).click();

  await cam.getByRole("button", { name: "Notes" }).click();
  await score(cam, "Alpha", [5, 5, 10]);
  await score(cam, "Beta", [4, 4, 8]);
  await score(cam, "Gamma", [3, 3, 6]);
  await score(cam, "Delta", [2, 2, 4]);
  await cam.getByRole("button", { name: "Rank" }).click();
  await cam.locator("li", { hasText: "Delta" }).getByRole("button", { name: "Place here" }).click();
  await cam.getByRole("button", { name: "Submit ballot" }).click();

  await dee.getByRole("button", { name: "Notes" }).click();
  await score(dee, "Alpha", [1, 1, 1]);

  await cam.close();
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:8787/api/s/${code}/ws`);
    const timer = setTimeout(() => reject(new Error("reclaim timed out")), 8000);
    let joined = false;
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "hello" }));
    });
    socket.addEventListener("message", (event) => {
      void (async () => {
      const text = typeof event.data === "string" ? event.data : await event.data.text();
      const body = JSON.parse(text) as { type?: string; code?: string; view?: { self?: { playerId?: string } } };
      if (!joined) {
        joined = true;
        socket.send(JSON.stringify({ type: "hello" }));
        socket.send(JSON.stringify({ type: "join", name: "Cam", clientSeq: 9001 }));
      }
      if (body.code === "name_taken") socket.send(JSON.stringify({ type: "reclaim", name: "Cam", clientSeq: 2 }));
      if (body.type === "view" && body.view?.self?.playerId) {
        clearTimeout(timer);
        socket.close();
        resolve();
      }
      })().catch(reject);
    });
  });

  await host.getByRole("button", { name: "Close voting" }).click();
  await host.getByRole("button", { name: /Close & void/ }).click();
  await host.getByText("Borda ranking").waitFor();
  await shot(host, "closed");

  const counted = await host.locator(".voter-names").first().innerText();
  const voided = await host.locator(".voter-names--void").innerText();
  if (voided.includes("Dee") === false) throw new Error(`Dee was not voided: ${voided}`);
  if (counted.includes("Dee")) throw new Error("voided voter is in the counted list");

  // Bea ranks Beta, Gamma, Delta. Cam ranks Alpha, Beta, Gamma, Delta. Dee does not submit.
  // Borda: Alpha 1, Beta (1 + 2/3) / 2, Gamma (1/2 + 1/3) / 2, Delta 0.
  const expected = ["Alpha", "Beta", "Gamma", "Delta"];
  const shown = await host.locator("[data-rank] .card-title").allTextContents();
  if (shown.join(",") !== expected.join(",")) throw new Error(`board ${shown.join(",")} expected ${expected.join(",")}`);

  console.log("e2e lobby through closed matched the fixture board");
} finally {
  await browser?.close();
  worker.kill("SIGTERM");
  vite.kill("SIGTERM");
}

const log = lines.join("");
writeFileSync("shots/e2e/server.log", log);
if (log.includes("write.failed") || log.includes('"level":"error"')) {
  throw new Error("server log contains write.failed or ERROR");
}
