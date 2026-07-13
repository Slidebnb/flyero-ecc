import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const required = [
  ["SECURITY_POLICY.md", ["Least Privilege", "INCIDENT_RESPONSE", "ClamAV"]],
  ["INCIDENT_RESPONSE.md", ["Schweregrade", "Eindammen", "Post-Incident-Report"]],
  ["DATA_CLASSIFICATION.md", ["Besonders sensibel", "GPS", "Aufbewahrungsfristen"]],
  ["VENDOR_SUBPROCESSORS.md", ["Hetzner", "Stripe", "AVV"]],
  ["BACKUP_POLICY.md", ["RPO", "RTO", "isolierter Restore"]],
  ["API_CONTRACTS.md", ["Antwortformat", "Request-Korrelation", "OpenAPI"]],
];

for (const [file, markers] of required) {
  const content = await readFile(file, "utf8");
  for (const marker of markers) {
    assert.match(content, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} fehlt der Marker ${marker}.`);
  }
}

const audit = await readFile("TECHNICAL_DUE_DILIGENCE_AUDIT_2026-07-12.md", "utf8");
assert.match(audit, /Security-Policy/);
assert.match(audit, /Datenklassifikation/);
assert.match(audit, /Vendor-Matrix/);

console.log("Operational documentation smoke checks passed.");
