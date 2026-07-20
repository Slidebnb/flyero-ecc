import { z } from "zod";
import {
  ADMIN_ORDER_STATUS_OPTIONS,
  SERVICE_RADII,
  WEEKDAYS,
  WORKING_TIMES,
} from "@/lib/constants";
import { normalizeServiceProductFormat } from "@/lib/serviceCatalog";

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.");

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Passwort ist erforderlich."),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

export const passwordResetSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const addressSchema = z.object({
  street: z.string().min(1),
  houseNumber: z.string().optional(),
  postalCode: z.string().min(3),
  city: z.string().min(1),
  federalState: z.string().optional(),
  country: z.string().default("DE"),
});

const checkboxArray = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]));

const preferredAreasInput = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : value.split(/[,;\n]/)))
  .pipe(z.array(z.string().trim().min(2).max(120)).min(1).max(50));

const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().positive().optional(),
);

const optionalNonNegativeInt = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().nonnegative().optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? undefined : value === "on" || value === "true" || value === true),
  z.boolean().optional(),
);

const optionalJson = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return undefined;
    }
  });

const samplingProductDetails = z.object({
  sampleType: z.string().trim().min(2),
  size: z.string().trim().min(2),
  packaging: z.string().trim().min(2),
  storage: z.string().trim().min(2),
  fragile: z.boolean(),
  personalHandover: z.boolean(),
}).passthrough();

const optionalOrderAreaSegments = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  },
  z.array(z.record(z.string(), z.unknown())).max(50).optional(),
);

export const customerRegisterSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: optionalText,
  billingStreet: optionalText,
  billingHouseNumber: optionalText,
  billingPostalCode: optionalText,
  billingCity: optionalText,
  deliveryStreet: optionalText,
  deliveryHouseNumber: optionalText,
  deliveryPostalCode: optionalText,
  deliveryCity: optionalText,
  vatId: optionalText,
  logoUrl: optionalText,
  password: passwordSchema,
});

export const customerProfileUpdateSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  phone: z.string().min(6),
  billingStreet: z.string().min(1),
  billingHouseNumber: optionalText,
  billingPostalCode: z.string().min(3),
  billingCity: z.string().min(1),
  deliveryStreet: optionalText,
  deliveryHouseNumber: optionalText,
  deliveryPostalCode: optionalText,
  deliveryCity: optionalText,
  vatId: optionalText,
  logoUrl: optionalText,
  currentPassword: optionalText,
  newPassword: optionalText,
});

export const customerProfileCompletionSchema = z.object({
  orderId: z.string().min(1),
  companyName: z.string().min(2),
  contactName: z.string().min(2),
  phone: z.string().min(6),
  billingStreet: z.string().min(1),
  billingHouseNumber: optionalText,
  billingPostalCode: z.string().min(3),
  billingCity: z.string().min(1),
  vatId: optionalText,
});

export const distributorRegisterSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  birthDate: z.coerce.date(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().min(6),
  street: z.string().min(1),
  houseNumber: z.string().min(1),
  postalCode: z.string().min(3),
  city: z.string().min(1),
  federalState: z.string().min(2),
  mobilityTypes: checkboxArray.pipe(z.array(z.enum(["WALK", "BIKE", "CAR"])).min(1)),
  preferredAreas: preferredAreasInput,
  availabilityDays: checkboxArray.pipe(z.array(z.enum(WEEKDAYS)).min(1)),
  workingTimes: checkboxArray.pipe(z.array(z.enum(WORKING_TIMES)).min(1)),
  serviceRadiusKm: z.coerce.number().refine(
    (value) => SERVICE_RADII.includes(value as (typeof SERVICE_RADII)[number]),
    "Ungueltiger Einsatzradius.",
  ),
  taxNumber: optionalText,
  bankAccountOwner: optionalText,
  iban: optionalText,
  acceptsTerms: z.coerce.boolean().refine(Boolean),
  password: passwordSchema,
});

export const distributorProfileUpdateSchema = distributorRegisterSchema
  .omit({ email: true, password: true, acceptsTerms: true })
  .extend({
    taxNumber: optionalText,
    bankAccountOwner: optionalText,
    iban: optionalText,
  });

export const adminDistributorUpdateSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED", "PAUSED", "BANNED"]),
  adminNotes: optionalText,
});

function earliestOrderStartDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
}

export const orderCreateSchema = z
  .object({
    serviceType: z.enum([
      "FLYER_DISTRIBUTION",
      "DOOR_HANGER",
      "BROCHURE",
      "MAGAZINE",
      "FLYER_STANDARD",
      "CATALOG_DISTRIBUTION",
      "BROCHURE_MAGAZINE",
      "VOUCHER_CARD",
      "POSTCARD_INVITATION",
      "EVENT_INVITATION",
      "COMMUNITY_PUBLICATION",
      "MENU_DELIVERY_CARD",
      "PRODUCT_SAMPLING",
    ]),
    city: z.string().min(2),
    postalCode: z.string().min(3),
    street: optionalText,
    houseNumber: optionalText,
    placeId: optionalText,
    locationSource: z.enum(["google", "local", "manual"]).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    targetAreaName: z.string().min(2),
    areaType: z.enum(["POSTAL_CODE", "CITY", "DISTRICT", "POLYGON", "RADIUS"]).optional(),
    distributionAreaId: optionalText,
    targetAreaGeoJson: optionalJson,
    estimatedHouseholds: z.coerce.number().int().positive().optional(),
    estimatedFlyers: optionalNonNegativeInt,
    estimatedDistanceMeters: optionalNonNegativeInt,
    coverageAreaSqm: optionalPositiveNumber,
    areaCalculationSnapshot: optionalJson,
      areaSegments: optionalOrderAreaSegments,
      quoteFingerprint: z.preprocess(
        (value) => (typeof value === "string" && !value.trim() ? undefined : value),
        z.string().regex(/^[a-f0-9]{64}$/, "Die Preisvorschau ist abgelaufen. Bitte aktualisiere die Planung.").optional(),
      ),
      centerLat: z.coerce.number().optional(),
    centerLng: z.coerce.number().optional(),
    radiusMeters: optionalNonNegativeInt,
    weightClass: z.enum(["LIGHT", "STANDARD", "MEDIUM", "HEAVY", "CUSTOM"]).optional().default("LIGHT"),
    weightInGrams: z.coerce.number().int().min(1).max(10000).optional(),
    areaDifficulty: z.enum(["NORMAL", "MIXED", "LOW_DENSITY", "RURAL", "HARD"]).optional().default("NORMAL"),
    clientDifficultyHint: z.enum(["NORMAL", "MIXED", "LOW_DENSITY", "RURAL", "HARD"]).optional(),
    flyerQuantity: z.coerce.number().int().min(100, "Die Mindestmenge beträgt 100 Stück."),
    flyerSource: z.enum(["CUSTOMER_OWN", "PRINT_SERVICE"]),
    warehouseId: z.string().trim().min(1).optional(),
    productFormat: z.string().trim().min(2).max(80).optional().default("DIN Lang (99 x 210 mm)"),
    productDetails: optionalJson,
    printDataStatus: z.enum(["UPLOADED", "UPLOAD_LATER", "PRINT_REQUESTED"]).optional().default("UPLOAD_LATER"),
    completionPath: z.enum(["direct_payment", "inquiry", "document_email"]).optional().default("direct_payment"),
    preferredStartDate: z.coerce.date(),
    preferredEndDate: z.coerce.date(),
    flexibleScheduling: z.coerce.boolean().optional().default(false),
    notes: optionalText,
    contactPerson: optionalText,
    contactPhone: optionalText,
  })
  .refine((data) => data.preferredStartDate >= earliestOrderStartDate(), {
    message: "Der früheste Start ist sieben Tage nach heute möglich.",
    path: ["preferredStartDate"],
  })
  .refine((data) => data.preferredEndDate >= data.preferredStartDate, {
    message: "Bis-spaetestens-Datum muss nach dem Wunschtermin liegen.",
    path: ["preferredEndDate"],
  })
  .refine((data) => data.locationSource !== "google" || Boolean(data.placeId), {
    message: "Bitte wÃ¤hle den Ort aus der Standortliste aus.",
    path: ["placeId"],
  })
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: "Standortkoordinaten mÃ¼ssen vollstÃ¤ndig Ã¼bermittelt werden.",
    path: ["latitude"],
  })
  .refine((data) => data.productFormat?.replace(" x ", " × ") === normalizeServiceProductFormat(data.serviceType, data.productFormat), {
    message: "Bitte wähle ein passendes Format für das ausgewählte Werbemittel.",
    path: ["productFormat"],
  })
  .refine((data) => data.completionPath !== "direct_payment" || Boolean(data.quoteFingerprint), {
    message: "Bitte aktualisiere zuerst die Preisvorschau.",
    path: ["quoteFingerprint"],
  })
  .refine((data) => {
    if (data.serviceType !== "PRODUCT_SAMPLING") return true;
    return Boolean(data.weightInGrams) && samplingProductDetails.safeParse(data.productDetails).success;
  }, {
    message: "Bitte ergänze Art, Größe, Verpackung, Gewicht und Lagerbedingungen der Produktprobe.",
    path: ["productDetails"],
  });

export const orderUpdateSchema = orderCreateSchema.extend({
  status: z.enum(["DRAFT", "PAYMENT_PENDING"]).optional(),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum(ADMIN_ORDER_STATUS_OPTIONS),
  note: optionalText,
  adminCustomerMessage: optionalText,
});

export const adminOrderPriceSchema = z.object({
  manualPriceOverride: z.coerce.number().positive(),
  note: optionalText,
});

export const adminOrderNoteSchema = z.object({
  adminInternalNotes: optionalText,
  adminCustomerMessage: optionalText,
});

export const warehouseCheckinSchema = z.object({
  orderId: z.string().min(1),
  warehouseId: z.string().min(1),
  warehouseLocationId: z.string().min(1),
  cartonCount: z.coerce.number().int().positive(),
  receivedFlyers: z.coerce.number().int().nonnegative(),
  damagedFlyers: z.coerce.number().int().nonnegative().default(0),
  weightOptional: optionalPositiveNumber,
  notes: optionalText,
});

export const warehouseLocationAssignSchema = z.object({
  inventoryId: z.string().min(1),
  warehouseLocationId: z.string().min(1),
});

export const warehouseStatusSchema = z.object({
  inventoryId: z.string().min(1),
  status: z.enum(["FLYERS_EXPECTED", "FLYERS_RECEIVED", "STORED", "READY_FOR_PICKUP", "PICKED_UP", "RETURNED"]),
  remainingFlyers: optionalNonNegativeInt,
  remainingStockStatus: z.enum(["NOT_RELEVANT", "ALLE_VERTEILT", "RESTBESTAND", "ENTSORGT", "RUECKVERSAND"]).optional(),
  notes: optionalText,
});

export const warehouseQrSchema = z.object({
  inventoryId: z.string().min(1),
});

export const warehouseLocationCreateSchema = z.object({
  warehouseId: z.string().min(1),
  aisle: z.string().min(1),
  shelf: z.string().min(1),
  compartment: z.string().min(1),
});

export const logisticsWarehouseUpdateSchema = z.object({
  name: optionalText,
  code: optionalText,
  city: optionalText,
  postalCode: optionalText,
  country: optionalText,
  region: optionalText,
  latitude: optionalPositiveNumber.or(z.coerce.number().optional()),
  longitude: optionalPositiveNumber.or(z.coerce.number().optional()),
  openingHours: optionalText,
  contactPerson: optionalText,
  contactPhone: optionalText,
  contactEmail: optionalText,
  capacityLimit: optionalNonNegativeInt,
  currentUtilization: optionalNonNegativeInt,
  notes: optionalText,
  isActive: optionalBoolean,
  isDefault: optionalBoolean,
});

export const logisticsShipmentCreateSchema = z.object({
  orderId: z.string().min(1),
  printOrderId: optionalText,
  warehouseId: z.string().min(1),
  shipmentType: z.enum(["CUSTOMER_TO_WAREHOUSE", "PRINTER_TO_WAREHOUSE", "WAREHOUSE_TO_WAREHOUSE", "WAREHOUSE_TO_DISTRIBUTOR", "RETURN_TO_CUSTOMER", "DISPOSAL"]),
  status: z.enum(["CREATED", "IN_TRANSIT", "DELIVERED", "RECEIVED", "DAMAGED", "LOST", "CANCELLED"]).optional(),
  carrier: optionalText,
  trackingNumber: optionalText,
  senderName: optionalText,
  senderAddress: optionalJson,
  recipientName: optionalText,
  recipientAddress: optionalJson,
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: optionalText,
});

export const logisticsShipmentUpdateSchema = z.object({
  status: z.enum(["CREATED", "IN_TRANSIT", "DELIVERED", "RECEIVED", "DAMAGED", "LOST", "CANCELLED"]).optional(),
  carrier: optionalText,
  trackingNumber: optionalText,
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: optionalText,
});

export const warehouseTransferCreateSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  inventoryId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  notes: optionalText,
});

export const warehouseTransferUpdateSchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "IN_TRANSIT", "RECEIVED", "CANCELLED"]),
  notes: optionalText,
});

export const warehouseStockCountCreateSchema = z.object({
  warehouseId: z.string().min(1),
  inventoryId: z.string().min(1),
  expectedQuantity: z.coerce.number().int().nonnegative(),
  countedQuantity: z.coerce.number().int().nonnegative(),
  notes: optionalText,
});

const optionalGpsNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().optional(),
);

export const adminTourAssignSchema = z.object({
  inventoryId: z.string().min(1),
  distributorId: z.string().min(1),
});

export const adminDispatchAssignSchema = z.object({
  distributorId: z.string().min(1),
  segmentId: z.string().min(1).optional(),
  returnTo: z.string().regex(/^\/admin\/(orders\/[^/?]+|dispatch)(\?.*)?$/).optional(),
});

export const distributorDispatchRejectSchema = z.object({
  assignmentId: z.string().min(1).optional(),
  reason: z.enum(["KEINE_ZEIT", "KRANK", "ZU_WEIT", "SONSTIGES"]),
  note: optionalText,
});

export const areaSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["POSTAL_CODE", "CITY", "DISTRICT", "POLYGON", "RADIUS", "CUSTOM", "DELIVERY_ZONE"]).optional(),
  areaType: z.enum(["POSTAL_CODE", "CITY", "DISTRICT", "POLYGON", "RADIUS", "CUSTOM", "DELIVERY_ZONE"]).optional(),
  city: optionalText,
  postalCode: optionalText,
  district: optionalText,
  state: optionalText,
  country: optionalText,
  centerLat: z.coerce.number().optional(),
  centerLng: z.coerce.number().optional(),
  radiusMeters: optionalNonNegativeInt,
  geoJson: optionalJson,
  targetAreaGeoJson: optionalJson,
  geometryGeoJson: optionalJson,
  estimatedHouseholds: optionalNonNegativeInt,
  estimatedFlyers: optionalNonNegativeInt,
  estimatedDistanceMeters: optionalNonNegativeInt,
  coverageAreaSqm: optionalPositiveNumber,
  areaKm2: optionalPositiveNumber,
  googlePlaceId: optionalText,
  googleFeatureType: optionalText,
  dataSourceName: optionalText,
  dataSourceType: z.enum(["SEED", "ADMIN", "OFFICIAL", "LICENSED", "IMPORTED", "ESTIMATED"]).optional(),
  dataSourceUrl: optionalText,
  licenseNote: optionalText,
  dataUpdatedAt: z.coerce.date().optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  householdEstimateMethod: z.enum(["MANUAL", "SEED", "IMPORT", "AUTOMATIC", "ADMIN_ENTRY", "OFFICIAL_IMPORT", "LICENSED_IMPORT", "AREA_INTERPOLATION", "BUILDING_ESTIMATE"]).optional(),
  householdSource: optionalText,
  householdSourceUrl: optionalText,
  householdSourceYear: optionalNonNegativeInt,
  householdNotes: optionalText,
  reusable: optionalBoolean,
}).transform((data) => ({
  ...data,
  type: data.type ?? data.areaType ?? "POLYGON",
  geoJson: data.geoJson ?? data.targetAreaGeoJson,
  geometryGeoJson: data.geometryGeoJson ?? data.geoJson ?? data.targetAreaGeoJson,
}));

export const areaAssignSchema = z.object({
  areaId: z.string().min(1),
});

export const tourPickupSchema = z.object({
  qrCode: z.string().min(1),
});

export const tourGpsPointSchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  accuracy: optionalGpsNumber,
  speed: optionalGpsNumber,
  heading: optionalGpsNumber,
  altitude: optionalGpsNumber,
  battery: z.coerce.number().int().min(0).max(100).optional(),
  recordedAt: z.coerce.date().optional(),
  source: z.string().optional(),
  clientId: z.string().max(120).optional(),
  sequence: z.coerce.number().int().nonnegative().optional(),
  status: z.string().optional(),
});

export const tourGpsUploadSchema = z.object({
  points: z.array(tourGpsPointSchema).min(1),
});

export const tourPhotoSchema = z.object({
  imageDataUrl: z.string().min(1).optional(),
  lat: optionalGpsNumber,
  lng: optionalGpsNumber,
  accuracy: optionalGpsNumber,
  takenAt: z.coerce.date().optional(),
}).refine((data) => data.imageDataUrl, {
  message: "Foto ist erforderlich.",
});

export const tourCompleteSchema = z.object({
  remainingFlyers: z.coerce.number().int().nonnegative(),
  notes: optionalText,
});

export const adminTourReviewSchema = z.object({
  note: optionalText,
  customerMessage: optionalText,
});

export const adminTourNoteSchema = z.object({
  adminInternalNote: optionalText,
  adminCustomerMessage: optionalText,
});
