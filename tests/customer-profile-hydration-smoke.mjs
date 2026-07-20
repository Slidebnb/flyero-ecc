import { readFileSync } from "node:fs";

const profile = readFileSync("src/app/customer/profile/page.tsx", "utf8");
const inputCount = (profile.match(/<input\b/g) || []).length;
const suppressedCount = (profile.match(/suppressHydrationWarning\b/g) || []).length;

if (inputCount === 0 || suppressedCount !== inputCount) {
  throw new Error("Kundenprofil-Eingaben muessen gegen browserseitige Autofill-Attributaenderungen hydration-stabil gerendert werden.");
}

console.log("customer-profile-hydration-smoke: ok");
