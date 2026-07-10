# FLYERO MVP: Verteilnachweise mit externen GPS-Geräten

## Ziel

Der MVP nutzt keine eigene native Verteiler-App als Pflichtbestandteil. FLYERO arbeitet zuerst mit professionellen externen GPS-Geräten oder GPS-Trackingsystemen. Der Anbieter erzeugt nach der Tour einen Bericht, typischerweise als PDF und optional als GPX, KML oder KMZ. Admins laden diese Nachweise manuell beim Auftrag hoch und veröffentlichen sie nach interner Prüfung für den Kunden.

## MVP-Prozess

1. Kampagne wird gebucht oder als Anfrage angelegt.
2. Admin weist Verteiler oder ein internes Team manuell zu.
3. Verteiler startet das externe GPS-Gerät zu Tourbeginn und beendet es nach der Verteilung.
4. GPS-Anbieter erzeugt PDF-Bericht und optional GPX/KML/KMZ.
5. Admin öffnet den Auftrag und lädt Nachweise hoch.
6. Admin trägt Ist-Werte ein: Datum, Start, Ende, verteilte Flyer, Restmenge, Verteiler/Team, Zusammenfassung und Abweichungen.
7. Admin bereitet den Bericht vor.
8. Admin gibt den Bericht intern frei und veröffentlicht ihn.
9. Kunde sieht nur freigegebene Nachweise im Portal.

## Uploadprozess

Im Admin-Auftrag gibt es den Bereich `Verteilnachweise`.

Unterstützte Dateien:

- PDF
- JPG/JPEG
- PNG
- WEBP
- GPX
- KML
- KMZ

Dateityp und Dateigröße werden serverseitig über den bestehenden geschützten Dokumentenspeicher validiert. Zusätzlich wird der gewählte Nachweistyp serverseitig gegen die passende Dateiendung geprüft: GPS-PDF nur PDF, GPS-Datei nur GPX/KML/KMZ, Fotos nur JPG/JPEG/PNG/WEBP. Externe GPS-Berichte werden als `Document` am Auftrag gespeichert. Wichtige Metadaten:

- `providerName`
- `externalReportReference`
- `reportDate`
- `uploadedAt`
- `uploadedById`
- `customerVisible`
- `reviewStatus`

## Freigabeprozess

Externe Nachweise sind nach Upload nicht automatisch für Kunden sichtbar. Beim Vorbereiten des Reports werden die zu diesem Bericht gehörenden Nachweisdateien im `reportSnapshot.evidenceDocumentIds` festgehalten. Beim Veröffentlichen eines Reports mit `reportSource = EXTERNAL_GPS_REPORT` oder `MANUAL_EVIDENCE` werden nur diese Snapshot-Nachweise kundensichtbar gemacht. Andere Auftragsdateien bleiben verborgen, bis sie ausdrücklich in einen Report-Snapshot aufgenommen und veröffentlicht werden.

Der Bericht darf im MVP auch ohne interne GPS-Punkte veröffentlicht werden. In diesem Fall wird keine automatische Coverage behauptet.
Der Report-Snapshot speichert die verwendeten Nachweisdateien, Fotodokumente, Verteilungsdatum, manuell erfasstes Team bzw. Verteilername, Ist-Mengen, Kundennotiz und den Hinweis, dass ohne interne Rohdaten keine automatische Coverage berechnet wird.

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
- PDF-/Nachweis-Download über geschützte API
- Status `Von FLYERO geprüft`

Nur `customerVisible = true` und `status = APPROVED` wird ausgeliefert.

## Berechtigungen

- Admin und Support/Dispatcher können Nachweise hochladen und Reports vorbereiten.
- Kunden können nur eigene veröffentlichte Reports sehen.
- Kunden können nur freigegebene Nachweisdateien herunterladen.
- Interne Notizen, interne IDs, private Verteilerinformationen und technische Rohdaten bleiben verborgen.

## MVP vs. spätere Verteiler-App

MVP:

- externe GPS-Geräte
- manueller Upload
- manuelle Verteilerzuordnung
- Adminprüfung
- Kundenbericht

Später:

- eigene Verteiler-App
- Live-GPS
- automatischer Sync
- Background Tracking
- Offline Queue
- automatische Coverage-Berechnung

## Geänderte Dateien

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

Der GPS-Bericht wird als geschütztes `Document` mit `documentType = REPORT` gespeichert. Die Datei liegt nicht öffentlich im Webroot, sondern im geschützten Dokumentenspeicher.

## Manuelle Verteilerzuordnung

Der MVP kann bestehende Verteilerprofile weiterverwenden. Zusätzlich existiert das einfache Modell `ManualDistributor` für interne Verteilerkontakte ohne Kundenportal- oder App-Login.

## Bewusst verschoben

- Capacitor
- iOS Background Tracking
- Android Foreground Service
- mobile Offline Queue
- Verteiler-Self-Service-Registrierung
- App Store / Play Store
- automatische Coverage-Behauptung ohne echte Rohdaten
