import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [targetRoot, namespace] = process.argv.slice(2);
if (!targetRoot || !namespace) throw new Error("Verwendung: node scripts/export-private-s3.mjs <ziel> <namespace>");
if (process.env.FILE_STORAGE_PROVIDER !== "s3") throw new Error("S3-Export verlangt FILE_STORAGE_PROVIDER=s3.");

const bucket = process.env.S3_BUCKET?.trim();
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID und S3_SECRET_ACCESS_KEY sind erforderlich.");

const prefix = process.env.S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "");
const objectPrefix = [prefix, namespace].filter(Boolean).join("/") + "/";
await mkdir(targetRoot, { recursive: true });
const client = new S3Client({
  region: process.env.S3_REGION?.trim() || "eu-central-1",
  endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: { accessKeyId, secretAccessKey },
});

function safeRelativeKey(key) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) throw new Error(`Unsicherer S3-Key: ${key}`);
  return normalized;
}

let continuationToken;
let count = 0;
do {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: objectPrefix, ContinuationToken: continuationToken }));
  for (const item of listed.Contents || []) {
    if (!item.Key || !item.Key.startsWith(objectPrefix)) continue;
    const relative = safeRelativeKey(item.Key.slice(objectPrefix.length));
    const output = path.join(targetRoot, relative);
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: item.Key }));
    if (!object.Body) throw new Error(`S3-Objekt ohne Inhalt: ${item.Key}`);
    const buffer = Buffer.from(await object.Body.transformToByteArray());
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, buffer);
    count += 1;
  }
  continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
} while (continuationToken);

console.error(`S3-Export ${namespace}: ${count} Objekte`);
