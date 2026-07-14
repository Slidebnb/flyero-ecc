import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync("src/app/register/customer/CustomerRegisterForm.tsx", "utf8");
const schema = readFileSync("src/lib/validators.ts", "utf8");

for (const field of ["companyName", "contactName", "email", "phone", "password"]) {
  assert.match(form, new RegExp(`name=\\"${field}\\"`), `Registrierung muss ${field} enthalten.`);
}

for (const field of ["billingStreet", "billingHouseNumber", "billingPostalCode", "billingCity", "deliveryStreet", "deliveryPostalCode", "vatId", "logoUrl"]) {
  assert.doesNotMatch(form, new RegExp(`name=\\"${field}\\"`), `Registrierung darf ${field} nicht anzeigen.`);
}

assert.match(schema, /billingStreet: optionalText/);
assert.match(schema, /deliveryStreet: optionalText/);
assert.match(schema, /vatId: optionalText/);
assert.match(schema, /logoUrl: optionalText/);
console.log("Progressive registration contract passed.");
