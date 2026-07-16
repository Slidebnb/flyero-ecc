import assert from "node:assert/strict";
import {
  hasExplicitPublicLocationContext,
  isGermanPostalCode,
  normalizePublicLocationContext,
  publicLocationSearchParams,
} from "../src/lib/publicLocationContext.ts";

const selected = normalizePublicLocationContext({
  query: "56112 Lahnstein",
  placeId: "ChIJ-authoritative",
  postalCode: "56112",
  city: "Lahnstein",
  lat: "50.3499",
  lng: "7.5946",
  source: "google",
});

assert.deepEqual(selected, {
  query: "56112 Lahnstein",
  placeId: "ChIJ-authoritative",
  postalCode: "56112",
  city: "Lahnstein",
  lat: 50.3499,
  lng: 7.5946,
  source: "google",
});
assert.equal(hasExplicitPublicLocationContext(selected), true);
assert.equal(isGermanPostalCode("56112"), true);

const params = publicLocationSearchParams(selected);
assert.equal(params.toString(), "query=56112+Lahnstein&placeId=ChIJ-authoritative&postalCode=56112&city=Lahnstein&lat=50.3499&lng=7.5946&source=google");

const editedFreeInput = normalizePublicLocationContext({ query: "neuer Ort", placeId: "stale-place", postalCode: "56112", city: "Lahnstein", lat: 50.3, lng: 7.5, source: "manual" });
assert.deepEqual(editedFreeInput, {
  query: "neuer Ort",
  placeId: undefined,
  postalCode: "56112",
  city: "Lahnstein",
  lat: 50.3,
  lng: 7.5,
  source: "manual",
});

const invalidPostal = normalizePublicLocationContext({ query: "999", postalCode: "not-a-postal-code", lat: 51, lng: 10, source: "google", placeId: "place" });
assert.equal(invalidPostal?.postalCode, undefined);
assert.equal(invalidPostal?.lat, 51);
assert.equal(invalidPostal?.lng, 10);

console.log("Public location context checks passed.");
