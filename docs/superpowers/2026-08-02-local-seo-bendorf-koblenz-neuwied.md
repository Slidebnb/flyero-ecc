# FLYERO Local SEO: Bendorf, Koblenz, Neuwied

## Ziel

Regionale SEO-Seiten fuer den Raum Bendorf, Koblenz und Neuwied ergaenzen, ohne die bestehende Marketing-, Checkout- oder Pricing-Architektur zu veraendern.

## Root Cause

Die zentrale SEO-Quelle `seoIntentData` enthaelt bereits bundesweite und thematische Seiten, aber keine dedizierten lokalen Seiten fuer Bendorf, Koblenz und Neuwied. Dadurch erscheinen diese Suchintentionen weder als eigene Seiten noch in der Sitemap. Eine `llms.txt`-Route existiert ebenfalls noch nicht.

## Umsetzung

1. Regressionstest fuer lokale SEO-Seiten, Sitemap-Einbindung, Robots-Allowlist und `llms.txt`.
2. Drei lokale SEO-Seiten auf Basis der vorhandenen `SeoIntentPage`-Komponente.
3. Regionale Seitentitel, Beschreibungen, Keywords, FAQ und strukturierte Daten ueber die bestehende JSON-LD-Erzeugung.
4. Sitemap ueber bestehende `publicSeoRoutes`.
5. Footer-Links fuer regionale Seiten.
6. `llms.txt` als text/plain Route mit erlaubten Hauptinhalten und Ausschluss interner Bereiche.

## Nicht Teil der Aufgabe

- Keine Pricing-Aenderung.
- Keine Checkout-Aenderung.
- Keine Admin-Aenderung.
- Keine DB-Migration.
- Kein Sites-Deployment, da Hetzner das Produktionsziel ist.
