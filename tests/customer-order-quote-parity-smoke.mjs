import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const route = readFileSync("src/app/api/maps/order-intelligence/route.ts", "utf8");
const getRoute = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));

assert.match(
  getRoute,
  /includeOperationalData:\s*true/,
  "Die Kunden-Preisvorschau muss dieselbe operative Gebiets- und Lagerpruefung wie der Checkout verwenden.",
);

assert.match(
  getRoute,
  /preferredEndDate:[\s\S]*?includeOperationalData:\s*true[\s\S]*?\}\);/,
  "Der operative Pruefmodus muss Teil des konkreten Preview-Aufrufs sein.",
);

console.log("Customer order quote parity checks passed.");
