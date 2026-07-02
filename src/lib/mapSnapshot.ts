import type { RouteAnalysis } from "@/lib/routeAnalysis";

export type MapSnapshotInput = {
  tourId: string;
  routePath: Array<{ lat: number; lng: number }>;
  analysis?: RouteAnalysis;
};

export async function createMapSnapshotPlaceholder(input: MapSnapshotInput) {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  const hasServerKey = Boolean(serverKey);
  const routePath = input.routePath.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const sampledPath = routePath.filter((_, index) => index % Math.max(Math.ceil(routePath.length / 60), 1) === 0);
  const pathParam = sampledPath.map((point) => `${point.lat},${point.lng}`).join("|");
  const markers = [
    routePath[0] ? `color:green|label:S|${routePath[0].lat},${routePath[0].lng}` : null,
    routePath.at(-1) ? `color:red|label:E|${routePath.at(-1)?.lat},${routePath.at(-1)?.lng}` : null,
  ].filter((marker): marker is string => Boolean(marker));
  const url = hasServerKey && routePath.length > 0
    ? `https://maps.googleapis.com/maps/api/staticmap?size=900x520&scale=2&maptype=roadmap&path=color:0x102033ff|weight:4|${encodeURIComponent(pathParam)}${markers.map((marker) => `&markers=${encodeURIComponent(marker)}`).join("")}&key=${serverKey}`
    : null;

  return {
    ready: Boolean(url),
    provider: hasServerKey ? "google-static-maps-prepared" : "fallback",
    url,
    message: url
      ? "Static-Maps-URL fuer den PDF-Bericht vorbereitet."
      : "Google Maps Server-Key fehlt oder Route ist leer. Der PDF-Bericht nutzt den stabilen Karten-Fallback.",
    pointCount: routePath.length,
  };
}
