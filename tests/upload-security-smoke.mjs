import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [storage, documents, tours, module22] = await Promise.all([
  readFile("src/lib/documentStorage.ts", "utf8"),
  readFile("src/lib/documents.ts", "utf8"),
  readFile("src/lib/tours.ts", "utf8"),
  readFile("tests/module22-smoke.mjs", "utf8"),
]);

assert.doesNotMatch(documents, /FLYERO placeholder upload/, "Dokumente dürfen keinen Ersatzinhalt erzeugen.");
assert.match(storage, /magic|signature|%PDF|89504e47/i, "Dokumente brauchen Magic-Byte-Prüfung.");
assert.match(storage, /application\/pdf/, "Dokument-MIME muss aus dem Dateityp ableitbar sein.");
assert.match(tours, /89504e47|ffd8ff|RIFF/i, "Tour-Fotos brauchen Bildsignatur-Prüfung.");
assert.doesNotMatch(tours, /image\/svg\+xml/, "SVG darf nicht als Tour-Foto akzeptiert werden.");
assert.match(module22, /Buffer\.from\(.*base64|contentEncoding.*base64/i, "JSON-Smoke muss echte Base64-Dateiinhalte verwenden.");

console.log("Upload-Security smoke ok");
