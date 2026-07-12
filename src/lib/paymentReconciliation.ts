import Stripe from "stripe";
import { PaymentReconciliationResult, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { comparePaymentSnapshot, type ReconciliationRemoteSnapshot } from "@/lib/paymentReconciliationLogic";
import { prisma } from "@/lib/prisma";

function stripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  return new Stripe(secret, { apiVersion: "2026-06-24.dahlia" });
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isMissingRemote(error: unknown) {
  return error instanceof Stripe.errors.StripeError && error.code === "resource_missing";
}

async function loadRemoteSnapshot(
  stripe: Stripe,
  payment: { stripePaymentIntentId: string | null; stripeCheckoutSessionId: string | null },
): Promise<ReconciliationRemoteSnapshot | null> {
  if (payment.stripePaymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    return {
      status: intent.status,
      amountMinor: intent.amount_received || intent.amount,
      currency: intent.currency,
    };
  }

  if (payment.stripeCheckoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId, { expand: ["payment_intent"] });
    const intent = typeof session.payment_intent === "object" && session.payment_intent ? session.payment_intent : null;
    return {
      status: intent?.status ?? session.status ?? "unknown",
      amountMinor: session.amount_total,
      currency: session.currency,
      paymentStatus: session.payment_status,
    };
  }

  return null;
}

export async function runStripeReconciliation(input: { actorId?: string | null; limit?: number; dryRun?: boolean } = {}) {
  const stripe = stripeClient();
  const limit = Math.min(Math.max(Math.floor(input.limit ?? 500), 1), 1000);
  const run = await prisma.paymentReconciliationRun.create({
    data: { providerCode: "stripe", dryRun: input.dryRun ?? true },
  });
  const payments = await prisma.payment.findMany({
    where: {
      OR: [{ stripePaymentIntentId: { not: null } }, { stripeCheckoutSessionId: { not: null } }],
    },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  const counts = { checkedCount: 0, matchedCount: 0, mismatchCount: 0, missingCount: 0, errorCount: 0 };
  for (const payment of payments) {
    counts.checkedCount += 1;
    try {
      const remote = await loadRemoteSnapshot(stripe, payment);
      if (!remote) {
        counts.missingCount += 1;
        await prisma.paymentReconciliationIssue.create({
          data: { runId: run.id, paymentId: payment.id, result: PaymentReconciliationResult.REMOTE_MISSING, localStatus: payment.status, details: jsonValue({ reason: "missing_provider_reference" }) },
        });
        continue;
      }

      const comparison = comparePaymentSnapshot(
        { status: payment.status, amountMinor: Math.round(Number(payment.amount) * 100), currency: payment.currency },
        remote,
      );
      if (comparison.result === "MATCH") {
        counts.matchedCount += 1;
      } else {
        counts.mismatchCount += 1;
        await prisma.paymentReconciliationIssue.create({
          data: {
            runId: run.id,
            paymentId: payment.id,
            result: PaymentReconciliationResult.MISMATCH,
            localStatus: payment.status,
            remoteStatus: remote.status,
            amountMismatch: comparison.amountMismatch,
            currencyMismatch: comparison.currencyMismatch,
            details: jsonValue(comparison.details),
          },
        });
      }
    } catch (error) {
      if (isMissingRemote(error)) {
        counts.missingCount += 1;
        await prisma.paymentReconciliationIssue.create({
          data: { runId: run.id, paymentId: payment.id, result: PaymentReconciliationResult.REMOTE_MISSING, localStatus: payment.status, details: jsonValue({ reason: "provider_resource_missing" }) },
        });
      } else {
        counts.errorCount += 1;
        await prisma.paymentReconciliationIssue.create({
          data: { runId: run.id, paymentId: payment.id, result: PaymentReconciliationResult.ERROR, localStatus: payment.status, details: jsonValue({ reason: "provider_request_failed" }) },
        });
      }
    }
  }

  const completed = await prisma.paymentReconciliationRun.update({
    where: { id: run.id },
    data: { ...counts, status: "COMPLETED", completedAt: new Date() },
    include: { issues: true },
  });
  await createAuditLog({
    userId: input.actorId ?? null,
    action: "payment.reconciliation_completed",
    entityType: "PaymentReconciliationRun",
    entityId: completed.id,
    newValues: counts,
  });
  return completed;
}
