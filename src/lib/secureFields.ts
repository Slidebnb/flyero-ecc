import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey() {
  const secret = process.env.SENSITIVE_DATA_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Sensible Felder koennen ohne AUTH_SECRET nicht verschluesselt werden.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSensitiveString(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX.slice(0, -1), iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSensitiveString(value: unknown) {
  if (typeof value !== "string" || !value) return value == null ? "" : String(value);
  if (!value.startsWith(PREFIX)) return value;

  const [, version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Ungültiges Format eines geschützten Feldes.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSensitiveBankAccount(owner?: string, iban?: string) {
  if (!owner && !iban) return null;
  return {
    owner: owner ? encryptSensitiveString(owner) : null,
    iban: iban ? encryptSensitiveString(iban) : null,
  };
}

export function decryptSensitiveBankAccount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { owner: "", iban: "" };
  const account = value as { owner?: unknown; iban?: unknown };
  return {
    owner: decryptSensitiveString(account.owner),
    iban: decryptSensitiveString(account.iban),
  };
}

export function maskSensitiveValue(value: unknown) {
  const text = typeof value === "string" ? decryptSensitiveString(value) : "";
  if (!text) return null;
  if (text.length <= 4) return "****";
  return `${"*".repeat(Math.min(8, Math.max(4, text.length - 4)))}${text.slice(-4)}`;
}
