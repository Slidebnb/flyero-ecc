import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [adapter, documents, generated, monitoring, env, productionEnv, docs, backup, restore, s3Export, s3Import] = await Promise.all([
  readFile("src/lib/privateObjectStorage.ts", "utf8"),
  readFile("src/lib/documentStorage.ts", "utf8"),
  readFile("src/lib/generatedAssets.ts", "utf8"),
  readFile("src/lib/monitoring.ts", "utf8"),
  readFile(".env.example", "utf8"),
  readFile(".env.production.example", "utf8"),
  readFile("PRIVATE_OBJECT_STORAGE.md", "utf8"),
  readFile("scripts/backup-production.sh", "utf8"),
  readFile("scripts/restore-production.sh", "utf8"),
  readFile("scripts/export-private-s3.mjs", "utf8"),
  readFile("scripts/import-private-s3.mjs", "utf8"),
]);

assert.match(adapter, /PutObjectCommand/);
assert.match(adapter, /GetObjectCommand/);
assert.match(adapter, /FILE_STORAGE_PROVIDER/);
assert.match(adapter, /S3_BUCKET/);
assert.match(adapter, /split\("\/"\)\.includes\("\.\."\)/);
assert.match(documents, /writePrivateObject/);
assert.match(documents, /readPrivateObject/);
assert.match(generated, /writePrivateObject/);
assert.match(generated, /readPrivateObject/);
assert.match(monitoring, /privateStorageConfiguration/);
assert.match(monitoring, /storageProvider/);
assert.match(env, /FILE_STORAGE_PROVIDER="local"/);
assert.match(productionEnv, /FILE_STORAGE_PROVIDER="s3"/);
assert.match(docs, /keine S3-Zugangsdaten als `NEXT_PUBLIC_\*`/);
assert.match(backup, /export-private-s3\.mjs/);
assert.match(backup, /FILE_STORAGE_PROVIDER/);
assert.match(restore, /import-private-s3\.mjs/);
assert.match(s3Export, /ListObjectsV2Command/);
assert.match(s3Import, /PutObjectCommand/);

console.log("Private-Object-Storage Smoke-Test erfolgreich abgeschlossen.");
