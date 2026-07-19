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

export function geocodeResultMatchesRequestedPostalCode(resultPostalCode: string | null | undefined, query: string) {
  const requestedPostalCode = query.match(/\b(\d{5})\b/)?.[1] ?? null;
  if (!requestedPostalCode) return true;
  return resultPostalCode === requestedPostalCode;
}
