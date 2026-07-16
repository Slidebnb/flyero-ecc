import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const schema = readFileSync("prisma/schema.prisma", "utf8");
const payments = readFileSync("src/lib/payments.ts", "utf8");
const route = readFileSync("src/app/api/payments/checkout/route.ts", "utf8");

assert(/checkoutKey\s+String\?\s+@unique/.test(schema), "Payment braucht einen eindeutigen Checkout-Schluessel.");
assert(/checkoutClaimToken\s+String\?\s+@unique/.test(schema), "Payment braucht einen Checkout-Claim.");
for (const required of [
  "checkoutKey",
  "P2002",
  "checkout_race_reused",
  "PAYMENT_PENDING",
]) {
  assert(payments.includes(required), `Checkout-Idempotenz fehlt: ${required}`);
}
assert(route.includes("idempotencyKey"), "Checkout-Route muss den Idempotency-Key akzeptieren.");

console.log("customer-order-checkout-idempotency-smoke: ok");
