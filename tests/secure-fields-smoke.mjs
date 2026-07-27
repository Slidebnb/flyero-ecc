import assert from "node:assert/strict";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-for-secure-fields";
const {
  decryptSensitiveBankAccount,
  decryptSensitiveString,
  encryptSensitiveBankAccount,
  encryptSensitiveString,
} = await import("../src/lib/secureFields.ts");

const taxNumber = "32/074/56310";
const encryptedTaxNumber = encryptSensitiveString(taxNumber);
assert.ok(encryptedTaxNumber.startsWith("enc:v1:"), "Steuerdaten müssen verschlüsselt gespeichert werden.");
assert.notEqual(encryptedTaxNumber, taxNumber, "Steuerdaten dürfen nicht als Klartext gespeichert werden.");
assert.equal(decryptSensitiveString(encryptedTaxNumber), taxNumber, "Verschlüsselte Steuerdaten müssen lesbar wiederhergestellt werden.");

const encryptedBankAccount = encryptSensitiveBankAccount("Familie Huwa", "DE89370400440532013000");
assert.ok(encryptedBankAccount);
assert.notEqual(encryptedBankAccount.iban, "DE89370400440532013000");
assert.deepEqual(decryptSensitiveBankAccount(encryptedBankAccount), {
  owner: "Familie Huwa",
  iban: "DE89370400440532013000",
});

assert.equal(decryptSensitiveString("legacy-value"), "legacy-value", "Alte Klartextwerte müssen bis zur Migration lesbar bleiben.");
console.log("Sensitive field encryption contract passed.");
