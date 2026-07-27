import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const intelligenceHook = readFileSync("src/app/customer/orders/new/hooks/useOrderIntelligence.ts", "utf8");
const finishStep = readFileSync("src/app/customer/orders/new/OrderFinishStep.tsx", "utf8");
const constants = readFileSync("src/lib/constants.ts", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(wizard.includes("useState(MINIMUM_FLYER_QUANTITY)"), "Jeder neue Auftrag muss mit der kleinsten Flyerzahl starten.");
assert(wizard.includes('useState(initialLocationProp?.query ?? "")'), "Ein öffentlicher Planner muss die validierte URL-Suche sofort anzeigen.");
assert(wizard.includes("setFlyerQuantity(MINIMUM_FLYER_QUANTITY)"), "Alte automatische Flyerempfehlungen duerfen nicht als Auftragsmenge uebernommen werden.");
assert(constants.includes("export const MINIMUM_FLYER_QUANTITY = 100"), "Die Mindestmenge muss zentral im Projekt benannt sein.");
assert(wizard.includes('from "@/lib/constants"'), "Der Kundenwizard muss dieselbe zentrale Mindestmenge verwenden.");
assert(/setIntelligence\(null\);\r?\n\s*setIntelligenceStatus\("updating"\);/.test(intelligenceHook), "Alte Gebietsberechnungen muessen bei neuer Eingabe sofort verworfen werden.");
assert(wizard.includes("coverageAreaSqm: String(coverageAreaSqm)"), "Die aktuelle Flaeche muss Teil jeder Live-Berechnung sein.");
assert(wizard.includes("segments: JSON.stringify(areaSegmentsPayload"), "Aenderungen an Teilgebieten muessen die Live-Berechnung aktualisieren.");
assert(wizard.includes('maps.event.addListener(overlay, "click", () => {'), "Importierte Gebietsgrenzen muessen direkt auf der Karte anklickbar sein.");
assert(wizard.includes("selectOfficialBoundary(area);"), "Ein angeklicktes Gebiet muss in den ausgewählten Segment-State übernommen werden.");
assert(wizard.includes("editable: false"), "Importierte Gebietsgrenzen dürfen nicht versehentlich in den manuellen Zeichenmodus wechseln.");
assert(!wizard.includes("mapMode, mapsBoundaryMapId, mapsReady, polygon, postalCode"), "Der Map-Effect darf durch jede Polygon-State-Aenderung seine Listener veralten lassen.");
assert(wizard.includes("warehouseSuggestionLabel"), "Das ausgewaehlte Empfangslager muss in der Gebietsuebersicht sichtbar sein.");
assert(wizard.includes("<dt>Empfangslager</dt>"), "Das festgelegte Empfangslager muss kundenfreundlich benannt sein.");
assert(wizard.includes("Deine Flyer sind bereits gedruckt"), "Der Abschluss muss den Kundenflyer-Prozess verstaendlich erklaeren.");
assert(finishStep.includes("Wir prüfen Gebiet, Zustellbarkeit und deine Flyer"), "Der Abschluss muss den Online-Prozess ohne Druckservice erklaeren.");

console.log("Customer order planner state smoke checks passed.");
