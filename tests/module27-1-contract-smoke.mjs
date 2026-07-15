import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const expect = (condition, message) => assert.ok(condition, message);

const schema = read("prisma/schema.prisma");
const constants = read("src/lib/constants.ts");
const review = read("src/lib/orderReviewWorkflow.ts");
const approval = read("src/lib/orderApproval.ts");
const customerCorrection = read("src/app/api/customer/orders/[id]/route.ts");
const customerDetail = read("src/app/customer/orders/[id]/page.tsx");
const customerDashboard = read("src/app/customer/dashboard/page.tsx");
const adminStatus = read("src/app/api/admin/orders/[id]/status/route.ts");
const ci = read(".github/workflows/ci.yml");

expect(schema.includes("ACCEPTED_AWAITING_PAYMENT"), "Der Annahme-Status fehlt im Prisma-Schema.");
expect(constants.includes("ACCEPTED_AWAITING_PAYMENT"), "Der Annahme-Status fehlt in Labels und State Machine.");
expect(review.includes("ACCEPTED_AWAITING_PAYMENT"), "Der Review-Service kennt den einmaligen Annahmestatus nicht.");
expect(review.includes("reviewDecisionSnapshot"), "Der Review-Service speichert keinen Annahme-Snapshot.");
const priceRoute = await read("src/app/api/admin/orders/[id]/price/route.ts");
expect(priceRoute.includes("ACCEPTED_AWAITING_PAYMENT"), "Preisänderungen invalidieren den Annahme-/Zahlungsstatus nicht.");
expect(approval.includes("customerOwnFlyers") && approval.includes("needsPrintService"), "Fulfillment muss nach Flyerquelle verzweigen.");
expect(approval.includes("ensureShipmentForCustomerFlyers") && approval.includes("ensurePrintOrderForOrder"), "Review-Service muss beide Fulfillmentpfade idempotent aufrufen.");
expect(customerCorrection.includes("PAID_ORDER_REQUIRES_ADMIN_CHANGE"), "Bezahlte preisrelevante Kundenkorrekturen muessen 409 liefern.");
expect(customerCorrection.includes("orderDistributionSegment.deleteMany"), "Kundenkorrektur muss alte Segmente atomar ersetzen.");
expect(customerCorrection.includes('isCustomerCorrection ? "UNDER_REVIEW"'), "Kundenkorrektur muss erneut in die Adminpruefung gehen.");
expect(customerDetail.includes("order.targetAreaGeoJson ?? order.distributionArea?.geoJson"), "Kundenkarte muss den Auftragssnapshot priorisieren.");
expect(customerDashboard.includes("report?.order.targetAreaGeoJson") && customerDashboard.includes("order?.targetAreaGeoJson"), "Dashboardkarte muss den Auftragssnapshot priorisieren.");
expect(existsSync("src/app/api/admin/orders/[id]/review/route.ts"), "Dedizierter Review-Endpunkt fehlt.");
expect(!adminStatus.includes("refundPayment"), "Die generische Statusroute darf den Refundpfad nicht parallel implementieren.");
expect(review.includes("getOrderIntegrityCheck"), "Review-Service muss vor der Entscheidung die Order-Integritaet pruefen.");
expect(existsSync("scripts/audit-order-integrity.mjs"), "Lesendes Bestandsaudit fehlt.");
expect(existsSync("scripts/repair-order-integrity.mjs"), "Dry-Run-Reparaturscript fehlt.");
expect(existsSync("tests/order-pricing-runtime.mjs"), "Preis-Runtime-Test fehlt.");
expect(existsSync("tests/order-area-snapshot-runtime.mjs"), "Gebiets-Runtime-Test fehlt.");
expect(existsSync("tests/order-correction-runtime.mjs"), "Korrektur-Runtime-Test fehlt.");
expect(existsSync("tests/order-review-payment-runtime.mjs"), "Review-/Payment-Runtime-Test fehlt.");
expect(existsSync("tests/order-fulfillment-runtime.mjs"), "Fulfillment-Runtime-Test fehlt.");
expect(existsSync("tests/notification-delivery-runtime.mjs"), "Notification-Runtime-Test fehlt.");
expect(existsSync("tests/multi-area-dispatch-runtime.mjs"), "Multi-Area-Runtime-Test fehlt.");
expect(existsSync("tests/order-integrity-repair-runtime.mjs"), "Integrity-Runtime-Test fehlt.");
expect(ci.includes("test:module27-1-runtime"), "Modul 27.1 ist noch nicht verbindlich in der CI.");

console.log("Module 27.1 contract checks passed.");
