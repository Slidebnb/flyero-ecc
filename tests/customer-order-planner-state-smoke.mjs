import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(wizard.includes("useState(MINIMUM_FLYER_QUANTITY)"), "Jeder neue Auftrag muss mit der kleinsten Flyerzahl starten.");
assert(wizard.includes("setFlyerQuantity(MINIMUM_FLYER_QUANTITY)"), "Alte automatische Flyerempfehlungen duerfen nicht als Auftragsmenge uebernommen werden.");
assert(wizard.includes("const MINIMUM_FLYER_QUANTITY = 500"), "Die Mindestmenge muss zentral im Wizard benannt sein.");
assert(wizard.includes("setIntelligence(null);\n    setIntelligenceStatus(\"updating\");"), "Alte Gebietsberechnungen muessen bei neuer Eingabe sofort verworfen werden.");
assert(wizard.includes("coverageAreaSqm: String(coverageAreaSqm)"), "Die aktuelle Flaeche muss Teil jeder Live-Berechnung sein.");
assert(wizard.includes("segments: JSON.stringify(areaSegmentsPayload"), "Aenderungen an Teilgebieten muessen die Live-Berechnung aktualisieren.");
assert(wizard.includes('addListener(path, "set_at", syncPath)'), "Polygon-Veraenderungen muessen live aus Google Maps gelesen werden.");
assert(wizard.includes('addListener(target, "drag", syncPath)'), "Polygon-Dragging muss die Live-Berechnung aktualisieren.");
assert(wizard.includes("clearPolygonListeners();"), "Alte Polygon-Listener muessen vor einer Neuregistrierung entfernt werden.");
assert(!wizard.includes("mapMode, mapsBoundaryMapId, mapsReady, polygon, postalCode"), "Der Map-Effect darf durch jede Polygon-State-Aenderung seine Listener veralten lassen.");
assert(wizard.includes("selectedWarehouse?.name"), "Das ausgewaehlte Empfangslager muss in der Gebietsuebersicht sichtbar sein.");
assert(wizard.includes("Deine Flyer sind bereits gedruckt"), "Der Abschluss muss den Kundenflyer-Prozess verstaendlich erklaeren.");
assert(wizard.includes("Wir prüfen Gebiet, Zustellbarkeit und deine Flyer"), "Der Abschluss muss den Online-Prozess ohne Druckservice erklaeren.");

console.log("Customer order planner state smoke checks passed.");
