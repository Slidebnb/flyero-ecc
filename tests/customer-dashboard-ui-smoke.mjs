import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile("src/app/customer/dashboard/page.tsx", "utf8");
const mapPreview = await readFile("src/app/components/DistributionAreaPreviewMap.tsx", "utf8");

assert.match(dashboard, /<span>Letzte Buchung<\/span>/, "Das Dashboard muss die letzte Buchung als Hauptbereich benennen.");
assert.doesNotMatch(dashboard, /<span>Direkt erledigen<\/span>/, "Der technische Direkt-erledigen-Block darf nicht mehr gerendert werden.");
assert.doesNotMatch(dashboard, /1 Klick|2 Klicks/, "Klickzaehler gehoeren nicht in das Kundenportal.");
assert.doesNotMatch(dashboard, /customerOrderName\(lastOrder\.orderNumber\)/, "Das Dashboard darf interne Auftragsnummern nicht als Kundentext verwenden.");
assert.match(dashboard, /report\.order\.orderNumber === order\.orderNumber/, "Nachweise muessen der letzten Buchung zugeordnet werden.");
assert.match(dashboard, /DistributionAreaPreviewMap geoJson=\{geoJson\}/, "Das Dashboard muss die bestehende Gebietsansicht mit den aktuellen Auftragsdaten verwenden.");

assert.match(mapPreview, /MultiPolygon/, "Die Nachweisvorschau muss echte Mehrflaechen-Geometrien darstellen koennen.");
assert.match(mapPreview, /Gebietsansicht wird geladen/, "Waehrend des Kartenaufbaus darf kein leerer Kartenrahmen erscheinen.");
assert.match(mapPreview, /Gebietsansicht derzeit nicht/, "Bei einem Kartenfehler muss eine verstaendliche Ansicht erscheinen.");

console.log("Customer dashboard UI smoke checks passed.");
