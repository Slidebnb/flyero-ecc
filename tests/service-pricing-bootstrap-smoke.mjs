import { readFile } from "node:fs/promises";

const source = await readFile("src/lib/servicePricing.ts", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const functionBody = source.match(/async function bootstrapDefaultServicePricingRules\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";

assert(functionBody, "Bootstrap-Funktion fuer Service-Preisregeln fehlt.");
assert(functionBody.includes("prisma.pricingRule.findMany"), "Preisregel-Bootstrap muss vorhandene Regeln gemeinsam laden.");
assert(!functionBody.includes("prisma.pricingRule.findFirst"), "Preisregel-Bootstrap darf nicht pro Regel einzeln suchen.");
assert(functionBody.includes("Promise.all"), "Fehlende Preisregeln sollen parallel angelegt werden.");
assert(source.includes("defaultServicePricingRulesPromise"), "Preisregel-Bootstrap braucht einen Prozess-Lock gegen doppelte Initialisierung.");

console.log("Service pricing bootstrap smoke passed.");
