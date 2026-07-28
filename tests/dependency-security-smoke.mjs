import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
const overrides = packageJson.overrides || {};

assert.equal(overrides.postcss, "8.5.19", "PostCSS muss auf dem gepatchten 8.5-Zweig festgeschrieben sein.");
assert.equal(overrides["@hono/node-server"], "1.19.13", "@hono/node-server muss auf der gepatchten Version festgeschrieben sein.");
assert.equal(overrides.minimatch, "10.2.6", "Die ESLint-Kette muss auf dem sicherheitsbereinigten minimatch-Zweig stehen.");
assert.equal(lockfile.packages["node_modules/postcss"]?.version, "8.5.19", "Lockfile verwendet noch eine verwundbare PostCSS-Version.");
const honoVersion = lockfile.packages["node_modules/@hono/node-server"]?.version;
assert.ok(honoVersion === undefined || honoVersion === "1.19.13", "Lockfile darf keine verwundbare Hono-Version enthalten.");
assert.equal(packageJson.devDependencies?.prisma, "7.9.1", "Prisma muss auf dem sicherheitsbereinigten 7.9-Zweig stehen.");
assert.equal(packageJson.dependencies?.["@prisma/client"], "7.9.1", "Prisma Client muss dieselbe sicherheitsbereinigte Version verwenden.");
assert.equal(packageJson.dependencies?.["@prisma/adapter-pg"], "7.9.1", "Prisma-Adapter muss dieselbe Version wie Client und CLI verwenden.");
assert.equal(lockfile.packages["node_modules/prisma"]?.version, "7.9.1", "Lockfile verwendet noch eine verwundbare Prisma-Version.");
assert.equal(lockfile.packages["node_modules/@prisma/client"]?.version, "7.9.1", "Lockfile verwendet noch eine verwundbare Prisma-Client-Version.");
assert.equal(lockfile.packages["node_modules/@prisma/adapter-pg"]?.version, "7.9.1", "Lockfile verwendet noch eine abweichende Prisma-Adapter-Version.");
assert.equal(lockfile.packages["node_modules/minimatch"]?.version, "10.2.6", "Lockfile verwendet noch eine verwundbare minimatch-Version.");

console.log("Dependency security smoke checks passed.");
