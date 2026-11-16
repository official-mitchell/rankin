// Playwright offline → online check for checklist 5.3.6. Run with the dev server on port 5173.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://127.0.0.1:5173/__fixtures/queue-lab", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Score one" }).click();
  await page.waitForFunction(() => document.querySelector("[data-sent]")?.textContent === "1");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Score two" }).click();
  await page.waitForFunction(() => document.querySelector("[data-conn]")?.getAttribute("data-conn")?.includes("pending"));
  const during = await page.locator("[data-sent]").textContent();
  if (during !== "1") throw new Error(`offline tap was sent early: ${during}`);
  await page.context().setOffline(false);
  await page.waitForFunction(() => document.querySelector("[data-sent]")?.textContent === "1,2");
  if (errors.length > 0) throw new Error(errors.join("\n"));
  console.log("offline queue kept both taps in order");
} finally {
  await browser.close();
}
