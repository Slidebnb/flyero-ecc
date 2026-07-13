import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const lockfile = JSON.parse(await readFile("package-lock.json", "utf8"));
const overrides = packageJson.overrides || {};

assert.equal(overrides.postcss, "8.5.19", "PostCSS muss auf dem gepatchten 8.5-Zweig festgeschrieben sein.");
assert.equal(overrides["@hono/node-server"], "1.19.13", "@hono/node-server muss auf der gepatchten Version festgeschrieben sein.");
assert.equal(lockfile.packages["node_modules/postcss"]?.version, "8.5.19", "Lockfile verwendet noch eine verwundbare PostCSS-Version.");
assert.equal(lockfile.packages["node_modules/@hono/node-server"]?.version, "1.19.13", "Lockfile verwendet noch eine verwundbare Hono-Version.");

console.log("Dependency security smoke checks passed.");
