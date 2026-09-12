import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const brand = await read("src/app/components/BrandLogo.tsx");
const marketing = await read("src/app/components/marketing/index.tsx");
const portal = await read("src/app/PortalComponents.tsx");
const customerPortal = await read("src/app/customer/CustomerPortalShell.tsx");
const planner = await read("src/app/verteilung-planen/page.tsx");
const wizard = await read("src/app/customer/orders/new/SmartOrderWizard.tsx");
const email = await read("src/lib/customerEmailTemplate.ts");
const icons = await read("src/app/icon.tsx");
const appleIcon = await read("src/app/apple-icon.tsx");
const metadata = await read("src/app/seo.ts");
const markIcon = await read("public/brand/flyero-icon.svg");
const favicon = await readFile("src/app/favicon.ico");

assert.match(brand, /LOKAL\. EFFEKTIV\. MESSBAR\./);
assert.match(brand, /flyeroBrandBars/);
assert.equal((brand.match(/<i \/>/g) ?? []).length, 3, "Die Wortmarke muss genau drei Balken als E verwenden.");
assert.match(marketing, /return <BrandLogo dark=\{dark\} compact=\{compact\} \/>/);
assert.match(portal, /<FlyeroLogo dark \/>/);
assert.match(customerPortal, /<FlyeroLogo dark \/>/);
assert.match(planner, /<FlyeroLogo dark compact \/>/);
assert.match(wizard, /<FlyeroLogo dark \/>/);
assert.match(email, /LOKAL\. EFFEKTIV\. MESSBAR\./);
assert.match(email, /height:5px;margin:2px 0;background:#b7ff21/);
assert.match(icons, /LOKAL\. EFFEKTIV\. MESSBAR\./);
assert.match(appleIcon, /LOKAL\. EFFEKTIV\. MESSBAR\./);
assert.match(metadata, /flyero-icon\.svg/);
assert.match(markIcon, /#a7ff00/);
assert.equal(favicon.readUInt16LE(2), 1, "Favicon ICO muss einen Bilddatensatz enthalten.");
assert.equal(favicon.readUInt32LE(18), 22, "Favicon ICO-Datensatz muss auf den enthaltenen PNG-Stream zeigen.");
assert.deepEqual([...favicon.subarray(22, 30)], [137, 80, 78, 71, 13, 10, 26, 10]);

console.log("FLYERO brand logo smoke passed.");
