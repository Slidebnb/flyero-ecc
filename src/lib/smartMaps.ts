import { AreaDataSourceType, HouseholdEstimateMethod, Prisma, type DistributionAreaType } from "@prisma/client";
import { estimateHouseholds, estimateRouteDistanceMeters, calculateDistributionTime, scoreArea, combineOrders } from "@/lib/routing";
import { findBestWarehouseForArea } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { calculateOrderPrice } from "@/lib/pricing";
import { aggregateOrderAreaSegments, type NormalizedOrderAreaSegment } from "@/lib/orderSegments";
import { buildAuthoritativePlanningQuote, buildPlanningInputFingerprint, planningGeometry } from "@/lib/planningQuote";

export type SmartPlaceSuggestion = {
  id: string;
  label: string;
  description: string;
  city: string;
  postalCode: string;
  street?: string | null;
  lat: number;
  lng: number;
  source: "local" | "google";
};

const LOCAL_PLACES: SmartPlaceSuggestion[] = [
  { id: "local-56068", label: "56068 Koblenz Zentrum", description: "Altstadt, Mitte, Rheinanlagen", city: "Koblenz", postalCode: "56068", lat: 50.3569, lng: 7.589, source: "local" },
  { id: "local-56070", label: "56070 Koblenz-Lützel", description: "Lützel, Neuendorf, Wallersheim", city: "Koblenz", postalCode: "56070", lat: 50.3761, lng: 7.5897, source: "local" },
  { id: "local-56072", label: "56072 Koblenz-Metternich", description: "Metternich, Rübenach, Güls", city: "Koblenz", postalCode: "56072", lat: 50.3669, lng: 7.5251, source: "local" },
  { id: "local-56170", label: "56170 Bendorf", description: "Bendorf und Sayn", city: "Bendorf", postalCode: "56170", lat: 50.437, lng: 7.575, source: "local" },
  { id: "local-56564", label: "56564 Neuwied Innenstadt", description: "Neuwied Mitte und Rheinquartier", city: "Neuwied", postalCode: "56564", lat: 50.4285, lng: 7.4607, source: "local" },
  { id: "local-56112", label: "56112 Lahnstein", description: "Oberlahnstein und Niederlahnstein", city: "Lahnstein", postalCode: "56112", lat: 50.3067, lng: 7.6079, source: "local" },
  { id: "local-56626", label: "56626 Andernach", description: "Innenstadt und Südstadt", city: "Andernach", postalCode: "56626", lat: 50.4398, lng: 7.4009, source: "local" },
  { id: "local-50667", label: "50667 Köln Innenstadt", description: "Altstadt-Nord, City", city: "Köln", postalCode: "50667", lat: 50.9384, lng: 6.9571, source: "local" },
  { id: "local-60311", label: "60311 Frankfurt am Main", description: "Innenstadt, Altstadt, Bankenviertel", city: "Frankfurt am Main", postalCode: "60311", lat: 50.1109, lng: 8.6821, source: "local" },
];

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function googleAutocomplete(query: string): Promise<SmartPlaceSuggestion[]> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key || query.trim().length < 3) return [];
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", query);
  url.searchParams.set("key", key);
  url.searchParams.set("components", "country:de");
  url.searchParams.set("language", "de");
  url.searchParams.set("types", "geocode");
  const response = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!response.ok) return [];
  const payload = await response.json() as {
    predictions?: Array<{ place_id: string; description: string; structured_formatting?: { main_text?: string; secondary_text?: string } }>;
  };
  return (payload.predictions ?? []).slice(0, 6).map((item) => ({
    id: item.place_id,
    label: item.structured_formatting?.main_text ?? item.description,
    description: item.structured_formatting?.secondary_text ?? item.description,
    city: "",
    postalCode: "",
    lat: 0,
    lng: 0,
    source: "google",
  }));
}

export async function getPlaceAutocomplete(query: string, options?: { publicOnly?: boolean }) {
  const needle = normalize(query);
  const local = options?.publicOnly
    ? []
    : LOCAL_PLACES.filter((place) => {
        const haystack = normalize(`${place.label} ${place.description} ${place.city} ${place.postalCode}`);
        return haystack.includes(needle) || needle.includes(normalize(place.postalCode));
      }).slice(0, 6);
  const google = await googleAutocomplete(query).catch(() => []);
  return [...local, ...google].slice(0, 8);
}

async function googleGeocode(query: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key || query.trim().length < 3) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", key);
  url.searchParams.set("components", "country:DE");
  url.searchParams.set("language", "de");
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return null;
  const payload = await response.json() as {
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
    }>;
  };
  const results = payload.results ?? [];
  const first = results.find((item) => {
    const types = item.address_components.flatMap((component) => component.types);
    return types.includes("postal_code") || types.includes("locality") || types.includes("postal_town") || types.includes("route");
  });
  if (!first) return null;
  const component = (type: string) => first.address_components.find((item) => item.types.includes(type));
  return {
    label: first.formatted_address,
    city: component("locality")?.long_name ?? component("postal_town")?.long_name ?? "",
    postalCode: component("postal_code")?.long_name ?? "",
    street: component("route")?.long_name ?? "",
    houseNumber: component("street_number")?.long_name ?? "",
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    source: "google" as const,
  };
}

export async function geocodeSmartAddress(input: {
  query?: string;
  postalCode?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
}, options?: { publicOnly?: boolean }) {
  const query = input.query || [input.street, input.houseNumber, input.postalCode, input.city, "Deutschland"].filter(Boolean).join(" ");
  const needle = normalize(query);
  const google = await googleGeocode(query).catch(() => null);
  if (google) return google;
  if (options?.publicOnly) return null;
  const local = LOCAL_PLACES.find((place) => needle.includes(normalize(place.postalCode)) || needle.includes(normalize(place.city)));
  return local
    ? { ...local, houseNumber: "", source: "local" as const }
    : null;
}

function compactArea(area: {
  id: string;
  name: string;
  type: DistributionAreaType;
  city: string | null;
  postalCode: string | null;
  district: string | null;
  estimatedHouseholds: number | null;
  estimatedFlyers: number | null;
  estimatedDistanceMeters: number | null;
  coverageAreaSqm: Prisma.Decimal | null;
  geoJson: Prisma.JsonValue | null;
  centerLat: Prisma.Decimal | null;
  centerLng: Prisma.Decimal | null;
  radiusMeters: number | null;
}) {
  return {
    id: area.id,
    name: area.name,
    type: area.type,
    city: area.city,
    postalCode: area.postalCode,
    district: area.district,
    estimatedHouseholds: area.estimatedHouseholds,
    estimatedFlyers: area.estimatedFlyers,
    estimatedDistanceMeters: area.estimatedDistanceMeters,
    coverageAreaSqm: area.coverageAreaSqm ? Number(area.coverageAreaSqm) : null,
    geoJson: area.geoJson,
    centerLat: area.centerLat ? Number(area.centerLat) : null,
    centerLng: area.centerLng ? Number(area.centerLng) : null,
    radiusMeters: area.radiusMeters,
  };
}

function estimateSourceLabel(method?: HouseholdEstimateMethod | null, source?: string | null) {
  if (method === "SEED") return source ? `seed:${source}` : "seed:distribution-area";
  if (method === "IMPORT") return source ? `import:${source}` : "import:area-household-estimate";
  if (method === "MANUAL") return source ? `manual:${source}` : "manual:area-form";
  if (method === "AUTOMATIC") return source ? `automatic:${source}` : "automatic:area-formula";
  return "area-density-formula";
}

function confidenceForEstimate(
  method?: HouseholdEstimateMethod | null,
  source?: string | null,
  sourceType?: AreaDataSourceType | null,
  sourceYear?: number | null,
  hasAreaData = false,
) {
  if ((sourceType === "OFFICIAL" || sourceType === "LICENSED") && sourceYear) return "high" as const;
  if ((method === "OFFICIAL_IMPORT" || method === "LICENSED_IMPORT") && source && sourceYear) return "high" as const;
  if (method === "IMPORT" && source && !source.toLowerCase().includes("seed")) return "medium" as const;
  if (method === "SEED" || source?.toLowerCase().includes("seed")) return "medium" as const;
  if (method === "MANUAL" || method === "AUTOMATIC" || hasAreaData) return "medium" as const;
  return "low" as const;
}

function densityFromArea(area?: {
  coverageAreaSqm: Prisma.Decimal | null;
  estimatedHouseholds: number | null;
}) {
  const coverage = area?.coverageAreaSqm ? Number(area.coverageAreaSqm) : 0;
  const households = area?.estimatedHouseholds ?? 0;
  if (!coverage || !households) return null;
  return Math.max(35, Math.min(5000, coverage / households));
}

function confidenceRank(value?: "high" | "medium" | "low" | null) {
  return value === "low" ? 0 : value === "medium" ? 1 : 2;
}

function lowestConfidence(values: Array<"high" | "medium" | "low">) {
  return values.sort((left, right) => confidenceRank(left) - confidenceRank(right))[0] ?? "low";
}

function areaReferenceForSegment(segment: NormalizedOrderAreaSegment, areas: Array<{
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  coverageAreaSqm: Prisma.Decimal | null;
  estimatedHouseholds: number | null;
  dataSourceType: AreaDataSourceType;
  dataSourceName: string | null;
  dataSourceUrl: string | null;
  licenseNote: string | null;
  dataUpdatedAt: Date | null;
  confidence: Prisma.Decimal | null;
  estimates: Array<{
    method: HouseholdEstimateMethod;
    source: string | null;
    sourceUrl: string | null;
    sourceYear: number | null;
    confidence: Prisma.Decimal | null;
  }>;
  }>
) {
  return areas.find((area) => segment.distributionAreaId && area.id === segment.distributionAreaId)
    ?? areas.find((area) => Boolean(segment.postalCode && area.postalCode === segment.postalCode))
    ?? areas.find((area) => Boolean(segment.city && area.city?.toLowerCase() === segment.city.toLowerCase()));
}

export async function getOrderIntelligence(input: {
  tenantId?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  distributionAreaId?: string | null;
  flyerQuantity?: number | null;
  households?: number | null;
  coverageAreaSqm?: number | null;
  distanceMeters?: number | null;
  perimeterMeters?: number | null;
  targetAreaGeoJson?: unknown;
  flyerSource?: "CUSTOMER_OWN" | "PRINT_SERVICE";
  printDataStatus?: "UPLOADED" | "UPLOAD_LATER" | "PRINT_REQUESTED";
  preferredStartDate?: string | Date | null;
  preferredEndDate?: string | Date | null;
  segments?: unknown;
  includeOperationalData?: boolean;
  publicOnly?: boolean;
}) {
  const parsedAreaSelection = input.segments ? aggregateOrderAreaSegments(input.segments) : null;
  const areaSelection = parsedAreaSelection?.segments.length ? parsedAreaSelection : null;
  const planning = planningGeometry({
    flyerQuantity: input.flyerQuantity ?? 0,
    city: input.city,
    postalCode: input.postalCode,
    targetAreaGeoJson: input.targetAreaGeoJson,
    areaSegments: input.segments,
    coverageAreaSqm: input.coverageAreaSqm,
    perimeterMeters: input.perimeterMeters,
    flyerSource: input.flyerSource,
    printDataStatus: input.printDataStatus,
    preferredStartDate: input.preferredStartDate,
    preferredEndDate: input.preferredEndDate,
  });
  const quoteFingerprint = buildPlanningInputFingerprint({
    flyerQuantity: input.flyerQuantity ?? 0,
    city: input.city,
    postalCode: input.postalCode,
    street: input.street,
    houseNumber: input.houseNumber,
    targetAreaGeoJson: input.targetAreaGeoJson,
    areaSegments: input.segments,
    coverageAreaSqm: planning.coverageAreaSqm ?? input.coverageAreaSqm,
    perimeterMeters: planning.perimeterMeters,
    flyerSource: input.flyerSource,
    printDataStatus: input.printDataStatus,
    preferredStartDate: input.preferredStartDate,
    preferredEndDate: input.preferredEndDate,
  });
  const primarySegment = areaSelection?.primarySegment ?? null;
  const effectiveCity = primarySegment?.city ?? input.city;
  const effectivePostalCode = primarySegment?.postalCode ?? input.postalCode;
  const effectiveCoverageAreaSqm = planning.coverageAreaSqm ?? areaSelection?.totalAreaSqm ?? input.coverageAreaSqm;
  const areaFilters = [
    input.distributionAreaId ? { id: input.distributionAreaId } : null,
    effectiveCity ? { city: { equals: effectiveCity, mode: "insensitive" as const } } : null,
    effectivePostalCode ? { postalCode: { startsWith: effectivePostalCode.slice(0, 3) } } : null,
    input.street ? { name: { contains: input.street, mode: "insensitive" as const } } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const segmentFilters = areaSelection?.segments.flatMap((segment) => [
    segment.distributionAreaId ? { id: segment.distributionAreaId } : null,
    segment.city ? { city: { equals: segment.city, mode: "insensitive" as const } } : null,
    segment.postalCode ? { postalCode: { startsWith: segment.postalCode.slice(0, 3) } } : null,
  ]).filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [];
  const includeOperationalData = input.includeOperationalData ?? true;
  const [matchingAreas, warehouseMatch, combinations, segmentWarehouseMatches] = await Promise.all([
    prisma.distributionArea.findMany({
      where: {
        AND: [
          ...(input.publicOnly
            ? [{ tenantId: null }]
            : input.tenantId
              ? [{ OR: [{ tenantId: null }, { tenantId: input.tenantId }] }]
              : []),
          ...((segmentFilters.length || areaFilters.length) ? [{ OR: segmentFilters.length ? segmentFilters : areaFilters }] : []),
        ],
        status: "ACTIVE",
        reusable: true,
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      include: { estimates: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: areaSelection ? 40 : 8,
    }),
    includeOperationalData
      ? findBestWarehouseForArea({ city: effectiveCity, postalCode: effectivePostalCode }).catch(() => null)
      : Promise.resolve(null),
    includeOperationalData
      ? combineOrders({ city: effectiveCity, postalCode: effectivePostalCode }).catch(() => [])
      : Promise.resolve([]),
    includeOperationalData && areaSelection
      ? Promise.all(areaSelection.segments.map((segment) => findBestWarehouseForArea({ city: segment.city, postalCode: segment.postalCode }).catch(() => null)))
      : Promise.resolve([]),
  ]);
  const densitySamples = matchingAreas
    .map((area) => {
      const areaSqm = area.coverageAreaSqm ? Number(area.coverageAreaSqm) : 0;
      const households = area.estimatedHouseholds ?? 0;
      return areaSqm > 0 && households > 0 ? areaSqm / households : null;
    })
    .filter((value): value is number => Boolean(value) && Number.isFinite(value));
  const referenceArea =
    (input.distributionAreaId ? matchingAreas.find((area) => area.id === input.distributionAreaId) : null) ??
    (primarySegment ? areaReferenceForSegment(primarySegment, matchingAreas) : null) ??
    matchingAreas.find((area) => area.coverageAreaSqm && area.estimatedHouseholds) ??
    null;
  const referenceEstimate = referenceArea?.estimates?.[0] ?? null;
  const densityFactor = densityFromArea(referenceArea ?? undefined) ??
    (densitySamples.length
      ? Math.max(35, Math.min(5000, densitySamples.reduce((sum, value) => sum + value, 0) / densitySamples.length))
      : 125);
  const segmentCalculations = areaSelection?.segments.map((segment) => {
    const segmentArea = areaReferenceForSegment(segment, matchingAreas);
    const segmentEstimate = segmentArea?.estimates?.[0] ?? null;
    const segmentDensity = densityFromArea(segmentArea ?? undefined) ?? densityFactor;
    const households = estimateHouseholds({ coverageAreaSqm: segment.areaSqm, cityDensityFactor: segmentDensity });
    const confidence = confidenceForEstimate(
      segmentEstimate?.method,
      segmentEstimate?.source,
      segmentArea?.dataSourceType,
      segmentEstimate?.sourceYear,
      Boolean(segmentArea?.estimatedHouseholds),
    );
    return { segment, segmentArea, segmentEstimate, households, confidence };
  }) ?? null;
  const households = segmentCalculations
    ? segmentCalculations.reduce((sum, item) => sum + item.households, 0)
    : estimateHouseholds({ coverageAreaSqm: effectiveCoverageAreaSqm, cityDensityFactor: densityFactor });
  const recommendedFlyerQuantity = Math.max(500, Math.ceil((households * 1.1) / 100) * 100);
  const flyerQuantity = input.flyerQuantity ?? recommendedFlyerQuantity;
  const routeDistanceMeters = effectiveCoverageAreaSqm
    ? estimateRouteDistanceMeters({
        coverageAreaSqm: effectiveCoverageAreaSqm,
        perimeterMeters: planning.perimeterMeters,
        households,
      })
    : null;
  const singleDistributorMinutes = calculateDistributionTime({
    distanceMeters: routeDistanceMeters,
    flyerQuantity,
    households,
    distributorCount: 1,
  });
  const distributorNeed = Math.max(1, Math.ceil(singleDistributorMinutes / 240), Math.ceil(flyerQuantity / 3500));
  const routeDurationMinutes = calculateDistributionTime({
    distanceMeters: routeDistanceMeters,
    flyerQuantity,
    households,
    distributorCount: distributorNeed,
  });
  const price = await calculateOrderPrice({ serviceType: "FLYER_DISTRIBUTION", flyerQuantity });
  const householdCountSource = segmentCalculations
    ? segmentCalculations.map((item) => estimateSourceLabel(item.segmentEstimate?.method, item.segmentEstimate?.source)).join(", ")
    : estimateSourceLabel(referenceEstimate?.method, referenceEstimate?.source);
  const confidence = segmentCalculations
    ? lowestConfidence(segmentCalculations.map((item) => item.confidence))
    : confidenceForEstimate(
    referenceEstimate?.method,
    referenceEstimate?.source,
    referenceArea?.dataSourceType,
    referenceEstimate?.sourceYear,
    Boolean(referenceArea?.estimatedHouseholds),
  );
  const segmentWarehouseData = areaSelection?.segments.map((segment, index) => {
    const match = segmentWarehouseMatches[index];
    return {
      name: segment.name,
      city: segment.city,
      postalCode: segment.postalCode,
      warehouse: match?.warehouse ? {
        id: match.warehouse.id,
        name: match.warehouse.name,
        code: match.warehouse.code,
        city: match.warehouse.city,
      } : null,
      matchedRegion: Boolean(match?.matchedRegion),
      reason: match?.reason ?? "Kein aktives Lager für dieses Teilgebiet hinterlegt.",
    };
  }) ?? [];
  const needsManualReview = Boolean(areaSelection && (
    !segmentWarehouseData.length || segmentWarehouseData.some((item) => !item.matchedRegion)
  ));
  const areaConfidence = referenceArea?.dataSourceType === "OFFICIAL" || referenceArea?.dataSourceType === "LICENSED"
    ? "verified" as const
    : effectiveCoverageAreaSqm ? "estimated" as const : "unavailable" as const;
  const householdConfidence = confidence === "high" ? "verified" as const : households ? "estimated" as const : "unavailable" as const;
  const authoritativeQuote = buildAuthoritativePlanningQuote({
    fingerprint: quoteFingerprint,
    flyerQuantity,
    netPrice: price.net.toString(),
    vatAmount: price.vat.toString(),
    grossPrice: price.gross.toString(),
    households: households || null,
    coverageAreaSqm: effectiveCoverageAreaSqm ?? 0,
    routeDistanceMeters,
    routeDurationMinutes,
    pricingVersion: price.snapshot.pricingVersion,
    pricingRuleSignature: price.snapshot.pricingRuleSignature,
    calculationVersion: areaSelection ? "order-area-v2-multi-segment" : "order-area-v1",
    calculatedAt: new Date().toISOString(),
    sources: {
      area: referenceArea?.dataSourceName ?? (effectiveCoverageAreaSqm ? "polygon-estimate" : "unavailable"),
      households: householdCountSource,
      route: routeDistanceMeters === null ? "unavailable" : "polygon-estimate",
      pricing: `pricing:${price.snapshot.pricingVersion}`,
    },
    confidence: {
      area: areaConfidence,
      households: householdConfidence,
      route: routeDistanceMeters === null ? "unavailable" : "estimated",
    },
  });

  return {
    suggestions: matchingAreas.map(compactArea),
    metrics: {
      households,
      flyerQuantity,
      routeDistanceMeters,
      routeDurationMinutes,
      coverageAreaSqm: effectiveCoverageAreaSqm ?? 0,
      grossPrice: price.gross.toString(),
      netPrice: price.net.toString(),
      vatAmount: price.vat.toString(),
      vatRate: price.snapshot.vatRate,
      distributorNeed,
      score: scoreArea({ city: effectiveCity, postalCode: effectivePostalCode, households, flyerQuantity, coverageAreaSqm: effectiveCoverageAreaSqm, distanceMeters: routeDistanceMeters }),
      source: referenceArea?.estimatedHouseholds ? "area-household-estimate" : "area-formula",
      confidence,
      calculatedAt: new Date().toISOString(),
      calculationVersion: areaSelection ? "order-area-v2-multi-segment" : "order-area-v1",
      fingerprint: authoritativeQuote.fingerprint,
      polygonHash: authoritativeQuote.polygonHash,
      pricingRuleSignature: authoritativeQuote.pricingRuleSignature,
      quote: authoritativeQuote,
      householdCountSource,
      pricingVersion: price.snapshot.pricingVersion,
      areaReference: referenceArea
        ? {
            distributionAreaId: referenceArea.id,
            name: referenceArea.name,
            city: referenceArea.city,
            postalCode: referenceArea.postalCode,
            coverageAreaSqm: referenceArea.coverageAreaSqm ? Number(referenceArea.coverageAreaSqm) : null,
            dataSourceName: referenceArea.dataSourceName,
            dataSourceType: referenceArea.dataSourceType,
            dataSourceUrl: referenceArea.dataSourceUrl,
            licenseNote: referenceArea.licenseNote,
            dataUpdatedAt: referenceArea.dataUpdatedAt?.toISOString() ?? null,
            areaConfidence: referenceArea.confidence ? Number(referenceArea.confidence) : null,
            estimateMethod: referenceEstimate?.method ?? null,
            estimateSource: referenceEstimate?.source ?? null,
            estimateSourceUrl: referenceEstimate?.sourceUrl ?? null,
            estimateSourceYear: referenceEstimate?.sourceYear ?? null,
            estimateConfidence: referenceEstimate?.confidence ? Number(referenceEstimate.confidence) : null,
          }
        : {
            distributionAreaId: input.distributionAreaId ?? null,
            name: null,
            city: input.city ?? null,
            postalCode: input.postalCode ?? null,
            coverageAreaSqm: effectiveCoverageAreaSqm ?? null,
            estimateMethod: null,
            estimateSource: null,
            estimateConfidence: null,
          },
      segments: segmentCalculations?.map((item) => ({
        name: item.segment.name,
        city: item.segment.city,
        postalCode: item.segment.postalCode,
        areaSqm: item.segment.areaSqm,
        households: item.households,
        householdCountSource: estimateSourceLabel(item.segmentEstimate?.method, item.segmentEstimate?.source),
        confidence: item.confidence,
        distributionAreaId: item.segmentArea?.id ?? item.segment.distributionAreaId,
      })) ?? [],
      needsManualReview,
      warehouseMatches: segmentWarehouseData,
    },
    warehouse: warehouseMatch?.warehouse && !needsManualReview
      ? {
          id: warehouseMatch.warehouse.id,
          name: warehouseMatch.warehouse.name,
          code: warehouseMatch.warehouse.code,
          city: warehouseMatch.warehouse.city,
          reason: warehouseMatch.reason,
        }
      : null,
    combinations: combinations.slice(0, 5),
    needsManualReview,
    warehouseMatches: segmentWarehouseData,
  };
}

export async function getHeatmapData(tenantId?: string | null) {
  const [orders, areas] = await Promise.all([
    prisma.order.groupBy({
      by: ["city", "postalCode", "status"],
      where: tenantId ? { tenantId } : undefined,
      _count: { _all: true },
      _sum: { flyerQuantity: true },
    }),
    prisma.distributionArea.findMany({
      where: {
        status: "ACTIVE",
        ...(tenantId ? { OR: [{ tenantId: null }, { tenantId }] } : {}),
      },
      select: { id: true, name: true, city: true, postalCode: true, centerLat: true, centerLng: true, estimatedHouseholds: true },
      take: 80,
    }),
  ]);
  return {
    load: orders.map((item) => ({
      city: item.city,
      postalCode: item.postalCode,
      status: item.status,
      orders: item._count._all,
      flyers: item._sum.flyerQuantity ?? 0,
      intensity: Math.min(1, item._count._all / 8),
    })),
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      city: area.city,
      postalCode: area.postalCode,
      lat: area.centerLat ? Number(area.centerLat) : null,
      lng: area.centerLng ? Number(area.centerLng) : null,
      households: area.estimatedHouseholds,
    })),
  };
}

export async function getOrderExperienceAnalytics() {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [events, cities, areas] = await Promise.all([
    prisma.orderExperienceEvent.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.orderExperienceEvent.groupBy({ by: ["city"], where: { city: { not: null }, createdAt: { gte: since } }, _count: { city: true }, orderBy: { _count: { city: "desc" } }, take: 8 }),
    prisma.orderExperienceEvent.groupBy({ by: ["areaName"], where: { areaName: { not: null }, createdAt: { gte: since } }, _count: { areaName: true }, orderBy: { _count: { areaName: "desc" } }, take: 8 }),
  ]);
  const completed = events.filter((event) => event.eventType === "ORDER_CREATED" && event.durationMs);
  const started = events.filter((event) => event.eventType === "WIZARD_STARTED").length;
  const abandoned = events.filter((event) => event.eventType === "WIZARD_ABANDONED").length;
  const avg = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return {
    timeToOrderMs: avg(completed.map((event) => event.durationMs ?? 0)),
    abandonmentRate: started ? Math.round((abandoned / started) * 100) : 0,
    popularCities: cities.map((item) => ({ city: item.city, count: item._count.city })),
    popularAreas: areas.map((item) => ({ areaName: item.areaName, count: item._count.areaName })),
    averagePolygonSqm: avg(events.map((event) => event.coverageAreaSqm ? Number(event.coverageAreaSqm) : 0).filter(Boolean)),
    averageOrderDurationMinutes: Math.round(avg(events.map((event) => event.routeDurationMinutes ?? 0).filter(Boolean))),
    savedAreaUsage: events.filter((event) => event.usedSavedArea).length,
    autocompleteUsage: events.filter((event) => event.usedAutocomplete).length,
  };
}
