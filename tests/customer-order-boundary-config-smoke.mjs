import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
const compose = fs.readFileSync("docker-compose.production.yml", "utf8");
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const envExample = fs.readFileSync(".env.production.example", "utf8");
const wizard = fs.readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(dockerfile, /ARG NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED=/, "Docker must expose the boundary configuration at build time.");
assert.match(dockerfile, /ENV NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED=\$NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED/, "Docker must keep the boundary configuration available during the build.");
assert.match(compose, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:\s*\$\{NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:-false\}/, "Compose must pass the boundary configuration as a build argument.");
assert.match(nextConfig, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED:/, "Next must expose the boundary configuration to the client build.");
assert.match(envExample, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED="true"/, "The production template must document the boundary configuration.");
assert.match(wizard, /NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED\s*===\s*"true"/, "The optional Google boundary layer must remain explicitly gated.");
assert.match(wizard, /const boundarySelectionEnabled = officialBoundaries\.length > 0;/, "Selection must be enabled by loaded official FLYERO boundaries.");
assert.match(wizard, /new maps\.Polygon\(\{[\s\S]{0,1200}clickable: true,/, "Loaded official boundaries must be rendered as clickable map polygons.");
assert.match(wizard, /maps\.event\.addListener\(overlay, "click", \(\) => \{\s*selectOfficialBoundary\(area\);/, "Each rendered boundary must register a click listener.");
assert.match(wizard, /selectOfficialBoundary\(area\);/, "A click on an official boundary must apply that area to the plan.");
assert.match(wizard, /setSelectedBoundaryPlaceIds\(\(current\) => current\.includes\(placeId\)/, "A selected boundary must be tracked for visual selection state.");

console.log("Customer order boundary configuration checks passed.");
