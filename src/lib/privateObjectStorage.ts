import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type PrivateStorageProvider = "local" | "s3";

type PrivateObjectInput = {
  namespace: string;
  key: string;
  localRoot: string;
  buffer: Buffer;
  contentType?: string;
  checksum?: string;
};

type PrivateObjectReadInput = {
  namespace: string;
  key: string;
  localRoot: string;
};

let client: S3Client | null = null;

export function privateStorageProvider(): PrivateStorageProvider {
  const provider = (process.env.FILE_STORAGE_PROVIDER || "local").toLowerCase();
  if (provider !== "local" && provider !== "s3") {
    throw new Error("FILE_STORAGE_PROVIDER muss local oder s3 sein.");
  }
  return provider;
}

function requiredStorageEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ist für den S3-Storage erforderlich.`);
  return value;
}

function objectKey(namespace: string, key: string) {
  const normalizedNamespace = namespace.trim().replace(/^\/+|\/+$/g, "");
  const normalizedKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalizedNamespace || !normalizedKey || normalizedKey.split("/").includes("..")) {
    throw new Error("Ungültiger privater Storage-Key.");
  }
  const prefix = process.env.S3_PREFIX?.trim().replace(/^\/+|\/+$/g, "");
  return [prefix, normalizedNamespace, normalizedKey].filter(Boolean).join("/");
}

function s3Client() {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  client = new S3Client({
    region: process.env.S3_REGION?.trim() || "eu-central-1",
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: requiredStorageEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredStorageEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

function localPath(localRoot: string, key: string) {
  const root = path.resolve(localRoot);
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Privater Storage-Key verlässt den konfigurierten Speicherpfad.");
  }
  return resolved;
}

function bucket() {
  return requiredStorageEnv("S3_BUCKET");
}

export function privateStorageConfiguration() {
  const provider = privateStorageProvider();
  return {
    provider,
    configured: provider === "local" || Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
  };
}

export async function writePrivateObject(input: PrivateObjectInput) {
  if (privateStorageProvider() === "s3") {
    await s3Client().send(new PutObjectCommand({
      Bucket: bucket(),
      Key: objectKey(input.namespace, input.key),
      Body: input.buffer,
      ContentType: input.contentType || "application/octet-stream",
      Metadata: input.checksum ? { checksum: input.checksum } : undefined,
    }));
    return { storageKey: input.key, size: input.buffer.byteLength };
  }

  const absolutePath = localPath(input.localRoot, input.key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return { storageKey: input.key, size: input.buffer.byteLength };
}

export async function readPrivateObject(input: PrivateObjectReadInput) {
  if (privateStorageProvider() === "s3") {
    const response = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: objectKey(input.namespace, input.key) }));
    if (!response.Body) throw new Error("Privates Storage-Objekt enthält keine Datei.");
    const buffer = Buffer.from(await response.Body.transformToByteArray());
    return { buffer, size: buffer.byteLength };
  }

  const absolutePath = localPath(input.localRoot, input.key);
  const [buffer, metadata] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  return { buffer, size: metadata.size };
}

export async function movePrivateObject(input: {
  namespace: string;
  sourceKey: string;
  targetKey: string;
  localRoot: string;
  contentType?: string;
  checksum?: string;
}) {
  if (input.sourceKey === input.targetKey) return;
  const source = await readPrivateObject({ namespace: input.namespace, key: input.sourceKey, localRoot: input.localRoot });
  await writePrivateObject({
    namespace: input.namespace,
    key: input.targetKey,
    localRoot: input.localRoot,
    buffer: source.buffer,
    contentType: input.contentType,
    checksum: input.checksum,
  });

  if (privateStorageProvider() === "s3") {
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey(input.namespace, input.sourceKey) }));
    return;
  }
  await unlink(localPath(input.localRoot, input.sourceKey));
}
