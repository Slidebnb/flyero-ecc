import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pdfPath = path.join(root, "public", "downloads", "flyero-anfrageformular.pdf");
const publicRequestPage = fs.readFileSync(path.join(root, "src", "app", "verteilung-anfragen", "page.tsx"), "utf8");
const wizard = fs.readFileSync(path.join(root, "src", "app", "customer", "orders", "new", "SmartOrderWizard.tsx"), "utf8");
const imprint = fs.readFileSync(path.join(root, "src", "app", "impressum", "page.tsx"), "utf8");
const marketingShell = fs.readFileSync(path.join(root, "src", "app", "components", "marketing", "index.tsx"), "utf8");
const legacyHtml = fs.readFileSync(path.join(root, "public", "downloads", "flyero-anfrageformular.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(pdfPath), "Die aktuelle FLYERO-Anfrageformular-PDF fehlt im öffentlichen Download-Verzeichnis.");
const pdf = fs.readFileSync(pdfPath);
assert(pdf.subarray(0, 5).toString("ascii") === "%PDF-", "Der Anfrageformular-Download ist keine gültige PDF-Datei.");
assert(pdf.length > 10_000, "Die Anfrageformular-PDF ist unerwartet klein oder unvollständig.");

for (const [name, content] of [
  ["öffentliche Anfrage-Seite", publicRequestPage],
  ["Kunden-Bestellflow", wizard],
  ["Impressum", imprint],
  ["öffentlicher Footer", marketingShell],
  ["kompatible HTML-Vorlage", legacyHtml],
]) {
  assert(content.includes("hallo@flyero.org"), `${name} verwendet nicht hallo@flyero.org.`);
}

assert(publicRequestPage.includes("/downloads/flyero-anfrageformular.pdf"), "Die öffentliche Anfrage-Seite verlinkt nicht auf die aktuelle PDF.");
assert(wizard.includes('const inquiryFormHref = "/downloads/flyero-anfrageformular.pdf";'), "Der Kunden-Bestellflow verlinkt nicht auf die aktuelle PDF.");
assert(wizard.includes("mailto:hallo@flyero.org"), "Der Kunden-Bestellflow verwendet nicht die öffentliche Kontaktadresse.");
assert(!publicRequestPage.includes("anfrage@flyero.de"), "Die alte Anfrageadresse ist noch auf der öffentlichen Anfrage-Seite vorhanden.");
assert(!wizard.includes("anfrage@flyero.de"), "Die alte Anfrageadresse ist noch im Kunden-Bestellflow vorhanden.");
assert(!imprint.includes("hello@flyero.de"), "Die alte Impressum-Adresse ist noch vorhanden.");

console.log("Inquiry-Formular- und Kontakt-Smoke-Test erfolgreich.");
