import "dotenv/config";

const baseUrl = process.env.APP_URL || "http://localhost:3000";
const token = process.env.INTERNAL_API_TOKEN?.trim();
if (!token) throw new Error("INTERNAL_API_TOKEN ist fuer den Reconciliation-Job erforderlich.");

const limit = Number(process.env.PAYMENT_RECONCILIATION_LIMIT || "500");
const response = await fetch(`${baseUrl}/api/admin/payments/reconcile?limit=${encodeURIComponent(limit)}`, {
  method: "POST",
  headers: { "x-internal-api-token": token },
});
const body = await response.json().catch(() => null);
if (!response.ok || !body?.ok) {
  throw new Error(`Stripe-Reconciliation fehlgeschlagen (${response.status}).`);
}

console.log(JSON.stringify({
  runId: body.data.id,
  status: body.data.status,
  checkedCount: body.data.checkedCount,
  matchedCount: body.data.matchedCount,
  mismatchCount: body.data.mismatchCount,
  missingCount: body.data.missingCount,
  errorCount: body.data.errorCount,
}, null, 2));
