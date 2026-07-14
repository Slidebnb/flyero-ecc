import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const areaSource = readFileSync("src/lib/areas.ts", "utf8");
const createRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const updateRoute = readFileSync("src/app/api/customer/orders/[id]/route.ts", "utf8");
assert(areaSource.includes("linkAreaReferenceToOrder"), "Reine Gebietsverknüpfung fehlt.");
assert(createRoute.includes("linkAreaReferenceToOrder"), "Create-Route muss die Referenzfunktion nutzen.");
assert(updateRoute.includes("linkAreaReferenceToOrder"), "Update-Route muss die Referenzfunktion nutzen.");
assert(!createRoute.includes("assignAreaToOrder({"), "Create-Route darf den Order-Snapshot nicht überschreiben.");
assert(!updateRoute.includes("assignAreaToOrder({"), "Update-Route darf den Order-Snapshot nicht überschreiben.");
console.log("Saved area edit integrity checks passed.");
