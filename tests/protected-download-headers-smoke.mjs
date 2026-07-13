import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [headers, documents, documentDownload, evidenceDownload, reportDownload, proofDownload] = await Promise.all([
  readFile("src/lib/downloadHeaders.ts", "utf8"),
  readFile("src/lib/documentStorage.ts", "utf8"),
  readFile("src/app/api/customer/documents/[id]/download/route.ts", "utf8"),
  readFile("src/app/api/customer/reports/[id]/evidence/[documentId]/route.ts", "utf8"),
  readFile("src/app/api/customer/reports/[id]/download/route.ts", "utf8"),
  readFile("src/app/api/proofs/[id]/route.ts", "utf8"),
]);

assert.match(headers, /x-content-type-options/);
assert.match(headers, /cache-control/);
assert.match(headers, /safeDownloadFilename/);
assert.match(documents, /documentMimeTypeForExtension/);
assert.match(documentDownload, /downloadHeaders/);
assert.match(evidenceDownload, /downloadHeaders/);
assert.match(reportDownload, /downloadHeaders/);
assert.match(proofDownload, /rasterProofMimeType/);
assert.match(proofDownload, /downloadHeaders/);
assert.match(proofDownload, /inline: true/);
assert.doesNotMatch(proofDownload, /mimeType = metadataValue\(photo\.metadata/);

console.log("Protected-download header smoke checks passed.");
