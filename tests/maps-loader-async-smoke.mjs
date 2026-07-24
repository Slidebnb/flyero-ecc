import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "src/app/customer/orders/new/SmartOrderWizard.tsx",
  "src/app/components/RouteMap.tsx",
  "src/app/components/DistributionAreaEditor.tsx",
  "src/app/components/DistributionAreaPreviewMap.tsx",
];

for (const file of files) {
  const source = await readFile(file, "utf8");
  assert.match(
    source,
    /maps\/api\/js\?[^`]*loading=async/,
    `${file} muss Google Maps mit loading=async laden.`,
  );
}

console.log("Maps loader async smoke ok");
