import { readFileSync } from "node:fs";

const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");
const css = readFileSync("src/app/styles/marketing.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const processRowSmallRule = css.match(/\.mkProcessPreviewRow small\s*\{[\s\S]*?\}/)?.[0] ?? "";
const proofStatusSmallRule = css.match(/\.mkProofStatusTimeline \.mkProofStatusCopy small\s*\{[\s\S]*?\}/)?.[0] ?? "";
const oldOverviewLabel = `Auftrags${String.fromCharCode(252)}bersicht`;

assert(!marketing.includes(oldOverviewLabel), "Der oeffentliche Nachweis-Hero darf nicht wie eine technische Auftragsuebersicht wirken.");
assert(!marketing.includes("Illustrative Darstellung von Verteilung und Beleg"), "Die Bildunterschrift darf nicht wie ein technischer Mockup-Hinweis wirken.");
assert(marketing.includes("Vom Gebiet bis zum Bericht"), "Der Abschnitt braucht eine klare, kundenverstaendliche Ablaufueberschrift.");
assert(marketing.includes("So bleibt deine Verteilung nachvollziehbar"), "Das Motiv muss ehrlich eingeordnet werden, ohne technisch zu wirken.");
assert(!/text-overflow:\s*ellipsis/.test(processRowSmallRule), "Prozess-Texte duerfen nicht gekuerzt werden.");
assert(!/white-space:\s*nowrap/.test(processRowSmallRule), "Prozess-Texte muessen umbrechen duerfen.");
assert(!/text-overflow:\s*ellipsis/.test(proofStatusSmallRule), "Nachweisstatus-Texte duerfen nicht gekuerzt werden.");
assert(!/white-space:\s*nowrap/.test(proofStatusSmallRule), "Nachweisstatus-Texte muessen umbrechen duerfen.");

console.log("Public proof visual UX smoke checks passed.");
