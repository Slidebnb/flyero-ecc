# FLYERO Incident-Response-Prozess

## Ziel

Dieser Prozess stellt sicher, dass Sicherheits-, Zahlungs-, Datenverlust- und
Verfuegbarkeitsvorfaelle erkannt, eingedammt, untersucht und nachvollziehbar
abgeschlossen werden.

## Schweregrade

| Stufe | Beispiel | Reaktion |
| --- | --- | --- |
| P0 | Datenverlust, Tenant-Datenleck, kompromittiertes Secret, Zahlungsmanipulation | sofortiger Incident Lead, Zugriff ggf. sperren, Geschaeftsfuehrung und Datenschutzverantwortliche informieren |
| P1 | Upload-Malware, wiederholte Auth-Angriffe, Stripe-Reconciliation-Abweichung, Produktionsausfall | innerhalb eines Arbeitstages triagieren und Massnahme planen |
| P2 | einzelner Fehler ohne Daten- oder Zahlungsrisiko | normaler Engineering-Prozess |
| P3 | Verbesserung oder Warnung | Backlog und Review |

## Rollen

- Incident Lead koordiniert Entscheidungen und Zeitlinie.
- Technical Lead analysiert Code, Logs, Infrastruktur und Eindammung.
- Datenschutzverantwortliche bewertet personenbezogene Daten und Meldepflicht.
- Finanzverantwortliche bewertet Zahlungen, Refunds und Stripe-Abweichungen.
- Communications Owner steuert Kunden- und Dienstleisterkommunikation.

Eine Person darf mehrere Rollen uebernehmen, solange die Entscheidung im
Incident-Eintrag dokumentiert ist.

## Ablauf

1. **Erkennen:** Alarm, Nutzerhinweis, CI, AuditLog, Stripe-Reconciliation oder
   Backuppruefung erfassen.
2. **Einstufen:** Schweregrad, betroffene Tenants, Datenklassen, Zeitraum und
   aktuelle Unsicherheit festhalten.
3. **Eindammen:** betroffene Route sperren, Session/Token widerrufen, Secret
   rotieren, Uploads quarantainieren oder Checkout stoppen.
4. **Beweise sichern:** Request-ID, AuditLog, relevante Hashes, Zeitstempel und
   Systemzustand sichern. Keine Passwoerter oder Token kopieren.
5. **Beheben:** Ursache patchen, Migration/Restore nur mit Change-Freigabe,
   Regressionstest ergaenzen.
6. **Wiederherstellen:** Health, Login, Kundenportal, Downloads, Zahlungen und
   Tenant-Scope gezielt pruefen.
7. **Kommunizieren:** Betroffene und Behoerden nur nach rechtlicher Bewertung
   und mit geprueften Fakten informieren.
8. **Nachbereiten:** Root Cause, Impact, Timeline, Massnahmen, Owner und Due Date
   in einem Post-Incident-Report dokumentieren.

## Spezifische Sofortmassnahmen

- **Secret-Leak:** Secret nicht im Chat oder Git weitergeben, sofort rotieren,
  Sessions/Keys bewerten, Repository und Logs pruefen.
- **Tenant-IDOR:** betroffene Endpunkte sperren, Zugriffsdaten und AuditLogs
  sichern, A/B-Test ergaenzen, Kunden- und Datenschutzbewertung starten.
- **Stripe:** Checkout-Neustart stoppen, Webhook-Signatur und Event-ID pruefen,
  Reconciliation ausfuehren, keine manuelle Statusaenderung ohne AuditLog.
- **Upload/Malware:** Datei quarantainieren, customerVisible deaktivieren,
  Scanstatus und betroffene Versionen pruefen.
- **Datenverlust:** Schreibzugriffe kontrolliert stoppen, letzten validierten
  Snapshot identifizieren, isolierten Restore durchfuehren und erst danach
  Produktionswiederherstellung freigeben.

## Mindestdokumentation

Jeder P0/P1-Incident enthaelt Incident-ID, Entdecker, Owner, Schweregrad,
betroffene Systeme/Tenants, Zeitlinie, Datenklassen, Eindammung, Ursache,
Kommunikation, Wiederherstellung, Lessons Learned und offene Massnahmen.

Der Prozess ersetzt kein externes 24/7-Monitoring und keinen nachgewiesenen
Hetzner-Restore; diese Betriebsnachweise bleiben offen.
