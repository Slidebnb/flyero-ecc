export type PublicLocationSource = "google" | "local" | "manual";

export type PublicLocationContext = {
  query: string;
  placeId?: string;
  postalCode?: string;
  city?: string;
  lat?: number;
  lng?: number;
  source?: PublicLocationSource;
};

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function coordinate(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

export function isGermanPostalCode(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{5}$/.test(value.trim()));
}

export function normalizePublicLocationContext(input: Record<string, unknown>): PublicLocationContext | null {
  const query = text(input.query, 120);
  const postalCode = text(input.postalCode, 10);
  const city = text(input.city, 80);
  const placeId = text(input.placeId, 160);
  const lat = coordinate(input.lat, -90, 90);
  const lng = coordinate(input.lng, -180, 180);
  const source = input.source === "google" || input.source === "local" || input.source === "manual"
    ? input.source
    : undefined;

  if (!query && !placeId && !postalCode && !city && (lat === undefined || lng === undefined)) return null;
  return { query: query ?? [postalCode, city].filter(Boolean).join(" "), placeId, postalCode, city, lat, lng, source };
}

export function hasExplicitPublicLocationContext(context: PublicLocationContext | null) {
  return Boolean(context && (context.query || context.placeId || context.postalCode || context.city || (context.lat !== undefined && context.lng !== undefined)));
}

export function publicLocationSearchParams(context: PublicLocationContext) {
  const params = new URLSearchParams();
  if (context.query) params.set("query", context.query);
  if (context.placeId) params.set("placeId", context.placeId);
  if (context.postalCode) params.set("postalCode", context.postalCode);
  if (context.city) params.set("city", context.city);
  if (context.lat !== undefined) params.set("lat", String(context.lat));
  if (context.lng !== undefined) params.set("lng", String(context.lng));
  if (context.source) params.set("source", context.source);
  return params;
}
