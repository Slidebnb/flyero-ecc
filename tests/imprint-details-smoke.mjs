import { readFile } from "node:fs/promises";

const file = await readFile("src/app/impressum/page.tsx", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredText = [
  "Angaben gemäß § 5 DDG",
  "Flyero Gruppe - Ein Unternehmen der Huwa Gebäudereinigung & Hausmeisterdienste",
  "Inhaber: Familie Huwa",
  "Mittelweg 24",
  "56566 Neuwied",
  "Telefon: 02601 9131820",
  "hallo@flyero.org",
  "Steuernummer: 32/074/56310",
  "Redaktionell verantwortlich",
];

for (const value of requiredText) {
  assert(file.includes(value) || file.includes(value.replaceAll("&", "&amp;")), `Impressum enthaelt nicht: ${value}`);
}

for (const forbidden of ["Musterstraße", "FLYERO GmbH i.G.", "Beta-Hinweis", "56068 Koblenz", "0261 000000"]) {
  assert(!file.includes(forbidden), `Alte Impressumsangabe ist noch vorhanden: ${forbidden}`);
}

console.log("Impressum details smoke passed.");
