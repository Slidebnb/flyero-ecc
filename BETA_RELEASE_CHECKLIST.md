# Flyero ECC - Beta Release Checkliste

Stand: Modul 15.5

## Was ist fertig?

- Rollenbasierte Portale fuer Kunde, Verteiler, Lager, Admin und Support/Dispatch.
- Kundenregistrierung mit E-Mail-Verifizierung im lokalen Testmodus.
- Auftragserstellung inklusive Preisberechnung und Statushistorie.
- Lokaler Stripe-Testcheckout unter `/mock-stripe/checkout/:id`.
- Zahlungsstatus, Admin-Pruefung und automatische Rechnungserstellung nach Genehmigung.
- Lagerprozess mit Check-in, Lagerplatz, QR-Code, Status `READY_FOR_PICKUP`.
- Dispatch mit Verteiler-Zuweisung, Annahme und Kapazitaets-/Auditlogik.
- Verteiler-Tour mit Pickup, Start, GPS-Punkten, Foto-Nachweis und Abschluss.
- Admin-Tourpruefung, Berichtserzeugung, PDF-Bericht und Kundenansicht.
- Rechnungs-PDF, Berichts-PDF und Accounting-CSV-Exports.
- Notification-Service mit Templates, Queue, Preferences und Logs.
- Demo-Daten fuer alle Hauptrollen.
- Beta-Smoke-Test `npm run test:beta` fuer den wichtigsten End-to-End-Flow.

## Was ist bewusst nicht fertig?

- Kein echter Stripe-Livebetrieb ohne produktive Keys und Webhook-Konfiguration.
- Keine WhatsApp-, SMS- oder Firebase-Push-Provider.
- Kein KI-Textgenerator fuer Nachrichten.
- Keine automatischen Auszahlungen an Verteiler.
- Keine native App.
- Kein garantiertes Background-GPS bei gesperrtem iPhone.
- Kein Live-Tracking fuer Kunden waehrend laufender Touren.
- Keine Live-Schnittstellen zu Lexware oder DATEV.
- Keine rechtsverbindliche Steuer-/DATEV-Freigabe.

## Vor echtem Kundenbetrieb manuell pruefen

- Stripe Live-Checkout mit echten Testkarten und signiertem Webhook.
- Vollstaendiger E-Mail-Versand ueber einen Provider inklusive SPF, DKIM und DMARC.
- Google Maps Browser-Key mit Domain-Restriktionen.
- Google Server-Key nur fuer serverseitige Nutzung und ohne Frontend-Leak.
- Browser-GPS im Verteiler-Webflow auf echten Mobilgeraeten pruefen, inklusive Standortfreigabe, Offline-Puffer und Re-Sync.
- PDF-Inhalte fuer Rechnung und Bericht fachlich/fiskalisch pruefen.
- DATEV/Lexware-CSV mit Steuerberater oder Buchhaltung validieren.
- Datenschutztexte, AGB, Impressum, AV-Vertraege und Auftragsverarbeitung pruefen.
- Rollenrechte mit echten Benutzerkonten erneut im Browser testen.
- Backup-/Restore-Prozess fuer Postgres und generierte Dateien pruefen.
- Betriebliches Monitoring fuer Queue-Fehler, Webhooks und fehlgeschlagene Exports ergaenzen.

## Benoetigte ENV Keys

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_COOKIE_NAME`
- `APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- `GOOGLE_MAPS_SERVER_KEY`

## Prozesse, die noch manuell sind

- Admin-Pruefung von bezahlten Auftraegen.
- Lager-Check-in und Lagerstatuspflege.
- Dispatch-Entscheidung, sofern Auto-Dispatch deaktiviert bleibt.
- Verteiler-Freigabe und Sperr-/Pause-Entscheidungen.
- Tourpruefung und Berichtfreigabe durch Admin.
- Accounting-Export-Erstellung und Uebergabe an Buchhaltung.
- Bearbeitung fehlgeschlagener Notification-Queue-Eintraege.

## Rechtliche Punkte offen

- Datenschutzfolge und Datenminimierung fuer GPS-/Foto-Nachweise.
- Einwilligungen fuer Verteiler-Tracking und Foto-Uploads.
- Keine Werbeaussage zu 100 Prozent Background-GPS verwenden, solange kein natives iOS-/Android-Projekt umgesetzt und rechtlich freigegeben ist.
- Aufbewahrungsfristen fuer Rechnungen, Berichte, AuditLogs und GPS-Daten.
- Steuerliche Rechnungsfreigabe.
- AGB, Widerruf, Impressum, Datenschutz und AV-Vertraege.
- Pruefung der Werbe-/Verteilgenehmigungen je Zielgebiet.

## Beta-Einschaetzung

Die Plattform ist fuer eine interne Demo und kontrollierte Beta mit Testdaten geeignet. Fuer echten Kundenbetrieb fehlen vor allem produktiver Zahlungs-/E-Mail-Betrieb, rechtliche Freigaben, Monitoring und manuelle Prozessabnahmen.

## Gepruefter End-to-End-Hauptflow

Der automatisierte Beta-Smoke prueft technisch:

1. Kunde registriert sich.
2. E-Mail-Verifizierung wird im lokalen Testmodus abgeschlossen.
3. Kunde erstellt Auftrag.
4. Lokaler Stripe-Mock-Checkout wird erzeugt und erfolgreich abgeschlossen.
5. Admin genehmigt Auftrag.
6. Rechnung entsteht automatisch.
7. Lager checkt Flyer ein.
8. QR-Code wird erzeugt.
9. Lager setzt Bestand auf abholbereit.
10. Admin weist Auftrag einem Verteiler zu.
11. Verteiler nimmt Auftrag an.
12. Verteiler bestaetigt Pickup per QR-Code.
13. Verteiler startet Tour.
14. GPS-Punkte und Foto werden hochgeladen.
15. Verteiler beendet Tour.
16. Admin prueft und genehmigt Tour.
17. Bericht wird erzeugt.
18. Kunde kann Bericht-PDF und Rechnung-PDF abrufen.

## Rollen- und Sicherheitsnachweis im Beta-Smoke

- Kunde wird von Adminseiten weggeleitet.
- Verteiler wird von Kundenseiten weggeleitet.
- Lager wird von Kundenseiten weggeleitet.
- Nicht eingeloggte Nutzer werden zum Login umgeleitet.
- Kunden-PDF-Downloads sind auf eigene Rechnungen/Berichte begrenzt.
- Kundenbericht-API enthaelt keine offensichtlichen Verteiler-Privatfelder wie `birthDate`, `taxNumber` oder `bankAccount`.
- Ungueltiger Order-Statuswechsel wird mit `409` blockiert.

## Modul-27-Aktivierung und Checkout

- [x] Gastplanung bleibt ohne Konto moeglich und wird bei direkter Buchung an
      Registrierung/Login uebergeben.
- [x] Verifizierungslinks und erneute Verifizierungslinks behalten den sicheren
      internen Weiterleitungspfad.
- [x] Pflichtprofil wird vor dem Checkout fokussiert ergaenzt.
- [x] Fehlende Stammdaten erzeugen keinen irrefuehrenden Stripe-Fehler; die
      Order wird zur Profilergänzung fortgesetzt.
- [x] Offene Zahlungen werden bei der Fortsetzung wiederverwendet.
- [x] Authentifizierte Funnel-Ereignisse entstehen serverseitig und enthalten
      keine PII.
- [x] Entwuerfe werden erst nach erfolgreicher Auftragserstellung geloescht.

Vor einem echten Kundenbetrieb bleiben erforderlich: produktiver Stripe-
Checkout inklusive Webhook-Replay, echte E-Mail-Zustellung und Bounce-
Monitoring, Browserpruefung auf Produktionsdomains, Restore-Test des Backups,
Datenschutz-/Rechtsfreigabe und ein kontrollierter Test mit realen
Zahlungsmitteln.
