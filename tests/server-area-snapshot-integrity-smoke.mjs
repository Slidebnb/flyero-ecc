import assert from "node:assert/strict";
import { buildServerAreaCalculationSnapshot } from "../src/lib/orderAreaSnapshot.ts";

const snapshot = buildServerAreaCalculationSnapshot({
  clientSnapshot: {
    polygonSource: "drawn",
    userEditedPolygon: true,
    selectedSegmentLabels: ["56170 Bendorf"],
    uiMode: "boundary",
    households: 999999,
    confidence: "high",
    grossPrice: "0.01",
    checkoutAllowed: true,
    arbitraryAdminField: "must-not-persist",
  },
  metrics: {
    source: "area-formula",
    confidence: "low",
    households: 842,
    coverageAreaSqm: 105250,
    routeDistanceMeters: 6240,
    routeDurationMinutes: 188,
    calculationVersion: "order-area-v2-multi-segment",
    calculatedAt: "2026-07-19T12:00:00.000Z",
    areaReference: { postalCode: "56170", city: "Bendorf" },
    householdCountSource: "area-interpolation",
    pricingVersion: "premium-distribution-v4",
    pricingRuleSignature: "rule-signature",
    polygonHash: "polygon-hash",
    fingerprint: "quote-fingerprint",
    quote: { fingerprint: "quote-fingerprint", polygonHash: "polygon-hash", netPrice: "599", grossPrice: "712.81" },
    needsManualReview: true,
    segments: [{ name: "Bendorf", households: 842 }],
    warehouseMatches: [{ matchedRegion: false }],
    areaDifficulty: "RURAL",
    areaDifficultyFactor: "1.40",
    derivationReasons: ["warehouse-unmatched"],
  },
});

assert.equal(snapshot.households, 842);
assert.equal(snapshot.confidence, "low");
assert.equal(snapshot.areaDifficulty, "RURAL");
assert.equal(snapshot.pricingVersion, "premium-distribution-v4");
assert.equal(snapshot.quote.fingerprint, "quote-fingerprint");
assert.deepEqual(snapshot.selectedSegmentLabels, ["56170 Bendorf"]);
assert.equal("arbitraryAdminField" in snapshot, false);
assert.equal("grossPrice" in snapshot, false);
assert.equal("checkoutAllowed" in snapshot, false);
console.log("Server area snapshot integrity smoke checks passed.");
