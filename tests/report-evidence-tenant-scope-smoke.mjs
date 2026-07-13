import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [reportDownload, photoReview, photoScan, archive] = await Promise.all([
  readFile("src/app/api/admin/reports/[id]/download/route.ts", "utf8"),
  readFile("src/app/api/admin/report-photos/[id]/route.ts", "utf8"),
  readFile("src/app/api/admin/report-photos/[id]/scan/route.ts", "utf8"),
  readFile("src/app/api/admin/reports/[id]/archive/route.ts", "utf8"),
]);

assert.match(reportDownload, /requirePermission\(Permission\.REPORT_REVIEW\)/);
assert.match(reportDownload, /tenantWhereForSession/);
assert.match(reportDownload, /findFirst\(/);

assert.match(photoReview, /requirePermission\(Permission\.DOCUMENT_REVIEW\)/);
assert.match(photoReview, /tenantWhereForSession/);
assert.match(photoReview, /findFirst\(/);

assert.match(photoScan, /tenantWhereForSession/);
assert.match(photoScan, /findFirst\(/);

assert.match(archive, /requirePermission\(Permission\.REPORT_PUBLISH\)/);

console.log("Report evidence tenant-scope smoke checks passed.");
