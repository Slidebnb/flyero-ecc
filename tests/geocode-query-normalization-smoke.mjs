import assert from "node:assert/strict";
import { parseGeocodeQuery } from "../src/lib/geocodeQuery.ts";

assert.deepEqual(parseGeocodeQuery(" 56170   Bendorf "), {
  normalized: "56170 Bendorf",
  postalCode: "56170",
  city: "Bendorf",
});
assert.deepEqual(parseGeocodeQuery("56112"), {
  normalized: "56112",
  postalCode: "56112",
  city: null,
});
assert.deepEqual(parseGeocodeQuery("Lahnstein"), {
  normalized: "Lahnstein",
  postalCode: null,
  city: null,
});

console.log("Geocode query normalization smoke erfolgreich abgeschlossen.");
