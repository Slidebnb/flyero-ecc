# FLYERO MVP: Verteilnachweise mit externen GPS-Geraeten

## Ziel

Der MVP nutzt keine eigene native Verteiler-App als Pflichtbestandteil. FLYERO arbeitet zuerst mit professionellen externen GPS-Geraeten oder GPS-Trackingsystemen. Der Anbieter erzeugt nach der Tour einen Bericht, typischerweise als PDF und optional als GPX, KML oder KMZ. Admins laden diese Nachweise manuell beim Auftrag hoch und veroeffentlichen sie nach interner Pruefung fuer den Kunden.

## MVP-Prozess

1. Kampagne wird gebucht oder als Anfrage angelegt.
2. Admin weist Verteiler oder ein internes Team manuell zu.
3. Verteiler startet das externe GPS-Geraet zu Tourbeginn und beendet es nach der Verteilung.
4. GPS-Anbieter erzeugt PDF-Bericht und optional GPX/KML/KMZ.
5. Admin oeffnet den Auftrag und laedt Nachweise hoch.
6. Admin traegt Ist-Werte ein: Datum, Start, Ende, verteilte Flyer, Restmenge, Verteiler/Team, Zusammenfassung und Abweichungen.
7. Admin bereitet den Bericht vor.
8. Admin gibt den Bericht intern frei und veroeffentlicht ihn.
9. Kunde sieht nur freigegebene Nachweise im Portal.

## Uploadprozess

Im Admin-Auftrag gibt es den Bereich `Verteilnachweise`.

Unterstuetzte Dateien:

- PDF
- JPG/JPEG
- PNG
- WEBP
- GPX
- KML
- KMZ

Dateityp und Dateigroesse werden serverseitig ueber den bestehenden geschuetzten Dokumentenspeicher validiert. Externe GPS-Berichte werden als `Document` am Auftrag gespeichert. Wichtige Metadaten:

- `providerName`
- `externalReportReference`
- `reportDate`
- `uploadedAt`
- `uploadedById`
- `customerVisible`
- `reviewStatus`

## Freigabeprozess

Externe Nachweise sind nach Upload nicht automatisch fuer Kunden sichtbar. Beim Veroeffentlichen eines Reports mit `reportSource = EXTERNAL_GPS_REPORT` werden passende freigegebene Nachweise am Auftrag kundensichtbar gemacht.

Der Bericht darf im MVP auch ohne interne GPS-Punkte veroeffentlicht werden. In diesem Fall wird keine automatische Coverage behauptet.

Kundenformulierung:

`GPS-Nachweis des eingesetzten Trackingsystems`

Nicht verwenden:

`Von FLYERO live aufgezeichnet`

## Kundenansicht

Der Kunde sieht im Portal:

- Verteilbericht
- Gebiet
- Zeitraum
- geplante und dokumentiert verteilte Flyer
- GPS-Nachweis des eingesetzten Trackingsystems
- freigegebene Fotos und Dokumente
- Zusammenfassung
- Abweichungen
- PDF-/Nachweis-Download ueber geschuetzte API
- Status `Von FLYERO geprueft`

Nur `customerVisible = true` und `status = APPROVED` wird ausgeliefert.

## Berechtigungen

- Admin und Support/Dispatcher koennen Nachweise hochladen und Reports vorbereiten.
- Kunden koennen nur eigene veroeffentlichte Reports sehen.
- Kunden koennen nur freigegebene Nachweisdateien herunterladen.
- Interne Notizen, interne IDs, private Verteilerinformationen und technische Rohdaten bleiben verborgen.

## MVP vs. spaetere Verteiler-App

MVP:

- externe GPS-Geraete
- manueller Upload
- manuelle Verteilerzuordnung
- Adminpruefung
- Kundenbericht

Spaeter:

- eigene Verteiler-App
- Live-GPS
- automatischer Sync
- Background Tracking
- Offline Queue
- automatische Coverage-Berechnung

## Geaenderte Dateien

- `prisma/schema.prisma`
- `src/lib/documentStorage.ts`
- `src/lib/externalEvidence.ts`
- `src/lib/reports.ts`
- `src/app/admin/orders/[id]/page.tsx`
- `src/app/api/admin/orders/[id]/evidence/route.ts`
- `src/app/api/admin/orders/[id]/evidence/prepare-report/route.ts`
- `src/app/api/customer/reports/[id]/evidence/[documentId]/route.ts`
- `src/app/customer/reports/[id]/page.tsx`
- `tests/external-distribution-report-smoke.mjs`

## Speicherung externer GPS-Berichte

Der GPS-Bericht wird als geschuetztes `Document` mit `documentType = REPORT` gespeichert. Die Datei liegt nicht oeffentlich im Webroot, sondern im geschuetzten Dokumentenspeicher.

## Manuelle Verteilerzuordnung

Der MVP kann bestehende Verteilerprofile weiterverwenden. Zusaetzlich existiert das einfache Modell `ManualDistributor` fuer interne Verteilerkontakte ohne Kundenportal- oder App-Login.

## Bewusst verschoben

- Capacitor
- iOS Background Tracking
- Android Foreground Service
- mobile Offline Queue
- Verteiler-Self-Service-Registrierung
- App Store / Play Store
- automatische Coverage-Behauptung ohne echte Rohdaten
