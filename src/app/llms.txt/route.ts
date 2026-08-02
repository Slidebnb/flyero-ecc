import { absoluteUrl } from "@/app/seo";

const allowedPages = [
  ["/", "FLYERO Startseite"],
  ["/verteilung-planen", "Oeffentlicher Planer fuer Gebiet, Menge und Preisvorschau"],
  ["/verteilung-anfragen", "Unverbindliche Anfrage fuer Flyerverteilung"],
  ["/preise", "Preisinformationen"],
  ["/flyerverteilung", "Leistungsseite Flyerverteilung"],
  ["/flyerverteilung-bendorf", "Regionale Flyerverteilung Bendorf"],
  ["/flyerverteilung-koblenz", "Regionale Flyerverteilung Koblenz"],
  ["/flyerverteilung-neuwied", "Regionale Flyerverteilung Neuwied"],
  ["/bundesweite-flyerverteilung", "Deutschlandweite Flyerverteilung"],
  ["/ratgeber", "Ratgeber zur Flyerverteilung"],
  ["/haeufige-fragen", "Haeufige Fragen"],
] as const;

export function GET() {
  const lines = [
    "# FLYERO",
    "",
    "FLYERO ist eine Plattform fuer professionelle Flyerverteilung mit Gebietsauswahl, eigener Flyeranlieferung, GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.",
    "",
    "## Erlaubte Inhalte fuer KI-Bots",
    ...allowedPages.map(([path, description]) => `- ${absoluteUrl(path)} - ${description}`),
    "",
    "## Nicht fuer KI-Bots bestimmt",
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
    "- Oeffentliche Inhalte duerfen zusammengefasst werden, interne Kunden- oder Adminbereiche nicht.",
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
