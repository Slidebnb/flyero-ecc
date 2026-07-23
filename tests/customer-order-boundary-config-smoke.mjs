import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
const compose = fs.readFileSync("docker-compose.production.yml", "utf8");
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const envExample = fs.readFileSync(".env.production.example", "utf8");
const wizard = fs.readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(dockerfile, /ARG NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED=/, "Docker muss die Boundary-Aktivierung in den Client-Build geben.");
assert.match(dockerfile, /ENV NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED=\$NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED/, "Docker muss die Boundary-Aktivierung beim Build verfügbar machen.");
assert.match(compose, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:\s*\$\{NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:-false\}/, "Compose muss die Boundary-Aktivierung als Build-Argument übergeben.");
assert.match(nextConfig, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:/, "Next muss die Boundary-Aktivierung im Client-Build exponieren.");
assert.match(envExample, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED="true"/, "Das Produktions-Template muss die erforderliche Boundary-Aktivierung dokumentieren.");
assert.match(wizard, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED\s*===\s*"true"/, "Der Wizard darf Boundary-Layer nur bei expliziter Aktivierung verwenden.");
assert.match(wizard, /const boundarySelectionEnabled = boundaryLayerStatus === "available";/, "Google-Boundaries dÃ¼rfen nicht von einer bereits gespeicherten FLYERO-FlÃ¤che abhÃ¤ngen.");
assert.match(wizard, /setAreaSelectionMode\("boundary"\);\s*setMapNotice\("W.{0,16}eine markierte Gebietsfl.{0,16}che auf der Karte\./, "Der Boundary-Button muss auch ohne gespeicherte Geometrie den Auswahlmodus aktivieren.");
assert.match(wizard, /setSelectedBoundaryPlaceIds\(\[placeId\]\);/, "Eine angeklickte Google-FlÃ¤che muss sichtbar als ausgewÃ¤hlt markiert werden.");
assert.match(wizard, /boundaryLayerStyle\(selectedBoundaryPlaceIdsRef\.current, false, hasActiveCommittedArea\)/, "Nicht gespeicherte Google-FlÃ¤chen dÃ¼rfen nach dem Klick nicht unsichtbar werden.");
assert.doesNotMatch(wizard, /if \(areaSelectionModeRef\.current === "draw"\) return;/, "Boundary-Klicklistener dÃ¼rfen nicht dauerhaft am Zeichenmodus scheitern.");

console.log("Customer order boundary configuration checks passed.");
