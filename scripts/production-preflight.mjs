import dotenv from "dotenv";

dotenv.config({ path: process.env.ENV_FILE || ".env", quiet: true });

const errors = [];

function requireValue(name, predicate, message) {
  const value = process.env[name] || "";
  if (!predicate(value)) errors.push(`${name}: ${message}`);
}

function isHttps(value) {
  return value.startsWith("https://") && !value.includes("replace-");
}

function isConfiguredSecret(value) {
  return value.length >= 8 && !value.includes("replace-") && !value.includes("example");
}

requireValue("NODE_ENV", (value) => value === "production", "muss production sein.");
requireValue("AUTH_SECRET", (value) => value.length >= 32 && !value.includes("replace-"), "muss mindestens 32 Zeichen haben.");
requireValue("APP_URL", isHttps, "muss eine HTTPS-URL sein.");
requireValue("NEXT_PUBLIC_SITE_URL", isHttps, "muss eine HTTPS-URL sein.");
requireValue("DATABASE_URL", (value) => value.startsWith("postgresql://") && !value.includes("replace-"), "muss eine konfigurierte PostgreSQL-URL sein.");

if (process.env.ENABLE_MOCK_PAYMENTS === "true") {
  errors.push("ENABLE_MOCK_PAYMENTS: darf in Produktion nicht true sein.");
}
requireValue("STRIPE_SECRET_KEY", (value) => value.startsWith("sk_test_") || value.startsWith("sk_live_"), "muss ein Stripe-Secret im Test- oder Live-Modus sein.");
requireValue("STRIPE_WEBHOOK_SECRET", (value) => value.startsWith("whsec_"), "muss ein signierter Stripe-Webhook-Secret sein.");

const emailProvider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
if (emailProvider === "mock") {
  errors.push("EMAIL_PROVIDER: mock ist in Produktion nicht erlaubt.");
} else if (emailProvider === "smtp") {
  requireValue("SMTP_HOST", isConfiguredSecret, "muss fuer SMTP gesetzt sein.");
  requireValue("SMTP_FROM", (value) => isConfiguredSecret(value) || isConfiguredSecret(process.env.EMAIL_FROM || ""), "SMTP_FROM oder EMAIL_FROM muss gesetzt sein.");
} else if (emailProvider === "resend") {
  requireValue("RESEND_API_KEY", isConfiguredSecret, "muss fuer Resend gesetzt sein.");
  requireValue("EMAIL_FROM", isConfiguredSecret, "muss fuer Resend gesetzt sein.");
} else {
  errors.push("EMAIL_PROVIDER: muss smtp oder resend sein.");
}

requireValue("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", isConfiguredSecret, "muss gesetzt sein.");
requireValue("GOOGLE_MAPS_SERVER_KEY", isConfiguredSecret, "muss gesetzt sein.");
requireValue("FILE_STORAGE_PROVIDER", (value) => value.toLowerCase() === "s3", "muss in Produktion s3 sein.");
requireValue("FILE_SCAN_MODE", (value) => value.toLowerCase() === "required", "muss required sein.");
requireValue("S3_ENDPOINT", isHttps, "muss eine HTTPS-URL sein.");
requireValue("S3_REGION", isConfiguredSecret, "muss gesetzt sein.");
requireValue("S3_BUCKET", isConfiguredSecret, "muss gesetzt sein.");
requireValue("S3_ACCESS_KEY_ID", isConfiguredSecret, "muss gesetzt sein.");
requireValue("S3_SECRET_ACCESS_KEY", isConfiguredSecret, "muss gesetzt sein.");
requireValue("CLAMSCAN_PATH", isConfiguredSecret, "muss fuer den erforderlichen Scan gesetzt sein.");
requireValue("BACKUP_RESTIC_REPOSITORY", isConfiguredSecret, "muss auf ein externes Backupziel zeigen.");
requireValue("BACKUP_RESTIC_PASSWORD_FILE", isConfiguredSecret, "muss auf eine geschuetzte Passwortdatei zeigen.");

if (errors.length > 0) {
  console.error("Production preflight failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production preflight passed: no mock payments, mock email, local storage or missing launch secrets detected.");
}
