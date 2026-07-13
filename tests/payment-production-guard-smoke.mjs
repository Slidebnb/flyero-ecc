import assert from "node:assert/strict";
import fs from "node:fs";

const payments = fs.readFileSync("src/lib/payments.ts", "utf8");
const mockComplete = fs.readFileSync("src/app/api/payments/mock-complete/[id]/route.ts", "utf8");

assert(payments.includes('process.env.NODE_ENV === "production"'), "Payment-Library blockiert Mock-Zahlungen in Production nicht hart.");
assert(payments.includes("if (!mockPaymentsEnabled()) return false;"), "Mock-Stripe-Erkennung ist nicht an den Production-Guard gebunden.");
assert(mockComplete.includes('process.env.NODE_ENV === "production"'), "Mock-Complete-Route hat keinen harten Production-Guard.");

console.log("Payment production guard smoke checks passed.");
