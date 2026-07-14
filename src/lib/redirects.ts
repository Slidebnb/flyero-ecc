const ALLOWED_INTERNAL_PREFIXES = ["/customer/", "/register/", "/login"] as const;

function isAllowedPath(pathname: string) {
  return ALLOWED_INTERNAL_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

/** Keeps auth continuation paths on the current application origin. */
export function safeInternalRedirectPath(value: unknown, fallback: string) {
  const safeFallback = fallback === ""
    ? ""
    : fallback.startsWith("/") && !fallback.startsWith("//") && isAllowedPath(new URL(fallback, "https://flyero.invalid").pathname)
      ? fallback
      : "/customer/dashboard";
  if (typeof value !== "string") return safeFallback;

  const candidate = value.trim();
  if (!candidate || candidate.length > 2048 || /[\u0000-\u001f\u007f]/.test(candidate)) return safeFallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return safeFallback;

  try {
    const parsed = new URL(candidate, "https://flyero.invalid");
    if (parsed.origin !== "https://flyero.invalid" || !isAllowedPath(parsed.pathname)) return safeFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

export function roleContinuationFallback(role: string) {
  return role === "DISTRIBUTOR" ? "/distributor/dashboard" : "/customer/dashboard";
}
