import assert from "node:assert/strict";
import { geocodeResultMatchesRequestedPostalCode } from "../src/lib/geocodeQuery.ts";

assert.equal(
  geocodeResultMatchesRequestedPostalCode("56170", "56170"),
  true,
  "Ein Google-Ergebnis mit der angefragten PLZ muss akzeptiert werden.",
);
assert.equal(
  geocodeResultMatchesRequestedPostalCode("", "56170"),
  false,
  "Ein Place-ID-Ergebnis ohne PLZ darf eine PLZ-Suche nicht abschließen.",
);
assert.equal(
  geocodeResultMatchesRequestedPostalCode("56112", "56170"),
  false,
  "Ein Ergebnis mit einer anderen PLZ darf nicht als Treffer gelten.",
);
assert.equal(
  geocodeResultMatchesRequestedPostalCode("", "Bendorf"),
  true,
  "Bei Orts-/Adresssuche ohne PLZ darf eine fehlende PLZ akzeptiert werden.",
);

console.log("Google place-id postal fallback checks passed.");
