import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const publicSources = [
  "src/app/page.tsx",
  "src/app/verteilung-anfragen/page.tsx",
  "src/app/so-funktionierts/page.tsx",
  "src/app/fuer-unternehmen/page.tsx",
  "src/app/fuer-verteiler/page.tsx",
  "src/app/kontakt/page.tsx",
  "src/app/preise/page.tsx",
  "src/app/flyer-verteilen-lassen/page.tsx",
  "src/app/components/marketing/index.tsx",
  "src/app/components/marketing/IndustryLandingPage.tsx",
  "src/app/components/marketing/FlyerDistributionPillarPage.tsx",
  "src/app/branchen/industryData.ts",
  "src/app/anlaesse/occasionData.ts",
].map((relativePath) => [relativePath, read(relativePath)]);

const forbiddenPublicCopy = [
  "Dispatch",
  "Admin-Prüfung",
  "interne Prüfung",
  "intern geprüft",
  "eingesetzten Trackingsystems",
  "Statusschritte",
  "Nachweisprozess",
  "gleichen System",
  "Admin-Team",
  "Admin-Prüfung",
  "per QR-Code",
  "Trackingsystem",
];

for (const [relativePath, content] of publicSources) {
  for (const phrase of forbiddenPublicCopy) {
    assert(!content.includes(phrase), `${relativePath} enthält weiterhin technische öffentliche Sprache: ${phrase}`);
  }
}

const marketing = read("src/app/components/marketing/index.tsx");
const inquiryPage = read("src/app/verteilung-anfragen/page.tsx");
const pillarPage = read("src/app/components/marketing/FlyerDistributionPillarPage.tsx");

assert(marketing.includes("hallo@flyero.org"), "Die öffentliche Kontaktadresse fehlt im Footer.");
assert(!marketing.includes("mailto:hallo@flyero.org"), "Die öffentliche Footer-Adresse darf kein Mailprogramm erzwingen.");
assert(marketing.includes("/downloads/flyero-anfrageformular.pdf"), "Der Footer muss das Anfrageformular verlinken.");
assert(inquiryPage.includes("hallo@flyero.org"), "Die Anfrage-Seite muss die Kontaktadresse sichtbar zeigen.");
assert(!inquiryPage.includes("mailto:hallo@flyero.org"), "Die Anfrage-Seite darf kein Mailprogramm erzwingen.");
assert(pillarPage.includes("eigene, bereits gedruckte Flyer"), "Die öffentliche Leistungsseite muss den eigenen Flyer-Workflow erklären.");
assert(pillarPage.includes("zugewiesene Lager"), "Die öffentliche Leistungsseite muss die Lageranlieferung verständlich erklären.");

const seo = read("src/app/seo.ts");
for (const route of [
  "/",
  "/verteilung-anfragen",
  "/verteilung-planen",
  "/fuer-unternehmen",
  "/fuer-verteiler",
  "/so-funktionierts",
  "/preise",
  "/kontakt",
  "/flyer-verteilen-lassen",
  "/impressum",
  "/datenschutz",
  "/agb",
]) {
  assert(seo.includes(`path: \"${route}\"`), `Öffentliche SEO-Route fehlt: ${route}`);
}

console.log("Public humanization smoke checks passed.");
