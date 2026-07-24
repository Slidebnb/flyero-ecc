import assert from "node:assert/strict";
import { resolveAreaSubmissionContext } from "../src/app/customer/orders/new/areaSubmission.ts";

const polygon = [
  { lat: 50.35, lng: 7.58 },
  { lat: 50.36, lng: 7.58 },
  { lat: 50.36, lng: 7.59 },
];

const resolved = resolveAreaSubmissionContext({
  segments: [{ name: "Bendorf", city: "", postalCode: "", points: polygon }],
  city: "",
  postalCode: "",
  selectedLocation: { city: "Bendorf", postalCode: "56170" },
  targetAreaName: "",
});

assert.equal(resolved.hasValidArea, true, "Ein ausgewähltes Polygon muss als gültiges Gebiet gelten.");
assert.equal(resolved.city, "Bendorf", "Der Ort darf durch leere Segmentwerte nicht verloren gehen.");
assert.equal(resolved.postalCode, "56170", "Die PLZ muss aus der gewählten Standortinformation erhalten bleiben.");
assert.equal(resolved.targetAreaName, "Bendorf", "Der Abschluss muss einen gültigen Gebietsname senden.");

console.log("Customer selected-area completion regression checks passed.");
