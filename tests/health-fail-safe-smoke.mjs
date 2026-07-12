import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readSource(filePath) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  return readFile(filePath, "utf8");
}

const healthRoute = await readSource("src/app/api/health/route.ts");
const monitoring = await readSource("src/lib/monitoring.ts");

assert(
  healthRoute.includes("latest?.status ?? HealthStatus.DEGRADED"),
  "/api/health darf ohne gespeicherten Check nicht OK melden.",
);
assert(
  healthRoute.includes('"Cache-Control": "no-store"'),
  "/api/health muss von Caching ausgenommen werden.",
);
assert(
  monitoring.includes('process.env.NODE_ENV === "production"'),
  "Der Mock-Mailprovider muss in Produktion als nicht produktiv bewertet werden.",
);
assert(
  monitoring.includes('process.env.EMAIL_PROVIDER || "mock"'),
  "Die Health-Pruefung muss den ausgewaehlten Mailprovider erkennen.",
);
assert(
  monitoring.includes("SMTP_HOST") && monitoring.includes("RESEND_API_KEY"),
  "Die Health-Pruefung muss SMTP und Resend getrennt bewerten.",
);
assert(
  !monitoring.includes("process.env.SMTP_HOST || process.env.EMAIL_PROVIDER ? HealthStatus.OK"),
  "Eine gesetzte EMAIL_PROVIDER-Variable darf nicht automatisch als gesund gelten.",
);

console.log("Health fail-safe smoke checks passed.");
