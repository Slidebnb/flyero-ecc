import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const routeFiles = [
  "src/app/api/admin/dispatch/recommend/[orderId]/route.ts",
  "src/app/api/admin/dispatch/auto-assign/[orderId]/route.ts",
];

for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  assert.match(source, /readBody\(request\)/, `${file} muss JSON- und HTML-Formularanfragen lesen.`);
  assert.match(source, /segmentId/, `${file} muss das Teilgebiet weiterreichen.`);
}

const dispatch = await readFile("src/lib/dispatch.ts", "utf8");
assert.match(dispatch, /Mehrgebietsauftr.*ausgew.*Teilgebiet/s, "Mehrgebietsauftraege muessen ein Teilgebiet erzwingen.");
assert.match(dispatch, /segment\?\.flyerQuantity/, "Dispatch-Kapazitaet muss die Flyerzahl des Teilgebiets nutzen.");

console.log("Module 27.1 dispatch contract checks passed.");
