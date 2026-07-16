export function parseGeocodeQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  const postalCode = normalized.match(/^(\d{5})(?:\s|$)/)?.[1] ?? null;
  const city = postalCode ? normalized.slice(postalCode.length).trim() : null;

  return {
    normalized,
    postalCode,
    city: city || null,
  };
}
