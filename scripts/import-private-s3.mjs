import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const [sourceRoot, namespace] = process.argv.slice(2);
if (!sourceRoot || !namespace) throw new Error("Verwendung: node scripts/import-private-s3.mjs <quelle> <namespace>");
if (process.env.FILE_STORAGE_PROVIDER !== "s3") throw new Error("S3-Import verlangt FILE_STORAGE_PROVIDER=s3.");

const bucket = process.env.S3_BUCKET?.trim();
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY sind erforderlich.");

const prefix = process.env.S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "");
const objectPrefix = [prefix, namespace].filter(Boolean).join("/");
const client = new S3Client({
  region: process.env.S3_REGION?.trim() || "eu-central-1",
  endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: { accessKeyId, secretAccessKey },
});

async function files(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, child));
    else result.push(child);
  }
  return result;
}

const entries = await files(sourceRoot);
for (const relative of entries) {
  const key = `${objectPrefix}/${relative.replace(/\\/g, "/")}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(path.join(sourceRoot, relative)) }));
}
console.error(`S3-Import ${namespace}: ${entries.length} Objekte`);
