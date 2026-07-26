import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/lib/payments.ts", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const { buildAppliedStripePromotion } = await import("../src/lib/stripePromotion.ts");

assert.match(
  source,
  /allow_promotion_codes:\s*true/,
  "Stripe Checkout muss die Eingabe von Promotion Codes erlauben.",
);
assert.match(
  source,
  /const stripeAmount\s*=\s*session\.amount_total\s*===\s*null[\s\S]{0,140}session\.amount_total\s*===\s*undefined/,
  "Die Zahlungsverbuchung muss einen bestaetigten Stripe-Betrag von 0 akzeptieren.",
);
assert.match(
  source,
  /total_details\?\.amount_discount|promotionCode|promotion_code/i,
  "Die bestaetigte Stripe-Rabattinformation muss fuer Audit und Order-Abgleich gespeichert werden.",
);
assert.equal(
  packageJson.scripts["test:stripe-promotion-codes"],
  "node --experimental-strip-types tests/stripe-promotion-codes-smoke.mjs",
  "Der Promotion-Code-Regressionstest muss als npm-Script verfuegbar sein.",
);

const fullyDiscounted = buildAppliedStripePromotion({
  session: {
    id: "cs_test_promotion",
    amount_total: 0,
    currency: "eur",
    total_details: { amount_discount: 59900 },
  },
  baseNet: "599.00",
  baseVat: "113.81",
  baseGross: "712.81",
  vatRate: "0.19",
});
assert.equal(fullyDiscounted?.finalGross, "0", "Ein 100-%-Rabatt muss als 0,00 EUR verbucht werden.");
assert.equal(fullyDiscounted?.discountGross, "599", "Der bestaetigte Rabattbetrag muss gespeichert werden.");

console.log("Stripe promotion code smoke checks passed.");
