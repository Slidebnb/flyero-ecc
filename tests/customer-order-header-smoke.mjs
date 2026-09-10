import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("src/app/customer/orders/new/page.tsx", "utf8");
const styles = await readFile("src/app/globals.css", "utf8");
assert.match(page, /href="\/customer\/dashboard"/);
assert.match(page, /className="orderAccountLink"/);
assert.match(page, /Entwurf wird automatisch gespeichert/);
assert.match(page, /Neue Verteilung planen/);
assert.match(styles, /\.orderAccountLink/);
console.log("Customer order header smoke checks passed.");
