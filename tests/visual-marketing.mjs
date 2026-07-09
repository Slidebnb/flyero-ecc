import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3000";
const outDir = join(process.cwd(), ".tmp", "visual-qa");

const targets = [
  { name: "home-desktop", path: "/", width: 1440, height: 1100 },
  { name: "home-tablet", path: "/", width: 768, height: 1100 },
  { name: "home-mobile", path: "/", width: 390, height: 1100 },
  { name: "verteilung-anfragen-desktop", path: "/verteilung-anfragen", width: 1440, height: 1100 },
  { name: "verteilung-anfragen-mobile", path: "/verteilung-anfragen", width: 390, height: 1100 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1,
  });

  await page.goto(new URL(target.path, baseUrl).toString(), { waitUntil: "networkidle" });

  const metrics = await page.evaluate(() => {
    const offenders = [...document.querySelectorAll("body *")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          className: typeof el.className === "string" ? el.className : "",
          text: (el.textContent || "").trim().slice(0, 80),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          display: style.display,
          position: style.position,
        };
      })
      .filter((item) => item.display !== "none" && item.width > 1 && (item.left < -1 || item.right > window.innerWidth + 1))
      .slice(0, 20);

    const bodyText = document.body.innerText;
    const brokenSnippets = [
      "Gastronomi e",
      "Gebie t",
      "hoch laden",
      "Kund e",
      "Beric ht",
      "Ã",
      "Â",
      "�",
    ].filter((snippet) => bodyText.includes(snippet));

    return {
      title: document.title,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      offenders,
      brokenSnippets,
      hasErrorOverlay: Boolean(document.querySelector("[data-nextjs-dialog-overlay], nextjs-portal")),
    };
  });

  const screenshot = join(outDir, `${target.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ ...target, screenshot, ...metrics });
  await page.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));

const failed = results.filter(
  (result) =>
    result.scrollWidth !== result.clientWidth ||
    result.offenders.length > 0 ||
    result.brokenSnippets.length > 0 ||
    result.hasErrorOverlay,
);

if (failed.length) {
  console.error("Visual marketing QA failed:");
  console.error(JSON.stringify(failed, null, 2));
  process.exit(1);
}
