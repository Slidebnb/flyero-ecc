import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile("src/app/customer/dashboard/page.tsx", "utf8");
const orderDetail = await readFile("src/app/customer/orders/[id]/page.tsx", "utf8");
const mapPreview = await readFile("src/app/components/DistributionAreaPreviewMap.tsx", "utf8");

assert.match(dashboard, /export const dynamic = "force-dynamic"/, "Das Dashboard muss den aktuellen Order-Snapshot bei jedem Portalaufruf lesen.");
assert.match(orderDetail, /export const dynamic = "force-dynamic"/, "Die Kampagnenseite muss nach dem Stripe-Redirect den aktuellen Gebietssnapshot lesen.");
assert.match(mapPreview, /retry|setTimeout/, "Die Gebietsansicht muss einen fehlgeschlagenen ersten Kartenaufbau erneut versuchen.");
assert.match(mapPreview, /__flyeroMapsLoading|existing.*load|readyState/, "Der Kartenloader muss bereits vorhandene oder noch ladende Google-Skripte erkennen.");
assert.match(dashboard, /prisma\.document\.findMany/, "Das Dashboard muss mehrere freigegebene Nachweise aus dem bestehenden Dokumentbestand lesen.");
assert.match(dashboard, /currentEvidenceDocuments = latestEvidenceDocuments\.filter/, "Die Nachweise muessen auf die zuletzt gebuchte Kampagne begrenzt werden.");
assert.match(dashboard, /documentType === "REPORT"/, "Ein freigegebener PDF-Nachweis muss im Dashboard bevorzugt werden.");
assert.match(dashboard, /documentType === "IMAGE"/, "Freigegebene Fotos muessen in der Nachweisvorschau mitgezaehlt werden.");
assert.doesNotMatch(dashboard, /Gebietsansicht derzeit nicht verfügbar/, "Das Dashboard darf den Kartenfehlertext nicht selbst als Datenstatus behandeln.");

console.log("Customer dashboard area first-load smoke checks passed.");
