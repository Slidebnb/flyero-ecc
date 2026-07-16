import {
  DistributorReviewStatus,
  DispatchAssignmentStatus,
  DispatchRejectionReason,
  MobilityType,
  OrderStatus,
  ServiceType,
  UserRole,
  TourStatus,
} from "@prisma/client";

export const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: "/customer/dashboard",
  DISTRIBUTOR: "/distributor/dashboard",
  WAREHOUSE_STAFF: "/warehouse/dashboard",
  ADMIN: "/admin/dashboard",
  SUPPORT_DISPATCHER: "/admin/dispatch",
};

export const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export const WORKING_TIMES = ["Vormittags", "Nachmittags", "Abends"] as const;

export const SERVICE_RADII = [10, 20, 30, 50, 100] as const;

export const MOBILITY_OPTIONS: { value: MobilityType; label: string }[] = [
  { value: "WALK", label: "Zu Fuß" },
  { value: "BIKE", label: "Fahrrad" },
  { value: "CAR", label: "Auto" },
];

export const DISTRIBUTOR_STATUS_LABELS: Record<DistributorReviewStatus, string> = {
  REGISTERED: "Registriert",
  EMAIL_VERIFIED: "E-Mail bestätigt",
  PROFILE_INCOMPLETE: "Profil unvollständig",
  PENDING_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  PAUSED: "Pausiert",
  BANNED: "Gesperrt",
};

export const ADMIN_DISTRIBUTOR_FILTERS = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "BANNED",
] as const;

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  FLYER_DISTRIBUTION: "Flyerverteilung",
  DOOR_HANGER: "Türhänger",
  BROCHURE: "Prospekte",
  MAGAZINE: "Magazine",
  FLYER_STANDARD: "Prospekte & Angebotsblätter",
  CATALOG_DISTRIBUTION: "Kataloge",
  BROCHURE_MAGAZINE: "Broschüren & Magazine",
  VOUCHER_CARD: "Gutscheinkarten",
  POSTCARD_INVITATION: "Postkarten & Einladungskarten",
  EVENT_INVITATION: "Veranstaltungseinladungen",
  COMMUNITY_PUBLICATION: "Vereins- & Gemeindeblätter",
  MENU_DELIVERY_CARD: "Speisekarten & Lieferkarten",
  PRODUCT_SAMPLING: "Produktproben & Sampling",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Entwurf",
  PAYMENT_PENDING: "Zahlung ausstehend",
  PAYMENT_FAILED: "Zahlung fehlgeschlagen",
  SUBMITTED: "Eingereicht",
  UNDER_REVIEW: "In Prüfung",
  ACCEPTED_AWAITING_PAYMENT: "Angenommen, Zahlung ausstehend",
  PAID_WAITING_FOR_ADMIN_REVIEW: "Bezahlt, wartet auf Prüfung",
  WAITING_FOR_CUSTOMER: "Rückfrage erforderlich",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
  CANCELLED: "Storniert",
  READY_FOR_FLYERS: "Bereit für Flyer",
  FLYERS_EXPECTED: "Flyer erwartet",
  FLYERS_RECEIVED: "Flyer angekommen",
  STORED: "Im Lager",
  READY_FOR_PICKUP: "Abholbereit",
  READY_FOR_DISTRIBUTION: "Verteilbereit",
  DISTRIBUTION_APPROVED: "Verteilung freigegeben",
  REPORT_READY_PREVIEW: "Berichtsvorschau bereit",
};

export const CUSTOMER_ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "DRAFT",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED_AWAITING_PAYMENT",
  "PAID_WAITING_FOR_ADMIN_REVIEW",
  "WAITING_FOR_CUSTOMER",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "READY_FOR_FLYERS",
  "FLYERS_EXPECTED",
  "FLYERS_RECEIVED",
  "STORED",
  "READY_FOR_PICKUP",
  "READY_FOR_DISTRIBUTION",
  "DISTRIBUTION_APPROVED",
  "REPORT_READY_PREVIEW",
];

export const ADMIN_ORDER_STATUS_OPTIONS: OrderStatus[] = CUSTOMER_ORDER_STATUS_OPTIONS;

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID_WAITING_FOR_ADMIN_REVIEW", "PAYMENT_FAILED", "CANCELLED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "ACCEPTED_AWAITING_PAYMENT", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "WAITING_FOR_CUSTOMER", "ACCEPTED_AWAITING_PAYMENT", "APPROVED", "REJECTED", "CANCELLED"],
  ACCEPTED_AWAITING_PAYMENT: ["PAYMENT_FAILED", "PAYMENT_PENDING", "UNDER_REVIEW", "APPROVED", "CANCELLED"],
  PAID_WAITING_FOR_ADMIN_REVIEW: ["APPROVED", "REJECTED", "WAITING_FOR_CUSTOMER", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "ACCEPTED_AWAITING_PAYMENT", "PAYMENT_PENDING", "REJECTED", "WAITING_FOR_CUSTOMER", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["SUBMITTED", "UNDER_REVIEW", "CANCELLED"],
  APPROVED: ["READY_FOR_FLYERS", "CANCELLED"],
  READY_FOR_FLYERS: ["FLYERS_EXPECTED", "CANCELLED"],
  FLYERS_EXPECTED: ["FLYERS_RECEIVED", "CANCELLED"],
  FLYERS_RECEIVED: ["STORED"],
  STORED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["READY_FOR_DISTRIBUTION", "DISTRIBUTION_APPROVED", "REPORT_READY_PREVIEW"],
  READY_FOR_DISTRIBUTION: ["DISTRIBUTION_APPROVED", "REPORT_READY_PREVIEW"],
  DISTRIBUTION_APPROVED: ["REPORT_READY_PREVIEW"],
  REPORT_READY_PREVIEW: [],
  REJECTED: [],
  CANCELLED: [],
};

export const WAREHOUSE_INVENTORY_STATUS_LABELS = {
  FLYERS_EXPECTED: "Flyer erwartet",
  FLYERS_RECEIVED: "Flyer angekommen",
  STORED: "Im Lager",
  READY_FOR_PICKUP: "Abholbereit",
  PICKED_UP: "Abgeholt",
  RETURNED: "Zurückgenommen",
} as const;

export const REMAINING_STOCK_STATUS_LABELS = {
  NOT_RELEVANT: "Noch nicht relevant",
  ALLE_VERTEILT: "Alle verteilt",
  RESTBESTAND: "Restbestand",
  ENTSORGT: "Entsorgt",
  RUECKVERSAND: "Rückversand",
} as const;

export const TOUR_STATUS_LABELS: Record<TourStatus, string> = {
  PLANNED: "Geplant",
  ASSIGNED: "Zugewiesen",
  READY: "Bereit",
  PICKED_UP: "Abgeholt",
  PICKUP_CONFIRMED: "Abholung bestätigt",
  STARTED: "Gestartet",
  PAUSED: "Pausiert",
  RESUMED: "Fortgesetzt",
  COMPLETED: "Abgeschlossen",
  UNDER_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  NEEDS_CLARIFICATION: "Rückfrage",
  CANCELLED: "Storniert",
};

export const DISPATCH_STATUS_LABELS: Record<DispatchAssignmentStatus, string> = {
  ASSIGNED: "Angefragt",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  CANCELLED: "Storniert",
  REASSIGNED: "Neu zugewiesen",
};

export const DISPATCH_REJECTION_REASON_LABELS: Record<DispatchRejectionReason, string> = {
  KEINE_ZEIT: "Keine Zeit",
  KRANK: "Krank",
  ZU_WEIT: "Zu weit",
  SONSTIGES: "Sonstiges",
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
