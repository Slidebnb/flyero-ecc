import { readFileSync } from "node:fs";

const pages = [
  ["Impressum", "src/app/impressum/page.tsx"],
  ["Datenschutz", "src/app/datenschutz/page.tsx"],
  ["AGB", "src/app/agb/page.tsx"],
];

const failures = pages
  .filter(([, path]) => !/headingLevel="h1"/.test(readFileSync(path, "utf8")))
  .map(([name]) => name);

if (failures.length > 0) {
  throw new Error(`Rechtliche Seiten brauchen eine H1: ${failures.join(", ")}`);
}

console.log("Legal page heading smoke checks passed.");