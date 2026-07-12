import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { readPrivateObject, writePrivateObject, movePrivateObject } from "@/lib/privateObjectStorage";
import { approvalRequiresCleanScan, scanFileBuffer, type FileScanStatus } from "@/lib/fileScanning";

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
  scanStatus: FileScanStatus;
  scanProvider: string;
  scanMessage: string | null;
  quarantined: boolean;
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

function startsWithBytes(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

function textStartsWith(buffer: Buffer, pattern: RegExp) {
  const text = buffer.subarray(0, 8192).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  return pattern.test(text);
}

export function detectDocumentMimeType(extension: string, buffer: Buffer) {
  const isZip = startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]);
  const isPdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isPng = startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
  const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const isPostScript = buffer.subarray(0, 4).toString("ascii") === "%!PS";

  if (extension === "pdf" && !isPdf) throw new Error("Die PDF-Datei hat keine gültige PDF-Signatur.");
  if (extension === "png" && !isPng) throw new Error("Die PNG-Datei hat keine gültige Bildsignatur.");
  if (["jpg", "jpeg"].includes(extension) && !isJpeg) throw new Error("Die JPG-Datei hat keine gültige Bildsignatur.");
  if (extension === "webp" && !isWebp) throw new Error("Die WEBP-Datei hat keine gültige Bildsignatur.");
  if (["zip", "docx", "xlsx", "pptx", "kmz"].includes(extension) && !isZip) throw new Error("Die ZIP-Datei hat keine gültige Archivsignatur.");
  if (extension === "svg" && !textStartsWith(buffer, /<svg[\s>]/i)) throw new Error("Die SVG-Datei enthält kein gültiges SVG-Dokument.");
  if (extension === "gpx" && !textStartsWith(buffer, /<(?:\?xml[\s>]|gpx[\s>])/i)) throw new Error("Die GPX-Datei enthält kein gültiges XML-Dokument.");
  if (extension === "kml" && !textStartsWith(buffer, /<(?:\?xml[\s>]|kml[\s>])/i)) throw new Error("Die KML-Datei enthält kein gültiges XML-Dokument.");
  if (extension === "ai" && !isPdf && !isPostScript) throw new Error("Die Illustrator-Datei hat keine gültige PostScript-/PDF-Signatur.");

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    ai: "application/postscript",
    indd: "application/octet-stream",
    gpx: "application/gpx+xml",
    kml: "application/vnd.google-earth.kml+xml",
    kmz: "application/vnd.google-earth.kmz",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return mimeTypes[extension] || "application/octet-stream";
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

  detectDocumentMimeType(extension, input.buffer);
  return extension;
}

export async function storeDocumentFile(input: UploadableDocumentFile): Promise<StoredDocumentFile> {
  const extension = validateDocumentFile(input);
  const checksum = createHash("sha256").update(input.buffer).digest("hex");
  const scan = await scanFileBuffer(input);
  if (approvalRequiresCleanScan({ mode: scan.mode, status: scan.status })) {
    throw new Error(`Datei konnte nicht freigegeben werden: ${scan.message || "Malware-Scan nicht erfolgreich."}`);
  }
  const quarantined = scan.status !== "CLEAN" && scan.mode !== "disabled";
  const prefix = quarantined ? "quarantine/" : "";
  const storageKey = `${prefix}${new Date().getFullYear()}/${new Date().getMonth() + 1}/${randomUUID()}.${extension}`;
  await writePrivateObject({
    namespace: "documents",
    key: storageKey,
    localRoot: storageRoot(),
    buffer: input.buffer,
    contentType: detectDocumentMimeType(extension, input.buffer),
    checksum,
  });

  return {
    storageKey,
    checksum,
    fileSize: input.buffer.byteLength,
    extension,
    mimeType: detectDocumentMimeType(extension, input.buffer),
    scanStatus: scan.status,
    scanProvider: scan.provider,
    scanMessage: scan.message,
    quarantined,
  };
}

export async function promoteQuarantinedDocument(input: { storageKey: string; contentType: string; checksum: string }) {
  if (!input.storageKey.startsWith("quarantine/")) return input.storageKey;
  const targetKey = input.storageKey.slice("quarantine/".length);
  await movePrivateObject({
    namespace: "documents",
    sourceKey: input.storageKey,
    targetKey,
    localRoot: storageRoot(),
    contentType: input.contentType,
    checksum: input.checksum,
  });
  return targetKey;
}

export async function readStoredDocument(storageKey: string) {
  return readPrivateObject({ namespace: "documents", key: storageKey, localRoot: storageRoot() });
}

export function protectedDocumentUrl(documentId: string, version?: number) {
  const query = version ? `?version=${version}` : "";
  return `/api/customer/documents/${documentId}/download${query}`;
}
