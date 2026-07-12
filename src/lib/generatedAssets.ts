import { readPrivateObject, writePrivateObject } from "@/lib/privateObjectStorage";
import { readFile } from "node:fs/promises";
import path from "node:path";

const GENERATED_KINDS = ["accounting", "invoices", "reports", "proofs"] as const;

type GeneratedKind = (typeof GENERATED_KINDS)[number];

function generatedRoot() {
  return process.env.GENERATED_ASSET_ROOT || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "generated");
}

function normalizeKind(kind: string): GeneratedKind {
  if ((GENERATED_KINDS as readonly string[]).includes(kind)) return kind as GeneratedKind;
  throw new Error(`Unbekannte Generated-Asset-Art: ${kind}`);
}

export async function writeGeneratedAsset(input: {
  kind: GeneratedKind;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}) {
  const key = `${input.kind}/${input.fileName}`;
  const stored = await writePrivateObject({
    namespace: "generated",
    key,
    localRoot: generatedRoot(),
    buffer: input.buffer,
    contentType: input.contentType || "application/octet-stream",
  });
  return {
    absolutePath: path.join(generatedRoot(), key),
    storagePath: `/private/generated/${input.kind}/${input.fileName}`,
    size: stored.size,
  };
}

export async function readGeneratedAsset(storagePath: string) {
  const relative = storagePath.replace(/^\/+/, "");
  if (relative.startsWith("generated/")) {
    const legacyPath = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", relative);
    return {
      absolutePath: legacyPath,
      buffer: await readFile(legacyPath),
      fileName: path.basename(relative),
    };
  }
  const normalized = relative.startsWith("private/generated/") ? relative.slice("private/generated/".length) : relative;
  const [kind, ...rest] = normalized.split("/");
  const fileName = rest.join("/");
  if (!kind || !fileName) throw new Error("Generated Asset Pfad ist ungueltig.");
  const key = `${normalizeKind(kind)}/${fileName}`;
  const stored = await readPrivateObject({ namespace: "generated", key, localRoot: generatedRoot() });
  return { absolutePath: path.join(generatedRoot(), key), buffer: stored.buffer, fileName: path.basename(fileName) };
}
