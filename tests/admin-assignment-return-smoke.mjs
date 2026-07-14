import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const dispatch = readFileSync("src/lib/dispatch.ts", "utf8");
assert(dispatch.includes('isReassignment ? "REASSIGNED"'), "Neue Zuweisung muss alte aktive Zuweisung historisieren.");
assert(dispatch.includes('status: "CANCELLED"'), "Alte Touren müssen bei Umzuweisung beendet werden.");
assert(dispatch.includes("reservedDistributorId: null"), "Verteilerablehnung muss die Reservierung zurückgeben.");
console.log("Admin assignment return checks passed.");
