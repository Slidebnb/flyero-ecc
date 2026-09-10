import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile("src/app/admin/AdminActionFeedback.tsx", "utf8");
const shell = await readFile("src/app/admin/AdminPortalShell.tsx", "utf8");
assert.match(component, /document\.addEventListener\("submit"/);
assert.match(component, /sessionStorage/);
assert.match(component, /aria-busy/);
assert.match(component, /Kundeninformation/);
assert.match(shell, /AdminActionFeedback/);
console.log("Admin action feedback smoke passed.");
