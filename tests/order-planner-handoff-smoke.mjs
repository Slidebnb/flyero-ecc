import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/verteilung-planen/page.tsx", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const requestPage = readFileSync("src/app/verteilung-anfragen/page.tsx", "utf8");

assert.match(page, /Preisvorschau ohne Registrierung/);
assert.match(page, /mode="public_quote"/);
assert.match(wizard, /register\/customer\?next=/);
assert.match(wizard, /verteilung-anfragen\?from=planner/);
assert.match(wizard, /clearDraft: false/);
assert.match(requestPage, /verteilung-planen/);
console.log("Order planner handoff checks passed.");
