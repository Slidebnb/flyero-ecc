const DEFAULT_BASE_URL = "https://meine-heimat-statistik.de/api";
const SOURCE_URL = "https://meine-heimat-statistik.de/api/docs/";

export type MeineHeimatConfig = {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
  householdMetricId?: string;
  valueColumn?: string;
};

export type MeineHeimatExportRequest = {
  outputFormat: "CSV";
  regions: string[];
  lfdnrs: string[];
  years: number[];
};

export type MeineHeimatRecord = {
  regionArs: string;
  metricId: string;
  year: number;
  value: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeRegions(values: unknown) {
  const regions = unique(Array.isArray(values) ? values.map(text).filter(Boolean) : []);
  if (!regions.length || regions.length > 100 || regions.some((value) => !/^\d{12}$/.test(value))) {
    throw new Error("Meine Heimat API: Es werden ein bis 100 gueltige 12-stellige ARS-Regionen benoetigt.");
  }
  return regions;
}

function normalizeMetricIds(values: unknown) {
  const metricIds = unique(Array.isArray(values) ? values.map(text).filter(Boolean) : []);
  if (!metricIds.length || metricIds.length > 20 || metricIds.some((value) => !/^\d+(?:\.\d+){1,5}$/.test(value))) {
    throw new Error("Meine Heimat API: Es wird mindestens ein gueltiger Lfdnr-/Merkmalschluessel benoetigt.");
  }
  return metricIds;
}

function normalizeYears(values: unknown) {
  const years = unique((Array.isArray(values) ? values : []).map((value) => Number(value)).filter((value) => Number.isInteger(value)).map(String)).map(Number);
  if (!years.length || years.length > 10 || years.some((value) => value < 1900 || value > 2200)) {
    throw new Error("Meine Heimat API: Es werden ein bis zehn gueltige Jahre benoetigt.");
  }
  return years;
}

export function buildMeineHeimatExportRequest(input: {
  regions: unknown;
  metricIds: unknown;
  years: unknown;
}): MeineHeimatExportRequest {
  return {
    outputFormat: "CSV",
    regions: normalizeRegions(input.regions),
    lfdnrs: normalizeMetricIds(input.metricIds),
    years: normalizeYears(input.years),
  };
}

export function readMeineHeimatConfig(env: Record<string, string | undefined> = process.env): MeineHeimatConfig {
  const baseUrl = text(env.MEINE_HEIMAT_API_BASE_URL) || DEFAULT_BASE_URL;
  const username = text(env.MEINE_HEIMAT_API_USERNAME);
  const password = text(env.MEINE_HEIMAT_API_PASSWORD);
  const timeoutMs = Math.max(1000, Math.min(Number(env.MEINE_HEIMAT_API_TIMEOUT_MS) || 8000, 30000));
  const householdMetricId = text(env.MEINE_HEIMAT_HOUSEHOLD_LFDNR) || undefined;
  const valueColumn = text(env.MEINE_HEIMAT_VALUE_COLUMN) || undefined;
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("Meine Heimat API: Die Basis-URL muss HTTPS verwenden.");
  return { baseUrl: baseUrl.replace(/\/$/, ""), username, password, timeoutMs, householdMetricId, valueColumn };
}

export async function fetchMeineHeimatExport(input: {
  config: Pick<MeineHeimatConfig, "baseUrl" | "username" | "password" | "timeoutMs">;
  regions: unknown;
  metricIds: unknown;
  years: unknown;
  fetchImpl?: typeof fetch;
}) {
  if (!input.config.username || !input.config.password) {
    throw new Error("Meine Heimat API: Zugangsdaten fehlen.");
  }
  const request = buildMeineHeimatExportRequest({ regions: input.regions, metricIds: input.metricIds, years: input.years });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);
  try {
    const response = await (input.fetchImpl ?? fetch)(`${input.config.baseUrl.replace(/\/$/, "")}/v1/export`, {
      method: "POST",
      headers: {
        accept: "text/csv",
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from(`${input.config.username}:${input.config.password}`).toString("base64")}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Meine Heimat API: Export fehlgeschlagen (HTTP ${response.status}).`);
    return { text: await response.text(), sourceUrl: SOURCE_URL, request };
  } finally {
    clearTimeout(timeout);
  }
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizedHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberValue(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/[€%]/g, "");
  const german = normalized.includes(",") && (!normalized.includes(".") || normalized.lastIndexOf(",") > normalized.lastIndexOf("."));
  const parsed = german
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMeineHeimatCsv(textValue: string, input: { regions: string[]; metricId: string; year: number; valueColumn?: string }): MeineHeimatRecord[] {
  const lines = textValue.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => {
    const header = line.split(/[;\t,]/).map(normalizedHeader);
    return header.some((value) => value === "ars" || value.includes("region")) && header.some((value) => value === "jahr" || value === "year");
  });
  if (headerIndex < 0) throw new Error("Meine Heimat API: CSV-Kopfzeile mit Region und Jahr fehlt.");
  const headerLine = lines[headerIndex];
  const delimiter = headerLine.includes(";") ? ";" : headerLine.includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(headerLine, delimiter).map(normalizedHeader);
  const regionIndex = headers.findIndex((value) => value === "ars" || value.includes("region"));
  const yearIndex = headers.findIndex((value) => value === "jahr" || value === "year");
  const metricIndex = headers.findIndex((value) => value.includes("lfdnr") || value.includes("merkmal") || value === "metricid");
  const requestedValueColumn = normalizedHeader(input.valueColumn ?? "");
  const valueIndex = requestedValueColumn
    ? headers.findIndex((value) => value === requestedValueColumn)
    : headers.findIndex((value) => ["wert", "value", "anzahl", "count"].includes(value));
  if (regionIndex < 0 || yearIndex < 0 || valueIndex < 0) throw new Error("Meine Heimat API: CSV benoetigt Region, Jahr und eine Wertspalte.");
  const regionSet = new Set(input.regions);
  const records = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const columns = splitDelimitedLine(line, delimiter);
    const regionArs = columns[regionIndex];
    const year = Number(columns[yearIndex]);
    const metricId = metricIndex >= 0 ? columns[metricIndex] : input.metricId;
    const value = numberValue(columns[valueIndex] ?? "");
    if (!regionSet.has(regionArs) || year !== input.year || metricId !== input.metricId || value == null || value < 0) continue;
    records.push({ regionArs, metricId, year, value });
  }
  return records;
}

export const meineHeimatStatisticsSource = SOURCE_URL;
