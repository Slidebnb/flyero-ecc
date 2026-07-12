import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function source(filePath) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  return readFile(filePath, "utf8");
}

const proxy = await source("src/proxy.ts");
const context = await source("src/lib/auditRequestContext.ts");
const audit = await source("src/lib/audit.ts");
const monitoring = await source("src/lib/monitoring.ts");

assert(proxy.includes('request.headers.get("x-request-id")'), "Der Proxy liest keine eingehende Request-ID.");
assert(proxy.includes('headers.set("x-request-id", requestId)'), "Der Proxy propagiert keine Request-ID an die Route.");
assert(proxy.includes('response.headers.set("x-request-id", requestId)'), "Die Response gibt keine Request-ID zur Korrelation zurueck.");
assert(proxy.includes('"/api/:path*"'), "Der Proxy umfasst keine API-Routen fuer Request-ID-Korrelation.");
assert(context.includes("currentAuditRequestContext"), "Es gibt keinen serverseitigen Kontext-Fallback fuer Logs.");
assert(context.includes("await headers()"), "Der aktuelle Request-Header-Kontext wird nicht gelesen.");
assert(audit.includes("currentAuditRequestContext()"), "AuditLogs uebernehmen den aktuellen Request-Kontext nicht automatisch.");
assert(monitoring.includes("currentAuditRequestContext()"), "Technische Logs uebernehmen den aktuellen Request-Kontext nicht.");
assert(monitoring.includes("requestId"), "Technische Logs speichern keine Request-ID im Metadatenkontext.");

console.log("Request-ID propagation smoke checks passed.");
