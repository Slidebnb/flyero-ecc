# Flyero ECC - Known Issues

Stand: Modul 15.5

## Technische Einschraenkungen

- Stripe laeuft lokal ueber Mock-Checkout. Der echte Stripe-WebHook muss vor Produktion separat getestet werden.
- NotificationQueue bereitet Versand vor, verschickt aber noch keine echten E-Mails.
- WhatsApp, SMS und Push sind nur als Datenmodell/Kanal vorbereitet.
- Google Maps ist optional. Ohne Browser-Key greifen Fallback-Ansichten.
- Google Server-Key wird noch nicht fuer echte Static-Maps-Generierung oder Geocoding genutzt.
- PDF-Erzeugung ist MVP-nah und muss layout-/rechtlich vor Produktion geprueft werden.
- Accounting-Exports sind CSV-Dateien, keine Live-API-Synchronisation.
- Es gibt noch kein zentrales Monitoring/Dashboard fuer Queue-Fehler, Webhook-Fehler oder Exportfehler.
- Die Verteileransicht ist Web-/PWA-nah. Garantiertes Background-GPS bei gesperrtem iPhone ist ohne natives iOS-Projekt nicht zugesagt.

## Operative Einschraenkungen

- Admin-Pruefung, Lagerstatus, Dispatch, Tourpruefung und Accounting-Export bleiben manuelle Schritte.
- Auto-Dispatch ist standardmaessig deaktiviert.
- Verteiler-Auszahlungen sind nicht umgesetzt.
- Kunden sehen kein Live-Tracking waehrend der Tour.
- Demo-Daten sind deutschlandweit plausibel, aber keine echte Gebietsdatenbank.
- Haushaltszahlen und Flaechen sind Seed-/MVP-Werte und muessen fuer echte Kampagnen validiert werden.
- Verteiler muessen die Touransicht waehrend der Web-GPS-Erfassung aktiv nutzbar halten; Dauer-Hintergrundtracking ist nicht Teil des aktuellen Scopes.

## Rechtliche offene Punkte

- AGB, Datenschutz, Impressum und AV-Vertraege sind nicht produktionsfertig hinterlegt.
- GPS-Tracking und Foto-Nachweise benoetigen saubere Einwilligungs- und Aufbewahrungsregeln.
- Background-GPS waere bei spaeterer nativer App gesondert mit Einwilligung, Datenschutzfolge, App-Store-Pruefung und Betriebsprozess zu klaeren.
- Rechnungen und DATEV/Lexware-Exports muessen steuerlich geprueft werden.
- Werbeverteilung kann lokale Genehmigungen, Hausordnungen oder Einwurfverbote betreffen.
- Rollen- und Datenzugriffe sollten vor Livegang mit einem Datenschutzkonzept abgeglichen werden.

## Spaetere Module

- Modul 16: CRM und Analytics auf Basis von AuditLogs, Notifications und Statushistorien.
- E-Mail-Worker und Provider-Integration fuer NotificationQueue.
- Live-Stripe-Betrieb mit Webhook-Monitoring.
- DATEV/Lexware-Live-Schnittstellen.
- Verteiler-Abrechnung und Auszahlungen.
- Erweiterte Karten-/Routing-/Haushaltsdaten.
- Kunden-Live-Tracking und externe Statuskommunikation.
