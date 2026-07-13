import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "public", "generated");

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else files.push(relative.replaceAll("\\", "/"));
  }
  return files;
}

const files = await listFiles(root);
assert(files.every((file) => file.startsWith("marketing/")), "Nicht-Marketing-Artefakt liegt weiterhin im öffentlichen Generated-Ordner.");
assert(!files.some((file) => /^(accounting|invoices|reports|proofs|quarantine)\//.test(file)), "Revisionsrelevantes Generated-Asset ist öffentlich.");

console.log("Public generated artifact privacy smoke checks passed.");
