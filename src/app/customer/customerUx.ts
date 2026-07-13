import type {
  DocumentStatus,
  NotificationChannel,
  NotificationQueueStatus,
  OrderStatus,
  PrintStatus,
  ReportStatus,
} from "@prisma/client";

export type CustomerTone = "neutral" | "success" | "warning" | "danger";

export const CUSTOMER_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Entwurf",
  PAYMENT_PENDING: "Zahlung offen",
  PAYMENT_FAILED: "Zahlung fehlgeschlagen",
  SUBMITTED: "Anfrage eingereicht",
  UNDER_REVIEW: "Wird geprüft",
  PAID_WAITING_FOR_ADMIN_REVIEW: "Bezahlt, wird geprüft",
  WAITING_FOR_CUSTOMER: "Rückfrage offen",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  CANCELLED: "Storniert",
  READY_FOR_FLYERS: "Flyer oder Druckdaten fehlen",
  FLYERS_EXPECTED: "Flyer werden erwartet",
  FLYERS_RECEIVED: "Flyer angekommen",
  STORED: "Flyer im Lager",
  READY_FOR_PICKUP: "Abholung vorbereitet",
  READY_FOR_DISTRIBUTION: "Verteilung geplant",
  DISTRIBUTION_APPROVED: "Verteilung geprüft",
  REPORT_READY_PREVIEW: "Bericht verfügbar",
};

export const CUSTOMER_DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Hochgeladen",
  UNDER_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Bitte korrigieren",
  ARCHIVED: "Archiviert",
};

export const CUSTOMER_PRINT_STATUS_LABELS: Record<PrintStatus, string> = {
  REQUESTED: "Druck angefragt",
  APPROVED: "Druck freigegeben",
  IN_PRODUCTION: "Im Druck",
  SHIPPED: "Auf dem Weg",
  DELIVERED: "Geliefert",
  RECEIVED_IN_WAREHOUSE: "Im Lager angekommen",
  READY_FOR_DISTRIBUTION: "Bereit für Verteilung",
  CANCELLED: "Storniert",
};

export const CUSTOMER_REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Bericht wird vorbereitet",
  DATA_INCOMPLETE: "Nachweise werden gesammelt",
  GENERATED: "Nachweis erstellt",
  READY_FOR_REVIEW: "Bericht wird geprüft",
  IN_REVIEW: "Bericht wird geprüft",
  CHANGES_REQUIRED: "Bericht wird überarbeitet",
  APPROVED: "Prüfung bestanden",
  PUBLISHED: "Nachweis verfügbar",
  ARCHIVED: "Archiviert",
  RELEASED_TO_CUSTOMER: "Nachweis verfügbar",
  REGENERATING: "Bericht wird aktualisiert",
};

export const CUSTOMER_QUEUE_STATUS_LABELS: Record<NotificationQueueStatus, string> = {
  PENDING: "Wird zugestellt",
  SENDING: "Wird zugestellt",
  SENT: "Gesendet",
  FAILED: "Aktion erforderlich",
  RETRY: "Wird erneut zugestellt",
};

export const CUSTOMER_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: "Im Portal",
  EMAIL: "per E-Mail",
  WHATSAPP: "per WhatsApp",
  SMS: "per SMS",
  PUSH: "per Push",
};

const CUSTOMER_NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE_AVAILABLE: "Ihre Rechnung ist verfügbar",
  CUSTOMER_REPORT_AVAILABLE: "Ihr Verteilbericht ist fertig",
  CUSTOMER_ORDER_CREATED: "Ihre Kampagne wurde erstellt",
  CUSTOMER_PAYMENT_FAILED: "Zahlung fehlgeschlagen",
  ORDER_PRICE_UPDATED: "Preisvorschau aktualisiert",
  PAYMENT_FAILED: "Zahlung fehlgeschlagen",
  PAYMENT_SUCCESS: "Zahlung erhalten",
  PAYMENT_COMPLETED: "Zahlung abgeschlossen",
  PAYMENT_REFUNDED: "Erstattung vorgemerkt",
  DOCUMENT_UPLOADED: "Druckdatei hochgeladen",
  DOCUMENT_APPROVED: "Druckdatei freigegeben",
  DOCUMENT_REJECTED: "Druckdatei bitte prüfen",
  PRINT_ORDER_REQUESTED: "Druckauftrag angefragt",
  PRINT_PRODUCTION_STARTED: "Druck gestartet",
  PRINT_SHIPPED: "Druck versendet",
  PRINT_RECEIVED_IN_WAREHOUSE: "Flyer im Lager angekommen",
  PRINT_STATUS_UPDATED: "Druckstatus aktualisiert",
  REPORT_AVAILABLE: "Verteilbericht fertig",
  REPORT_PUBLISHED: "Verteilbericht verfügbar",
  ORDER_STATUS_UPDATED: "Kampagnenstatus aktualisiert",
  SUPPORT_REPLY: "Neue Support-Antwort",
};

const CUSTOMER_PREFERENCE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE_AVAILABLE: "Rechnungen erhalten",
  CUSTOMER_REPORT_AVAILABLE: "Verteilberichte erhalten",
  CUSTOMER_ORDER_CREATED: "Kampagnen-Updates erhalten",
  CUSTOMER_PAYMENT_FAILED: "Zahlungshinweise erhalten",
  ORDER_PRICE_UPDATED: "Preisänderungen erhalten",
  DOCUMENT_APPROVED: "Druckdaten-Freigaben erhalten",
  DOCUMENT_REJECTED: "Druckdaten-Rückfragen erhalten",
  PRINT_STATUS_UPDATED: "Druckstatus erhalten",
  SUPPORT_REPLY: "Support-Nachrichten erhalten",
};

export function customerOrderName(orderNumber: string) {
  return orderNumber
    .replace(/^DEMO-ORD-/i, "Kampagne #")
    .replace(/^DEMO-WH-/i, "Kampagne #")
    .replace(/^DEMO-DISP-/i, "Kampagne #")
    .replace(/^DEMO-/i, "Kampagne #")
    .replace(/^ORD-/i, "Kampagne #");
}

export function customerReportName(reportNumber: string) {
  return reportNumber
    .replace(/^RPT-SEED-/i, "Verteilbericht #")
    .replace(/^RPT-/i, "Verteilbericht #");
}

export function customerTicketName(ticketNumber: string) {
  return ticketNumber
    .replace(/^FLY-TK-\d{4}-/i, "Nachricht #")
    .replace(/^FLY-TK-/i, "Nachricht #");
}

export function customerOrderTone(status: OrderStatus): CustomerTone {
  if (["DISTRIBUTION_APPROVED", "REPORT_READY_PREVIEW"].includes(status)) return "success";
  if (["PAYMENT_FAILED", "REJECTED", "CANCELLED"].includes(status)) return "danger";
  if (["PAYMENT_PENDING", "WAITING_FOR_CUSTOMER", "PAID_WAITING_FOR_ADMIN_REVIEW", "READY_FOR_FLYERS"].includes(status)) return "warning";
  return "neutral";
}

export function customerOrderAction(status: OrderStatus, orderId: string) {
  if (status === "READY_FOR_FLYERS") return { href: "/customer/documents", label: "Druckdaten hochladen" };
  if (status === "PAYMENT_PENDING") return { href: `/customer/orders/${orderId}`, label: "Zahlung abschließen" };
  if (status === "PAYMENT_FAILED") return { href: `/customer/orders/${orderId}`, label: "Zahlung erneut versuchen" };
  if (status === "REPORT_READY_PREVIEW" || status === "DISTRIBUTION_APPROVED") return { href: "/customer/reports", label: "Bericht ansehen" };
  if (status === "READY_FOR_DISTRIBUTION" || status === "READY_FOR_PICKUP") return { href: `/customer/orders/${orderId}`, label: "Fortschritt ansehen" };
  if (status === "STORED" || status === "FLYERS_RECEIVED" || status === "FLYERS_EXPECTED") return { href: `/customer/orders/${orderId}`, label: "Status ansehen" };
  return { href: `/customer/orders/${orderId}`, label: "Kampagne öffnen" };
}

export function customerOrderPlainNextStep(status: OrderStatus) {
  if (status === "PAYMENT_PENDING") return "Zahlung abschließen, damit FLYERO prüfen kann.";
  if (status === "PAYMENT_FAILED") return "Zahlung erneut versuchen oder Anfrage senden.";
  if (status === "READY_FOR_FLYERS") return "Flyerdatei hochladen oder Druck über FLYERO anfragen.";
  if (status === "WAITING_FOR_CUSTOMER") return "FLYERO wartet auf eine Rückmeldung von Ihnen.";
  if (status === "PAID_WAITING_FOR_ADMIN_REVIEW" || status === "UNDER_REVIEW") return "FLYERO prüft Gebiet, Druckdaten und Zustellbarkeit.";
  if (status === "READY_FOR_DISTRIBUTION" || status === "READY_FOR_PICKUP") return "Die Verteilung wird vorbereitet.";
  if (status === "DISTRIBUTION_APPROVED" || status === "REPORT_READY_PREVIEW") return "Der Bericht ist bereit oder wird final freigegeben.";
  if (status === "CANCELLED") return "Diese Kampagne wurde storniert.";
  if (status === "REJECTED") return "Diese Kampagne konnte nicht freigegeben werden.";
  return "Alles ist gespeichert. FLYERO meldet sich, wenn ein Schritt nötig ist.";
}

export function customerNotificationTypeLabel(type: string) {
  if (CUSTOMER_NOTIFICATION_TYPE_LABELS[type]) return CUSTOMER_NOTIFICATION_TYPE_LABELS[type];
  if (type.startsWith("ADMIN_")) return "Interne Bearbeitung";
  if (type.startsWith("DISTRIBUTOR_")) return "Verteilung geplant";
  if (type.startsWith("MODULE") || type.includes("QUEUE") || type.includes("SEED")) return "Statusupdate";
  return "Kundenhinweis";
}

export function customerPreferenceLabel(type: string) {
  if (CUSTOMER_PREFERENCE_LABELS[type]) return CUSTOMER_PREFERENCE_LABELS[type];
  if (type.includes("INVOICE")) return "Rechnungen erhalten";
  if (type.includes("REPORT")) return "Verteilberichte erhalten";
  if (type.includes("PAYMENT")) return "Zahlungshinweise erhalten";
  if (type.includes("SUPPORT")) return "Support-Nachrichten erhalten";
  return "Statusupdates erhalten";
}

export function safeCustomerSubject(type: string, subject: string) {
  const mapped = customerNotificationTypeLabel(type);
  return /MODULE|SEED|QUEUE|CUSTOMER_|ADMIN_|DISTRIBUTOR_|DEMO-|Auto-Dispatch|localhost|Touren im Dashboard/i.test(subject) ? mapped : subject;
}

export function safeCustomerMessage(type: string, body: string) {
  if (!/MODULE|SEED|QUEUE|Smoke-Fixture|CUSTOMER_|ADMIN_|DISTRIBUTOR_|DEMO-|Auto-Dispatch|localhost|Touren im Dashboard|Auftrag\s+[A-Z0-9-]+/i.test(body)) return body;
  return `${customerNotificationTypeLabel(type)}. Wir melden uns, sobald ein nächster Schritt für Sie nötig ist.`;
}

export function customerSafeText(value: string | null | undefined, fallback: string) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  if (/Seed Modul|seed\.module|Smoke|Module\s+\d+|Modul\s+\d+|Fixture|DEMO-|localhost|UNDER_REVIEW|READY_FOR_REVIEW|EXTERNAL_GPS_REPORT|INTERNAL_TRACKING|OrderStatus|ReportStatus/i.test(text)) {
    return fallback;
  }
  return text;
}

export function customerAreaName(value: string | null | undefined) {
  return customerSafeText(value, "Verteilgebiet wird geprüft");
}

export function customerSafeFilename(value: string | null | undefined, extension?: string | null) {
  const cleanExtension = extension ? `.${extension.replace(/^\./, "").toLowerCase()}` : "";
  return customerSafeText(value, `Kundendatei${cleanExtension}`);
}
