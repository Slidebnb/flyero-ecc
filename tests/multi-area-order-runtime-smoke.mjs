import assert from "node:assert/strict";
import { aggregateOrderAreaSegments } from "../src/lib/orderSegments.ts";

function square(lng, lat, size = 0.001) {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng, lat],
          [lng + size, lat],
          [lng + size, lat + size],
          [lng, lat + size],
          [lng, lat],
        ]],
      },
    }],
  };
}

const result = aggregateOrderAreaSegments([
  { name: "Koblenz", city: "Koblenz", postalCode: "56068", geometryGeoJson: square(7.58, 50.35) },
  { name: "Bendorf", city: "Bendorf", postalCode: "56170", geometryGeoJson: square(7.40, 50.42) },
  { name: "Neuwied", city: "Neuwied", postalCode: "56564", geometryGeoJson: square(7.46, 50.43) },
]);

assert.ok(result);
assert.equal(result.segments.length, 3);
assert.equal(result.targetAreaGeoJson.features.length, 3);
assert.ok(result.totalAreaSqm > 0);
assert.deepEqual(result.segments.map((segment) => segment.city), ["Koblenz", "Bendorf", "Neuwied"]);

const reduced = aggregateOrderAreaSegments([
  { name: "Koblenz", city: "Koblenz", postalCode: "56068", geometryGeoJson: square(7.58, 50.35) },
  { name: "Bendorf", city: "Bendorf", postalCode: "56170", geometryGeoJson: square(7.40, 50.42) },
]);
assert.ok(reduced);
assert.ok(reduced.totalAreaSqm < result.totalAreaSqm);

console.log("Multi-area order runtime checks passed.");
