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
  /mapsBoundaryConfigured && mapRenderMode === "boundary"[\s\S]{0,500}mapOptions\.renderingType\s*=\s*"VECTOR"/,
  "Die Boundary-Karte muss den Vektor-Renderer explizit anfordern, damit Google Data-driven Styling nicht auf Raster zurueckfaellt.",
);
assert.match(
  wizard,
  /const mapCapabilities = activeMap\.getMapCapabilities\?\.\(\);[\s\S]{0,180}if \(!mapCapabilities\) \{\s*scheduleInstallRetry\(\);\s*return;\s*\}/,
  "Die Boundary-Faehigkeit darf waehrend des Google-Kartenstarts nicht als endgueltig unavailable behandelt werden.",
);
assert.match(
  wizard,
  /installBoundaryLayers\(\);[\s\S]{0,120}if \(!mapRef\.current\) return;/,
  "Nach einem sauberen Wechsel in den Zeichenmodus darf kein Karten-Listener auf einer entfernten Map registriert werden.",
);
assert.match(
  wizard,
  /setBoundaryLayerStatus\("unavailable"\)[\s\S]*setAreaSelectionMode\("draw"\)/,
  "Bei nicht verfügbarer Boundary-Konfiguration muss der Zeichenweg aktiviert bleiben.",
);

console.log("Customer order map capability contract passed.");
