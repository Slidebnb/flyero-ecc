# FLYERO Modul 28: Öffentliche Journey und Datenintegrität

## Ausgangspunkt

- Start-Commit: `6537a9a`
- Arbeits-Branch: `codex/module-28-public-website-integrity`
- Der öffentliche Standortkontext wird jetzt strukturiert von der Startseite an den Planer übergeben.
- Ein öffentlicher Standortkontext hat Vorrang vor einem gespeicherten Entwurf.

## Befundmatrix

| Bereich | Befund | Korrektur |
| --- | --- | --- |
| Startseite | Vorher wurde beim Absenden nur der sichtbare Suchtext übertragen. | `PublicPlannerSearch` übergibt Query, PLZ, Ort, Koordinaten, Place-ID und Quelle. |
| Draft-Restore | Ein alter öffentlicher Entwurf konnte den neuen Standort überlagern. | Draft-Schlüssel auf `v3`; Standort- und Polygonwerte werden bei explizitem URL-Kontext verworfen. |
| Geocoding | Eine reine PLZ wurde nicht streng gegen die Antwort geprüft. | Ein PLZ-Mismatch wird serverseitig mit `PUBLIC_GEOCODE_POSTAL_MISMATCH` abgelehnt. |
| Race Conditions | Späte Antworten konnten einen neueren Suchstand überschreiben. | AbortController plus monotone Request-Sequenz; nur die aktuelle Suche darf übernehmen. |
| Karte/Quote | Alte Polygone und Quotes konnten während eines Standortwechsels sichtbar bleiben. | Standortwechsel ersetzt Segmente, Polygon, Boundary und Quote atomar. |
| Nachweisvisualisierung | Statische Tour-, GPS- und Freigabestatus wirkten wie echte Ergebnisse. | `ProcessPreview` zeigt nur den gekennzeichneten Ablauf; echte Nachweise kommen aus Kampagnendaten. |
| Druckfähigkeit | Marketingtexte boten teilweise Online-Druck an, obwohl der Backend-Flow ihn blockiert. | `publicCapabilities` ist die zentrale Quelle; Online-Druck bleibt deaktiviert und wird separat besprochen. |
| Verteilanfrage | LeadForm war zu allgemein und nicht idempotent. | Strukturierte Anfragefelder, Anfragenummer und Idempotenzschlüssel ergänzt. |
| Benachrichtigung | Lead-Mails wurden nach dem Datenbankvorgang beziehungsweise nach weiteren Admin-Nachrichten versendet; dadurch entstand unnötige Verzögerung. | Queue-Eintrag bleibt revisionssicher bestehen, der direkte Provider-Versuch startet sofort parallel zu Admin-Nachrichten; Worker bleibt Retry-/Ausfallsicherung. |
| Preise | Die Preisseite erklärte die aktuelle Staffel nicht anhand echter Berechnung. | Beispiele für 500, 3.000 und 10.000 Flyer nutzen `calculateOrderPrice`. |

## Datenfluss

```text
Startseite
  -> PublicPlannerSearch
  -> validierter URL-Standortkontext
  -> SmartOrderWizard
  -> serverseitiges Geocoding mit PLZ-Prüfung
  -> atomarer Karten-/Segment-/Quote-Stand
  -> zentrale Pricing-Engine
  -> Online-Buchung oder bestehendes Lead-System
```

## Capability-Matrix

| Fähigkeit | Öffentlich |
| --- | --- |
| Standort und Preis prüfen | aktiv |
| Unverbindliche Verteilanfrage | aktiv |
| Direkte Online-Buchung | aktiv, geschützt über Kundenkonto |
| Online-Druck durch FLYERO | deaktiviert |
| Druck separat mit FLYERO besprechen | aktiv |
| Externer GPS-Nachweis nach realer Verteilung | aktiv im bestehenden Report-Prozess |

## Anfrage-Daten

Das bestehende `Lead`-Modell bleibt die zentrale Speicherung. `inquiryData` enthält nur die für die öffentliche Anfrage notwendigen Zusatzdaten: PLZ, Adresse, Flyeranzahl, Zeitraum, Flexibilität, Druckstatus, Format, Zielgruppe, Verteilart und Kampagnenziel. `inquiryNumber` wird angezeigt; `idempotencyKey` verhindert doppelte Datensätze und doppelte Benachrichtigungen bei Wiederholungen.

Bei `source=verteilung-anfragen` validiert der Server zusätzlich die strukturierten Pflichtangaben wie Firma, Telefon, Ort, PLZ, Flyeranzahl, Zeitraum, Druckstatus, Zielgruppe und Verteilart. Das Formular kann dadurch keine unvollständigen Leads als vollständige Anfrage ausgeben.

Die Anfrage erzeugt:

1. Lead und LeadActivity
2. AuditLog
3. interne Admin-/Betriebsbenachrichtigung
4. Kundenbestätigung in der bestehenden E-Mail-Queue

## E-Mail-Laufzeit

Nach dem Speichern wird der Queue-Eintrag unmittelbar einmal über den konfigurierten Provider versendet. Die Betriebsadresse wird parallel zum Erzeugen der Admin-/In-App-Nachrichten gestartet; sie wartet nicht mehr auf die vorherige Verarbeitung aller Admin-Empfänger. Der Notification-Worker bleibt als Retry- und Ausfallsicherung aktiv und prüft `PENDING`/`RETRY`-Einträge regelmäßig. `EMAIL_SEND_TIMEOUT_MS` begrenzt den direkten Provider-Versuch; Resend und der empfangende Mailserver können nach einer Provider-Annahme weiterhin verzögern. Die Anwendung kann die externe Mailbox- oder Providerlaufzeit nicht beschleunigen, protokolliert den Versand aber separat als Queue-/Providerstatus.

Nach einem Deployment muss der Timer auf dem Produktionsserver neu installiert beziehungsweise neu geladen werden:

```bash
sudo bash /opt/flyero/scripts/install-notification-worker-systemd.sh
sudo systemctl daemon-reload
sudo systemctl restart flyero-notification-worker.timer
```

## Bewusst nicht umgesetzt

- Keine neue Planner- oder Lead-Architektur.
- Keine automatische Behauptung einer exakten Haushaltsabdeckung.
- Keine Fake-Karte, Fake-GPS-Linie, Fake-Tour oder Fake-Zustellquote.
- Keine direkte Druckzahlung; Druck bleibt eine separate Anfrage.
- Keine produktive Migration zu einer nativen Verteiler-App.

## Öffentliche Messpunkte

Die öffentliche Strecke erfasst nur datensparsame Ereignisse ohne vollständige Adressen oder Secrets: Suche abgeschickt, Autocomplete ausgewählt, initiales Geocoding gestartet/aufgelöst/fehlgeschlagen, PLZ-Mismatch, veralteten Entwurf verworfen, Standort ersetzt oder Standortsuche fehlgeschlagen. Diese Ereignisse nutzen ein eigenes Public-Experience-Rate-Limit und konkurrieren nicht mit Geocoding-/Quote-Limits.
