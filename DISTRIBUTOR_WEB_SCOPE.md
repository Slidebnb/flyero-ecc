# FLYERO Verteiler-Webscope

Stand: 2026-07-03

## Entscheidung

FLYERO verfolgt aktuell kein separates natives App-Ziel. Fuer den MVP ist der primaere Nachweisweg nicht die eigene Verteiler-App, sondern ein externes professionelles GPS-Geraet bzw. GPS-Trackingsystem mit anschliessendem Admin-Upload des GPS-Berichts. Der bestehende Verteilerbereich der Webplattform darf bleiben, ist aber keine Launch-Voraussetzung fuer den MVP-Nachweisprozess.

## Webbereich: enthalten, aber nicht MVP-pflichtig

- Verteiler-Login ueber die bestehende Plattform.
- Verfuegbare und zugewiesene Auftraege aus echten Prisma-/API-Daten.
- Auftrag annehmen oder ablehnen.
- Pickup mit QR-Code.
- Tour starten, pausieren, fortsetzen und abschliessen.
- Browser-Geolocation waehrend aktiver Touransicht.
- GPS-Puffer im Browser bei schlechter Verbindung.
- Foto-Nachweise mit Tourbezug.
- Admin-Pruefung und Kundenbericht nach Freigabe.

## MVP-Nachweisprozess

- Externes GPS-Geraet bzw. externes Trackingsystem starten und nach der Verteilung beenden.
- GPS-Anbieter erzeugt PDF-Bericht und optional GPX/KML/KMZ.
- Admin laedt GPS-Bericht, Fotos und weitere Nachweise beim Auftrag hoch.
- Admin traegt Ist-Werte, Verteiler/Team, Zusammenfassung und Abweichungen ein.
- Admin prueft und veroeffentlicht den Bericht.
- Kunde sieht nur freigegebene Nachweise im Portal.

## Nicht enthalten

- Keine native iOS-App.
- Keine native Android-App.
- Kein garantiertes Background-GPS bei gesperrtem iPhone.
- Kein dauerhaftes Tracking ausserhalb der aktiven Web-/PWA-Nutzung.
- Kein Kunden-Live-Tracking waehrend laufender Tour.
- Keine native oder webbasierte Live-GPS-Funktion als Pflicht fuer den MVP.

## Produkt- und Rechtsgrenze

FLYERO darf im MVP mit dem GPS-Nachweis des eingesetzten Trackingsystems werben, aber nicht behaupten, dass FLYERO selbst live oder im Hintergrund jeden Standortpunkt aufzeichnet. Wenn spaeter eigenes Live-GPS oder 100-Prozent-Background-GPS erforderlich wird, muss ein eigenes natives App-Projekt mit iOS-/Android-Berechtigungen, Datenschutzfreigabe, App-Store-Pruefung und Betriebskonzept geplant werden.

## Technische Leitlinie

Alle Verbesserungen muessen die bestehende Plattform respektieren:

- keine Dummy-Daten,
- keine erfundenen Auftraege,
- keine separaten App-Abhaengigkeiten,
- keine Aenderungen an Kunde/Admin/Lager als mobile App-Ziel,
- bestehende Rollen- und API-Schutzpruefungen bleiben serverseitig massgeblich.
