import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

assert.ok(existsSync("scripts/production-preflight.mjs"), "Produktions-Preflight fehlt.");
const dockerfile = readFileSync("Dockerfile", "utf8");
assert.match(dockerfile, /clamav/, "Das Produktionsimage muss den erforderlichen ClamAV-Scanner enthalten.");
assert.match(
  dockerfile,
  /RUN test -n "\$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"/,
  "Der Produktions-Build muss den Browser-Key bereits beim Image-Build erzwingen, damit keine leere Maps-Konfiguration ausgeliefert wird.",
);
const deployment = readFileSync("DEPLOYMENT_HETZNER.md", "utf8");
assert.match(
  deployment,
  /docker compose --env-file \.env\.production -f docker-compose\.production\.yml build app/,
  "Die Hetzner-Update-Anleitung muss die Production-ENV auch beim Build laden.",
);

const validEnvironment = {
  NODE_ENV: "production",
  AUTH_SECRET: "a".repeat(64),
  APP_URL: "https://flyero.org",
  NEXT_PUBLIC_SITE_URL: "https://flyero.org",
  DATABASE_URL: "postgresql://flyero:secret@postgres:5432/flyero?schema=public",
  ENABLE_MOCK_PAYMENTS: "false",
  STRIPE_SECRET_KEY: "sk_test_synthetic_123456",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_123456",
  EMAIL_PROVIDER: "resend",
  EMAIL_FROM: "FLYERO <noreply@flyero.org>",
  RESEND_API_KEY: "re_synthetic_123456",
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: "browser-synthetic-key",
  GOOGLE_MAPS_SERVER_KEY: "server-synthetic-key",
  FILE_STORAGE_PROVIDER: "s3",
  FILE_SCAN_MODE: "required",
  S3_ENDPOINT: "https://s3.example.com",
  S3_REGION: "fsn1",
  S3_BUCKET: "flyero-private",
  S3_ACCESS_KEY_ID: "access-synthetic-key",
  S3_SECRET_ACCESS_KEY: "secret-synthetic-key",
  CLAMSCAN_PATH: "/usr/bin/clamscan",
  BACKUP_RESTIC_REPOSITORY: "sftp:backup@storagebox.internal:/flyero",
  BACKUP_RESTIC_PASSWORD_FILE: "/etc/flyero/restic-password",
};

function run(environment) {
  return spawnSync(process.execPath, ["scripts/production-preflight.mjs"], {
    env: { ...process.env, ...environment },
    encoding: "utf8",
  });
}

const valid = run(validEnvironment);
assert.equal(valid.status, 0, `Gueltige Konfiguration wurde abgelehnt: ${valid.stdout}\n${valid.stderr}`);
assert.match(valid.stdout, /Production preflight passed/);

const validRestrictedKey = run({ ...validEnvironment, STRIPE_SECRET_KEY: "rk_test_synthetic_123456" });
assert.equal(validRestrictedKey.status, 0, `Gueltiger eingeschraenkter Stripe-Schluessel wurde abgelehnt: ${validRestrictedKey.stdout}\n${validRestrictedKey.stderr}`);
assert.match(validRestrictedKey.stdout, /Production preflight passed/);

const invalid = run({ ...validEnvironment, EMAIL_PROVIDER: "mock" });
assert.notEqual(invalid.status, 0, "Mock-E-Mail darf den Produktions-Preflight nicht bestehen.");
assert.match(`${invalid.stdout}\n${invalid.stderr}`, /EMAIL_PROVIDER/);
assert.ok(!`${invalid.stdout}\n${invalid.stderr}`.includes(validEnvironment.RESEND_API_KEY), "Secrets werden im Fehlertext ausgegeben.");

const missingMockFlagEnvironment = { ...validEnvironment };
delete missingMockFlagEnvironment.ENABLE_MOCK_PAYMENTS;
const missingMockFlag = run(missingMockFlagEnvironment);
assert.notEqual(missingMockFlag.status, 0, "Ein fehlendes Mock-Payment-Flag darf den Produktions-Preflight nicht bestehen.");
assert.match(`${missingMockFlag.stdout}\n${missingMockFlag.stderr}`, /ENABLE_MOCK_PAYMENTS/);

const enabledMock = run({ ...validEnvironment, ENABLE_MOCK_PAYMENTS: "true" });
assert.notEqual(enabledMock.status, 0, "Aktive Mock-Payments dürfen den Produktions-Preflight nicht bestehen.");
assert.match(`${enabledMock.stdout}\n${enabledMock.stderr}`, /ENABLE_MOCK_PAYMENTS/);

console.log("Production preflight smoke checks passed.");
