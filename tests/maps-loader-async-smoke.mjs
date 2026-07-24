import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "src/app/customer/orders/new/SmartOrderWizard.tsx",
  "src/app/components/RouteMap.tsx",
  "src/app/components/DistributionAreaEditor.tsx",
  "src/app/components/DistributionAreaPreviewMap.tsx",
];

const orderWizard = await readFile("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
assert.match(
  orderWizard,
  /(?:google\.maps|maps)\.importLibrary\(["']maps["']\)/,
  "Der Kundenwizard muss die Maps-Bibliothek nach loading=async explizit importieren.",
);
assert.match(
  orderWizard,
  /typeof window\.google\?\.maps\?\.Map\s*===\s*["']function["']/,
  "Der Kundenwizard darf die Map nur verwenden, wenn der Konstruktor wirklich bereit ist.",
);

for (const file of files) {
  const source = await readFile(file, "utf8");
  assert.match(
    source,
    /maps\/api\/js\?[^`]*loading=async/,
    `${file} muss Google Maps mit loading=async laden.`,
  );
}

console.log("Maps loader async smoke ok");
