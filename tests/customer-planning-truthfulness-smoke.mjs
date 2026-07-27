import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const map = readFileSync("src/app/components/DistributionAreaPreviewMap.tsx", "utf8");
const dashboard = readFileSync("src/app/customer/dashboard/page.tsx", "utf8");
const detail = readFileSync("src/app/customer/orders/[id]/page.tsx", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const material = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");

assert.match(map, /JSON\.parse/, "Die Gebietsansicht muss gespeicherte JSON-GeoJSON-Werte verarbeiten.");
assert.match(map, /parsed\?\.type === "Feature"/, "Eine einzelne gespeicherte GeoJSON-Feature muss kartenfaehig sein.");
assert.match(map, /library\?\.Map.*mapsApi\.Map/, "Der Kartenaufbau muss die geladene Maps-Library priorisieren.");
assert.match(dashboard, /targetAreaGeoJson[\s\S]*distributionArea\?\.geometryGeoJson/, "Das Dashboard muss alle gespeicherten Gebietsquellen verwenden.");
assert.match(detail, /Haushalte[\s\S]*Wird vor der Verteilung geprueft|Haushalte[\s\S]*Wird vor der Verteilung geprüft/, "Unbelegte Haushalte duerfen nicht als echte Zahl erscheinen.");
assert.match(detail, /OFFICIAL_IMPORT.*LICENSED_IMPORT/, "Haushalte duerfen im Kundenportal nur aus amtlichen oder lizenzierten Quellen stammen.");
assert.match(detail, /estimate\.source.*estimate\.sourceYear/, "Eine Kunden-Haushaltszahl braucht Quelle und Bezugsjahr.");
assert.doesNotMatch(detail, /<span>Strecke<\/span>/, "Eine berechnete Laufstrecke darf nicht als Kundennachweis erscheinen.");
assert.match(detail, /title="Flyer an Lager senden"/, "Die Versandadresse muss im Auftrag sichtbar sein.");
assert.doesNotMatch(wizard, /estimateHouseholdsFromArea\(planningAreaSqm\)/, "Der Wizard darf keine lokale Haushaltsformel als Kundenwert verwenden.");
assert.doesNotMatch(wizard, /estimateWalkingDistanceMeters\(planningAreaSqm/, "Der Wizard darf keine lokale Streckenformel als Kundenwert verwenden.");
assert.match(wizard, /recommendedFlyerQuantity[\s\S]*null/, "Eine nicht belegte Empfehlung muss leer statt 100 Flyer sein.");
assert.doesNotMatch(wizard, /Gebietsdaten gesch/, "Die unklare Schaetzkennzeichnung darf nicht mehr im Kundenwizard erscheinen.");
assert.match(wizard, /Wo soll verteilt werden\?|Private Haushalte im ausgew.*Gebiet/, "Der Verteil-Schritt muss kundenfreundlich formuliert sein.");
assert.match(material, /Noch nicht verf/, "Der Materials-Schritt braucht einen ehrlichen leeren Empfehlungszustand.");
assert.ok(existsSync("src/app/customer/orders/new/loading.tsx"), "Der neue Verteilprozess braucht einen sichtbaren Ladezustand.");

console.log("Customer planning truthfulness smoke checks passed.");
