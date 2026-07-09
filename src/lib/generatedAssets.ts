import { mkdir, readFile, writeFile } from "node:fs/promises";
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
}) {
  const absolutePath = path.join(generatedRoot(), input.kind, input.fileName);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);
  return {
    absolutePath,
    storagePath: `/private/generated/${input.kind}/${input.fileName}`,
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
  const absolutePath = path.join(generatedRoot(), normalizeKind(kind), fileName);
  return {
    absolutePath,
    buffer: await readFile(absolutePath),
    fileName: path.basename(fileName),
  };
}
