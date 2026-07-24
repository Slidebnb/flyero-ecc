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
  /__flyeroMapsLibrary/,
  "Der Kundenwizard muss die von importLibrary gelieferten Kartenkonstruktoren wiederverwenden.",
);

for (const file of files) {
  const source = await readFile(file, "utf8");
  assert.match(
    source,
    /maps\/api\/js\?[^`]*loading=async/,
    `${file} muss Google Maps mit loading=async laden.`,
  );
  assert.doesNotMatch(
    source,
    /new\s+(?:maps|window\.google\.maps)\.Map\s*\(/,
    `${file} darf keinen nicht initialisierten Google-Maps-Konstruktor direkt verwenden.`,
  );
}

console.log("Maps loader async smoke ok");
