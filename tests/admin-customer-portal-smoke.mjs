import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

const nav = await read("src/app/admin/AdminPortalShell.tsx");
assert.match(nav, /href: "\/admin\/customers"/, "Admin navigation must expose the customer workspace.");

const customersPage = await read("src/app/admin/customers/page.tsx");
assert.match(customersPage, /requireRole\(\[UserRole\.ADMIN\]\)/, "Customer list must be admin-only.");
assert.match(customersPage, /productionCustomerWhere\(\)/, "Customer list must use production data filters.");
assert.match(customersPage, /companyName: \{ contains: query/s, "Customer list must search company names.");
assert.match(customersPage, /user: \{ email: \{ contains: query/s, "Customer list must search user email addresses.");

const customerDetailPage = await read("src/app/admin/customers/[id]/page.tsx");
assert.match(customerDetailPage, /requireRole\(\[UserRole\.ADMIN\]\)/, "Customer detail must be admin-only.");
assert.match(customerDetailPage, /createApprovedCustomerDocument/, "Admin customer detail must upload directly approved customer documents.");
assert.match(customerDetailPage, /encType="multipart\/form-data"/, "Upload form must accept real files.");
assert.match(customerDetailPage, /documentType/, "Upload form must choose invoice or evidence document type.");

const documents = await read("src/lib/documents.ts");
assert.match(documents, /export async function createApprovedCustomerDocument/, "Documents service must expose a dedicated approved admin upload.");
assert.match(documents, /status: "APPROVED"/, "Approved admin upload must create approved documents.");
assert.match(documents, /customerVisible: true/, "Approved admin upload must make documents visible to customers.");
assert.match(documents, /reviewStatus: "APPROVED"/, "Approved admin upload must mark review status approved.");
assert.match(documents, /approvedById: actor\.id/, "Approved admin upload must record the approving admin.");
assert.match(documents, /storeDocumentFile/, "Approved admin upload must use the secured document storage path.");

const invoicesPage = await read("src/app/customer/invoices/page.tsx");
assert.match(invoicesPage, /document\.findMany/, "Customer invoice page must include approved invoice uploads.");
assert.match(invoicesPage, /documentType: "INVOICE"/, "Customer invoice page must filter uploaded invoice documents.");
assert.match(invoicesPage, /\/api\/customer\/documents\/\$\{document\.id\}\/download/, "Uploaded invoices must download through protected customer document route.");
