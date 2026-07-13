import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/lib/documents.ts", "utf8");
const rejection = source.slice(source.indexOf("export async function rejectDocument"));
const rejectionBody = rejection.slice(0, rejection.indexOf("export async function addDocumentComment"));

assert.match(rejectionBody, /prisma\.document\.findFirst\(\{\s*where: \{ id, \.\.\.documentWhere\(actor\) \}/s,
  "Dokumentablehnung muss das Dokument vor der Mutation im Tenant-Scope laden.");
assert.match(rejectionBody, /if \(!current\) throw new AuthError/,
  "Eine fremde oder nicht vorhandene Dokument-ID muss vor der Ablehnung abgewiesen werden.");
assert.match(rejectionBody, /prisma\.document\.update\(\{\s*where: \{ id \}/s,
  "Dokumentablehnung muss die gepruefte Dokument-ID aktualisieren.");

console.log("Document review tenant scope smoke ok");
