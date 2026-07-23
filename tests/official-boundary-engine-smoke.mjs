import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("prisma/migrations/20260723100000_add_postgis_area_engine/migration.sql", "utf8");
const spatialAreas = readFileSync("src/lib/spatialAreas.ts", "utf8");
const orderSegments = readFileSync("src/lib/orderSegments.ts", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const wizardTypes = readFileSync("src/app/customer/orders/new/orderWizardTypes.ts", "utf8");
const route = readFileSync("src/app/api/maps/official-boundaries/route.ts", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const compose = readFileSync("docker-compose.production.yml", "utf8");

assert.match(migration, /CREATE EXTENSION IF NOT EXISTS postgis/i);
assert.match(migration, /USING GIST/i);
assert.match(migration, /ST_GeomFromGeoJSON/i);
assert.match(spatialAreas, /ST_Intersects/);
assert.match(spatialAreas, /ST_AsGeoJSON/);
assert.match(orderSegments, /MultiPolygon/);
assert.match(orderSegments, /geometry\.coordinates\.flatMap/);
assert.match(smartMaps, /residentialBuildings/);
assert.match(smartMaps, /buildingCountSource/);
assert.match(wizardTypes, /residentialBuildings\?: number \| null/);
assert.match(spatialAreas, /dataSourceType.*OFFICIAL.*IMPORTED.*LICENSED/s);
assert.match(spatialAreas, /information_schema\.columns/);
assert.match(spatialAreas, /findOfficialBoundaries[\s\S]*spatialGeometryAvailable/);
assert.match(spatialAreas, /if \(!\(await spatialGeometryAvailable\(\)\)\)/);
assert.match(route, /findOfficialBoundaries/);
assert.match(wizard, /\/api\/maps\/official-boundaries/);
assert.doesNotMatch(wizard, /if \(!mapsReady \|\| latitude == null/);
assert.match(wizard, /officialBoundaryOverlaysRef/);
assert.match(wizard, /geometryGeoJson: area\.geoJson/);
assert.match(wizard, /segment\.geometryGeoJson \?\? polygonToGeoJson\(segment\.points\)/);
assert.match(compose, /postgis\/postgis:16-3\.5/);

console.log("Official PostGIS boundary engine smoke test passed.");
