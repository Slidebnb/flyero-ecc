import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");
const css = readFileSync("src/app/styles/marketing.css", "utf8");

assert(marketing.includes('className="mkAnnouncementBar"'), "Die Gutschein-Ankündigungsleiste fehlt.");
assert(marketing.includes('role="status"'), "Die Ankündigung muss für Screenreader als Status angekündigt werden.");
assert(marketing.includes("10 % Rabatt auf Ihre Online-Zahlung"), "Der Rabatttext fehlt.");
assert(marketing.includes("FLYERO10NKB"), "Der aktuelle Gutscheincode fehlt.");
assert(marketing.includes('href="/verteilung-anfragen"'), "Die Ankündigung braucht einen klaren Einstieg zur Anfrage.");
assert(css.includes(".mkAnnouncementBar"), "Die Ankündigungsleiste benötigt eigene responsive Styles.");
assert(css.includes("@media (max-width: 820px)"), "Die mobile Darstellung muss berücksichtigt werden.");
console.log("Marketing announcement bar checks passed.");
