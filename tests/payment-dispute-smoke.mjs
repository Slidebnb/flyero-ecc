import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyStripeDisputeEvent, isRefundBlockedByDispute } from "../src/lib/paymentDisputeLogic.ts";

const created = classifyStripeDisputeEvent({ type: "charge.dispute.created", status: "needs_response" });
assert.equal(created.status, "OPEN");
assert.equal(created.customerMessage, "Eine Zahlung wird von Stripe geprüft.");

const won = classifyStripeDisputeEvent({ type: "charge.dispute.closed", status: "won" });
assert.equal(won.status, "WON");
assert.equal(isRefundBlockedByDispute("OPEN"), true);
assert.equal(isRefundBlockedByDispute("WON"), false);

const lost = classifyStripeDisputeEvent({ type: "charge.dispute.updated", status: "lost" });
assert.equal(lost.status, "LOST");
assert.equal(classifyStripeDisputeEvent({ type: "charge.dispute.closed", status: "warning_closed" }).status, "CLOSED");

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /model PaymentDispute\s*\{/);
assert.match(schema, /enum PaymentDisputeStatus\s*\{/);
assert.match(fs.readFileSync("src/lib/payments.ts", "utf8"), /charge\.dispute\.created/);
assert.match(fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"), /auditRequestContext/);
assert.match(fs.readFileSync("src/app/api/admin/payments/disputes/route.ts", "utf8"), /PAYMENT_DISPUTE_MANAGE/);
assert.match(fs.readFileSync("src/app/api/admin/payments/disputes/[id]/route.ts", "utf8"), /payment\.dispute\.updated/);
assert.match(fs.readFileSync("src/lib/payments.ts", "utf8"), /offener Stripe-Zahlungsstreitfall/);

console.log("Payment dispute smoke checks passed.");
