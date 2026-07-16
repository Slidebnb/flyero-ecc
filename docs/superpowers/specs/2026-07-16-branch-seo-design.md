# FLYERO Branchen-SEO Seiten

## Ziel

FLYERO erhält acht öffentlich indexierbare Branchen-Seiten, die jeweils eine eigene Suchintention beantworten und Besucher ohne Umweg zur Gebietsplanung oder unverbindlichen Anfrage führen.

## Umfang

Die erste Welle umfasst:

- Bäckereien
- Gastronomie
- Fitnessstudios
- Handwerk
- Immobilien
- Einzelhandel
- Events und Vereine
- Neueröffnungen

Jede Seite erhält eine eigene URL unter `/branchen/`, individuelle Meta-Daten, branchenspezifische Anwendungsfälle, Hinweise zu Gebiet und Verteilzeitpunkt, Nachweisargumente, FAQ und CTA. Es werden keine künstlichen Ortsseiten und keine automatisch erzeugten Keyword-Varianten angelegt.

## Architektur

Die Daten liegen in `src/app/branchen/industryData.ts`. Die dynamische Route `src/app/branchen/[slug]/page.tsx` lädt ausschließlich bekannte Datensätze, erzeugt Metadata und JSON-LD und rendert eine gemeinsame `IndustryLandingPage`. Das gemeinsame Layout verwendet die bestehende `MarketingPage`- und Footer-Struktur; die redaktionellen Inhalte unterscheiden sich pro Datensatz.

Die zentralen SEO-Routen in `src/app/seo.ts` werden um die Branchenrouten ergänzt. Dadurch erscheinen sie automatisch in `sitemap.xml`; `robots.txt` erlaubt den öffentlichen Bereich `/branchen`.

## Inhaltsregeln

- Keine erfundenen Kundenzahlen, Reichweiten oder Erfolgsquoten.
- Haushalte und Preise werden nicht auf den Branchen-Seiten behauptet, sondern über die echte Gebietsplanung ermittelt.
- GPS-, Foto- und PDF-Nachweise werden als Prozess und nicht als bereits vorhandenes Ergebnis beschrieben.
- Jede Seite erhält einen eigenen Titel, eine eigene Description, eigene FAQ und eigene Beispiele.
- Der CTA führt zur bestehenden `/verteilung-planen`- beziehungsweise `/verteilung-anfragen`-Strecke.

## Nicht enthalten

- Keine Datenbankänderung.
- Keine neuen Branchenmodelle im Prisma-Schema.
- Keine gekauften Backlinks oder Keyword-Stuffing.
- Keine Neugestaltung der bestehenden öffentlichen Grundsprache.

## Abnahme

Alle acht Branchenrouten müssen im Code, Footer, Sitemap und SEO-Test enthalten sein. Desktop- und Mobile-Layouts dürfen keine Überlappungen erzeugen. Lint, TypeScript, Build, Landing-Smoke und ein eigener Branchen-SEO-Smoke-Test müssen erfolgreich sein.
