import { z } from "zod";
import { geocodeSmartAddress } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { isGermanPostalCode } from "@/lib/publicLocationContext";

export async function GET(request: Request) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const params = new URL(request.url).searchParams;
    const query = z.object({
      q: z.string().trim().max(120).optional(),
      postalCode: z.string().trim().max(10).optional(),
      city: z.string().trim().max(80).optional(),
      street: z.string().trim().max(120).optional(),
      houseNumber: z.string().trim().max(20).optional(),
      placeId: z.string().trim().max(160).optional(),
    }).safeParse({
      q: params.get("q") ?? undefined,
      postalCode: params.get("postalCode") ?? undefined,
      city: params.get("city") ?? undefined,
      street: params.get("street") ?? undefined,
      houseNumber: params.get("houseNumber") ?? undefined,
      placeId: params.get("placeId") ?? undefined,
    });
    if (!query.success) return errorResponse("Die Adresse konnte nicht verarbeitet werden.", 400);
    const data = await geocodeSmartAddress({
      query: query.data.q,
      postalCode: query.data.postalCode,
      city: query.data.city,
      street: query.data.street,
      houseNumber: query.data.houseNumber,
      placeId: query.data.placeId,
    }, { publicOnly: true });
    const requestedPostalCode = query.data.postalCode ?? (query.data.q && isGermanPostalCode(query.data.q) ? query.data.q : undefined);
    if (!data && isGermanPostalCode(requestedPostalCode)) {
      return Response.json({ ok: false, code: "PUBLIC_GEOCODE_POSTAL_MISMATCH", error: "Die eingegebene PLZ konnte nicht eindeutig gefunden werden. Bitte wÃ¤hlen Sie den passenden Ort aus den VorschlÃ¤gen." }, { status: 422 });
    }
    if (data && isGermanPostalCode(requestedPostalCode) && data.postalCode !== requestedPostalCode) {
      return Response.json({ ok: false, code: "PUBLIC_GEOCODE_POSTAL_MISMATCH", error: "Die eingegebene PLZ konnte nicht eindeutig gefunden werden. Bitte wÃ¤hlen Sie den passenden Ort aus den VorschlÃ¤gen." }, { status: 422 });
    }
    if (!data) return errorResponse("Diese Adresse konnte nicht gefunden werden. Bitte prüfe die Eingabe oder zeichne das Gebiet direkt auf der Karte.", 422);
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
