import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const customerFacingFiles = [
  "src/app/components/RouteMap.tsx",
  "src/app/components/DistributionAreaPreviewMap.tsx",
  "src/app/components/DistributionAreaEditor.tsx",
  "src/app/customer/dashboard/page.tsx",
];
const forbidden = [
  "Fallback-Modus",
  "Demo-Fotos",
  "Beispielhafter Ablauf",
  "keine echte Kampagne",
];

for (const path of customerFacingFiles) {
  const source = await readFile(path, "utf8");
  for (const term of forbidden) {
    assert(!source.includes(term), `${path} darf den sichtbaren Begriff nicht enthalten: ${term}`);
  }
}

console.log("Customer copy honesty smoke checks passed.");