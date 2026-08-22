import { chromium } from "/Users/williamvivian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../public/logos/catalog/manifest.json", import.meta.url), "utf8"));
const reviewIndex = JSON.parse(await readFile(new URL("../public/logos/catalog/review.json", import.meta.url), "utf8"));

const screenshot = "/tmp/hudi-orb-catalog-ui.png";
const appUrl = process.env.CATALOG_TEST_URL ?? "http://127.0.0.1:3017";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto(appUrl, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "catalog", exact: true }).click();
await page.getByRole("heading", { name: "20,524 orbs" }).waitFor({ timeout: 30_000 });
await page.locator(".catalog-card").first().waitFor({ timeout: 30_000 });

if (await page.locator(".catalog-card").count() !== 180) throw new Error("Catalog did not render its first 180 entries");
const status = await page.locator(".catalog-status").innerText();
if (!status.toUpperCase().includes("20,524 MATCHES")) throw new Error(`Unexpected catalog count: ${status}`);
const expectedSourceReview = Number(manifest.summary.sourceReview ?? 0).toLocaleString("en-US");
if (!status.toUpperCase().includes(`${expectedSourceReview} NEED SOURCE REVIEW`)) {
  throw new Error(`Unexpected source-review count: ${status}`);
}

const issueEntries = reviewIndex.entries;
const issuesButton = page.getByRole("button", { name: "likely issues", exact: true });
await issuesButton.click();
if (await page.locator(".catalog-card").count() !== Math.min(180, reviewIndex.summary.total)) {
  throw new Error("Likely-issues filter returned the wrong number of entries");
}
const issuesStatus = await page.locator(".catalog-status").innerText();
if (!issuesStatus.toUpperCase().includes(`${reviewIndex.summary.total.toLocaleString("en-US")} LIKELY ISSUES`)) {
  throw new Error(`Unexpected likely-issues status: ${issuesStatus}`);
}
if (await page.locator(".catalog-missing").count()) {
  throw new Error("Likely-issues filter included a default fallback orb");
}
const filteredTitles = await page.locator(".catalog-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("title")));
await page.getByRole("button", { name: "random 180", exact: true }).click();
const randomIssuesStatus = await page.locator(".catalog-status").innerText();
if (!randomIssuesStatus.toUpperCase().includes(`RANDOM 180 OF ${reviewIndex.summary.total.toLocaleString("en-US")} LIKELY ISSUES`)) {
  throw new Error(`Random action did not respect the likely-issues filter: ${randomIssuesStatus}`);
}
const randomFilteredTitles = await page.locator(".catalog-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("title")));
if (randomFilteredTitles.every((title, index) => title === filteredTitles[index])) {
  throw new Error("Random action did not refresh the likely-issues sample");
}
await issuesButton.click();

const initialTitles = await page.locator(".catalog-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("title")));
await page.getByRole("button", { name: "random 180", exact: true }).click();
if (await page.locator(".catalog-card").count() !== 180) throw new Error("Random catalog sample did not render 180 entries");
const randomStatus = await page.locator(".catalog-status").innerText();
if (!randomStatus.toUpperCase().includes("SHOWING A RANDOM 180")) throw new Error(`Unexpected random catalog status: ${randomStatus}`);
const randomTitles = await page.locator(".catalog-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("title")));
if (randomTitles.every((title, index) => title === initialTitles[index])) throw new Error("Random catalog sample did not change the visible entries");

const search = page.getByPlaceholder("ticker, company, exchange");
await search.fill("NVDA");
await page.waitForTimeout(150);
if (await page.locator(".catalog-card").count() !== 1) throw new Error("NVDA search was not unique");
if (await page.locator(".catalog-card strong").innerText() !== "NVDA") throw new Error("NVDA search returned the wrong ticker");

await search.fill("005930");
await page.waitForTimeout(150);
const samsung = page.locator(".catalog-card");
if (await samsung.count() !== 1 || !(await samsung.innerText()).toUpperCase().includes("SAMSUNG")) {
  throw new Error("Samsung catalog search failed");
}
if (await samsung.locator("img").getAttribute("src") !== "/logos/samsung.png") {
  throw new Error("Samsung did not reuse the curated MVP asset");
}

const unresolvedEntry = manifest.entries.find((entry) => {
  if (entry.logo) return false;
  const query = entry.company.toLocaleLowerCase();
  return manifest.entries.filter((candidate) => [
    candidate.symbol,
    candidate.company,
    candidate.exchange,
    candidate.sector,
  ].some((value) => value.toLocaleLowerCase().includes(query))).length === 1;
});
if (!unresolvedEntry) throw new Error("Manifest has no unique unresolved entry for source-review testing");
await search.fill(unresolvedEntry.company);
await page.waitForTimeout(150);
const unresolved = page.locator(".catalog-card");
const unresolvedCount = await unresolved.count();
const unresolvedLinkCount = await unresolved.locator(".catalog-missing").count();
if (unresolvedCount !== 1 || unresolvedLinkCount !== 1) {
  throw new Error(`Unresolved catalog entry is not visibly marked (${unresolvedCount} cards, ${unresolvedLinkCount} review links)`);
}
const reviewSearchUrl = await unresolved.locator(".catalog-missing").getAttribute("href");
if (!reviewSearchUrl?.startsWith("https://www.google.com/search?tbm=isch&q=")) {
  throw new Error("Unresolved catalog entry does not link to an image search");
}

await search.fill("");
await page.waitForTimeout(150);
await page.getByRole("button", { name: "load 180 more" }).click();
if (await page.locator(".catalog-card").count() !== 360) throw new Error("Catalog pagination failed");
await page.getByRole("button", { name: "random 180", exact: true }).click();
await page.getByText("Showing a random 180", { exact: false }).waitFor();
await issuesButton.click();
await page.getByText(`${issueEntries.length.toLocaleString("en-US")} likely issues`, { exact: false }).waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: screenshot, fullPage: false });

if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);
await browser.close();
console.log(`Catalog UI passed; screenshot: ${screenshot}`);
