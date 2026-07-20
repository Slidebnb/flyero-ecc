import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const wizard = await readFile("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(
  wizard,
  /getMapCapabilities\?: \(\) => \{[^}]*isDataDrivenStylingAvailable\?: boolean/s,
  "Der Kartenvertrag muss die Google-Fähigkeit für datenbasierte Grenzen abbilden.",
);
assert.match(
  wizard,
  /isDataDrivenStylingAvailable\s*!==\s*true/,
  "Boundary-Layer dürfen erst verwendet werden, wenn Google Data-driven Styling verfügbar meldet.",
);
assert.match(wizard, /mapRenderMode/, "Der Wizard muss zwischen Boundary-Map und Standardkarte unterscheiden.");
assert(
  wizard.indexOf("const mapCapabilities = mapRef.current.getMapCapabilities?.();")
    < wizard.indexOf("if (!mapRef.current?.getFeatureLayer)"),
  "Die Kartenfaehigkeit muss vor dem Zugriff auf Boundary-Layer geprueft werden.",
);
assert.match(wizard, /setMapRenderMode\("standard"\)/, "Bei fehlender Boundary-Fähigkeit muss auf eine Standardkarte gewechselt werden.");
assert.match(wizard, /mapRenderMode === "boundary"/, "Die Map-ID darf nur im Boundary-Modus verwendet werden.");
assert.match(
  wizard,
  /setBoundaryLayerStatus\("unavailable"\)[\s\S]*setAreaSelectionMode\("draw"\)/,
  "Bei nicht verfügbarer Boundary-Konfiguration muss der Zeichenweg aktiviert bleiben.",
);

console.log("Customer order map capability contract passed.");
