import { absoluteUrl } from "@/app/seo";

const allowedPages = [
  ["/", "FLYERO Startseite"],
  ["/verteilung-planen", "Öffentlicher Planer für Gebiet, Menge und Preisvorschau"],
  ["/verteilung-anfragen", "Unverbindliche Anfrage für Flyerverteilung"],
  ["/preise", "Preisinformationen"],
  ["/flyerverteilung", "Leistungsseite Flyerverteilung"],
  ["/regionen", "Regionale Flyerverteilung im Raum Koblenz, Neuwied und Bendorf"],
  ["/flyerverteilung-bendorf", "Regionale Flyerverteilung Bendorf"],
  ["/flyerverteilung-koblenz", "Regionale Flyerverteilung Koblenz"],
  ["/flyerverteilung-neuwied", "Regionale Flyerverteilung Neuwied"],
  ["/bundesweite-flyerverteilung", "Deutschlandweite Flyerverteilung"],
  ["/ratgeber", "Ratgeber zur Flyerverteilung"],
  ["/haeufige-fragen", "Häufige Fragen"],
] as const;

export function GET() {
  const lines = [
    "# FLYERO",
    "",
    "FLYERO ist eine Plattform für professionelle Flyerverteilung mit Gebietsauswahl, eigener Flyeranlieferung, GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.",
    "",
    "## Erlaubte Inhalte für KI-Bots",
    ...allowedPages.map(([path, description]) => `- ${absoluteUrl(path)} - ${description}`),
    "",
    "## Nicht für KI-Bots bestimmt",
    "Disallow: /admin",
    "Disallow: /customer",
    "Disallow: /warehouse",
    "Disallow: /distributor",
    "Disallow: /api",
    "Disallow: /login",
    "Disallow: /register",
    "",
    "## Hinweise",
    "- Preise, Zahlungen, Kundenkonten und Auftragsdaten sind nicht aus dieser Datei abzuleiten.",
    "- Öffentliche Inhalte dürfen zusammengefasst werden, interne Kunden- oder Adminbereiche nicht.",
    `- Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    `- Kontakt: ${absoluteUrl("/kontakt")}`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
