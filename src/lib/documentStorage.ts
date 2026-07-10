import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "ai",
  "indd",
  "gpx",
  "kml",
  "kmz",
  "docx",
  "xlsx",
  "pptx",
] as const;

export type StoredDocumentFile = {
  storageKey: string;
  checksum: string;
  fileSize: number;
  extension: string;
  mimeType: string;
};

export type UploadableDocumentFile = {
  originalFilename: string;
  mimeType?: string | null;
  buffer: Buffer;
};

function storageRoot() {
  return process.env.DOCUMENT_STORAGE_ROOT || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "documents");
}

export function maxDocumentFileSize() {
  return Number(process.env.DOCUMENT_MAX_FILE_SIZE_BYTES || 25 * 1024 * 1024);
}

export function normalizeExtension(filename: string) {
  return path.extname(filename).replace(".", "").toLowerCase();
}

export function validateDocumentFile(input: UploadableDocumentFile) {
  const extension = normalizeExtension(input.originalFilename);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
    throw new Error(`Dateityp .${extension || "unbekannt"} ist nicht erlaubt.`);
  }

  if (input.buffer.byteLength <= 0) {
    throw new Error("Die Datei ist leer.");
  }

  if (input.buffer.byteLength > maxDocumentFileSize()) {
    throw new Error(`Datei ist zu groß. Maximal erlaubt: ${Math.round(maxDocumentFileSize() / 1024 / 1024)} MB.`);
  }

  return extension;
}

export async function storeDocumentFile(input: UploadableDocumentFile): Promise<StoredDocumentFile> {
  const extension = validateDocumentFile(input);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");
  const storageKey = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${randomUUID()}.${extension}`;
  const absolutePath = path.join(storageRoot(), storageKey);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  return {
    storageKey,
    checksum,
    fileSize: input.buffer.byteLength,
    extension,
    mimeType: input.mimeType || "application/octet-stream",
  };
}

export async function readStoredDocument(storageKey: string) {
  const absolutePath = path.join(storageRoot(), storageKey);
  const [buffer, metadata] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  return { buffer, size: metadata.size };
}

export function protectedDocumentUrl(documentId: string, version?: number) {
  const query = version ? `?version=${version}` : "";
  return `/api/customer/documents/${documentId}/download${query}`;
}
