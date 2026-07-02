type AddressLike = {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  federalState?: string | null;
  country?: string | null;
};

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function formatAddress(value: unknown) {
  const address = asObject(value) as AddressLike;
  const line1 = [address.street, address.houseNumber].filter(Boolean).join(" ");
  const line2 = [address.postalCode, address.city].filter(Boolean).join(" ");
  const line3 = [address.federalState, address.country].filter(Boolean).join(", ");

  return [line1, line2, line3].filter(Boolean).join("\n") || "-";
}

export function formatDate(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatCurrency(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : value && typeof value === "object" && "toString" in value
          ? Number(value.toString())
          : 0;

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(amount) ? amount : 0);
}
