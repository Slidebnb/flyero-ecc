# FLYERO Verteiler-Webscope

Stand: 2026-07-03

## Entscheidung

FLYERO verfolgt aktuell kein separates natives App-Ziel. Der Verteilerbereich bleibt Teil der bestehenden Webplattform und wird als mobile Web-/PWA-nahe Arbeitsansicht umgesetzt.

## Enthalten

- Verteiler-Login ueber die bestehende Plattform.
- Verfuegbare und zugewiesene Auftraege aus echten Prisma-/API-Daten.
- Auftrag annehmen oder ablehnen.
- Pickup mit QR-Code.
- Tour starten, pausieren, fortsetzen und abschliessen.
- Browser-Geolocation waehrend aktiver Touransicht.
- GPS-Puffer im Browser bei schlechter Verbindung.
- Foto-Nachweise mit Tourbezug.
- Admin-Pruefung und Kundenbericht nach Freigabe.

## Nicht enthalten

- Keine native iOS-App.
- Keine native Android-App.
- Kein garantiertes Background-GPS bei gesperrtem iPhone.
- Kein dauerhaftes Tracking ausserhalb der aktiven Web-/PWA-Nutzung.
- Kein Kunden-Live-Tracking waehrend laufender Tour.

## Produkt- und Rechtsgrenze

FLYERO darf im aktuellen Scope mit GPS-Nachweisen aus der Verteiler-Tour werben, aber nicht mit garantiertem 100-Prozent-Background-GPS auf iOS. Wenn diese Zusage spaeter erforderlich wird, muss ein eigenes natives App-Projekt mit iOS-/Android-Berechtigungen, Datenschutzfreigabe, App-Store-Pruefung und Betriebskonzept geplant werden.

## Technische Leitlinie

Alle Verbesserungen muessen die bestehende Plattform respektieren:

- keine Dummy-Daten,
- keine erfundenen Auftraege,
- keine separaten App-Abhaengigkeiten,
- keine Aenderungen an Kunde/Admin/Lager als mobile App-Ziel,
- bestehende Rollen- und API-Schutzpruefungen bleiben serverseitig massgeblich.
