import assert from "node:assert/strict";

const { aggregateOrderAreaSegments } = await import("../src/lib/orderSegments.ts");

const square = (west, east) => ({
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, 50],
        [east, 50],
        [east, 50.01],
        [west, 50.01],
        [west, 50],
      ]],
    },
  }],
});

const single = aggregateOrderAreaSegments([{ name: "A", geometryGeoJson: square(6, 6.01) }]);
const overlapping = aggregateOrderAreaSegments([
  { name: "A", geometryGeoJson: square(6, 6.01) },
  { name: "B", geometryGeoJson: square(6.005, 6.015) },
]);

assert.ok(single, "Einzelgebiet muss normalisiert werden.");
assert.ok(overlapping, "Mehrere Gebiete muessen normalisiert werden.");
assert.ok(overlapping.totalAreaSqm < single.totalAreaSqm * 2, "Ueberlappende Teilgebiete duerfen nicht doppelt als Flaeche gerechnet werden.");
assert.ok(overlapping.totalAreaSqm > single.totalAreaSqm, "Die nicht ueberlappende Flaeche des zweiten Teilgebiets muss erhalten bleiben.");

console.log("Order segment overlap smoke passed.");
