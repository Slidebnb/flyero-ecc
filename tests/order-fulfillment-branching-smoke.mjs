import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = readFileSync("src/lib/orderReviewWorkflow.ts", "utf8");
const workflow = readFileSync("src/lib/orderReviewWorkflow.ts", "utf8");
const approval = readFileSync("src/lib/orderApproval.ts", "utf8");
const documents = readFileSync("src/lib/documents.ts", "utf8");

assert(source.includes('const paid = order.payments.some((payment) => payment.status === "PAID")'), "Paid orders need a separate approval path.");
assert(approval.includes("updated.customerOwnFlyers"), "Customer-provided flyers need their own fulfillment path.");
assert(approval.includes("createInvoiceForOrder"), "Invoices must be created in the approved path.");
assert(workflow.includes("refundPayment"), "Rejection must handle paid orders safely.");
assert(approval.includes("ensurePrintOrderForOrder"), "Print service must enter the PrintOrder process after paid approval.");
assert(documents.includes("ensurePrintOrderForOrder"), "Idempotent PrintOrder preparation is missing.");
console.log("Order fulfillment branching checks passed.");
