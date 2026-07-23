import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourcePath = process.argv.slice(2).find((value) => !value.startsWith("--"));
const layer = process.argv.find((value) => value.startsWith("--layer="))?.slice("--layer=".length) ?? "v_vg250_gem";
const apply = process.argv.includes("--apply");

if (!sourcePath) {
  throw new Error("Verwendung: node scripts/import-vg250-boundaries.mjs <DE_VG250.gpkg> [--layer=v_vg250_gem] [--apply]");
}

const workingDirectory = mkdtempSync(join(tmpdir(), "flyero-vg250-"));
const outputPath = join(workingDirectory, "vg250-gemeinden.geojson");

try {
  execFileSync("ogr2ogr", [
    "-f", "GeoJSON",
    outputPath,
    sourcePath,
    layer,
    "-s_srs", "EPSG:25832",
    "-t_srs", "EPSG:4326",
    "-lco", "RFC7946=YES",
    "-makevalid",
  ], { stdio: "inherit" });

  const env = {
    ...process.env,
    AREA_IMPORT_SOURCE_NAME: "BKG VG250 Verwaltungsgrenzen, Stand 31.12.2025",
    AREA_IMPORT_SOURCE_URL: "https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-250-000-stand-31-12-vg250-12-31.html",
    AREA_IMPORT_LICENSE_NOTE: "Amtliche VG250-Verwaltungsgrenzen des Bundesamts fuer Kartographie und Geodaesie. Lizenz- und Nutzungsbedingungen des Datenanbieters beachten.",
  };
  execFileSync(process.execPath, ["scripts/import-alkis-boundaries.mjs", outputPath, ...(apply ? ["--apply"] : [])], {
    env,
    stdio: "inherit",
  });
} finally {
  rmSync(workingDirectory, { recursive: true, force: true });
}
