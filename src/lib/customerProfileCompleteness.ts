import type { Prisma } from "@prisma/client";

export type BillingProfileField =
  | "companyName"
  | "contactName"
  | "phone"
  | "billingStreet"
  | "billingPostalCode"
  | "billingCity";

export type CustomerProfileLike = {
  companyName: string;
  contactName: string;
  phone: string;
  billingAddress: Prisma.JsonValue;
};

export type CustomerProfileCompleteness = {
  complete: boolean;
  missingFields: BillingProfileField[];
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getCustomerProfileCompleteness(customer: CustomerProfileLike): CustomerProfileCompleteness {
  const billing = customer.billingAddress && typeof customer.billingAddress === "object" && !Array.isArray(customer.billingAddress)
    ? customer.billingAddress as Record<string, unknown>
    : {};
  const checks: Array<[BillingProfileField, unknown]> = [
    ["companyName", customer.companyName],
    ["contactName", customer.contactName],
    ["phone", customer.phone],
    ["billingStreet", billing.street],
    ["billingPostalCode", billing.postalCode],
    ["billingCity", billing.city],
  ];
  const missingFields = checks.filter(([, value]) => !hasText(value)).map(([field]) => field);
  return { complete: missingFields.length === 0, missingFields };
}

export const BILLING_PROFILE_FIELD_LABELS: Record<BillingProfileField, string> = {
  companyName: "Firma",
  contactName: "Ansprechpartner",
  phone: "Telefon",
  billingStreet: "Rechnungsstraße",
  billingPostalCode: "Rechnungs-PLZ",
  billingCity: "Rechnungsstadt",
};
