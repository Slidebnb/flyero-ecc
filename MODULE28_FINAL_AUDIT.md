# FLYERO Modul 28: Abschlussaudit

## Ergebnis in einem Satz

Die öffentliche Strecke ist technisch gegen alte Standortentwürfe, PLZ-Fehlzuordnung, doppelte Anfragen, öffentliche Fake-Nachweise und uneinheitliche CTAs abgesichert. Die aktuelle Produktions-Mailkette übergibt Betriebsnachrichten direkt an den konfigurierten Provider; eine Verzögerung nach dem Provider-Akzeptieren liegt außerhalb der Anwendung und muss über Provider-/Mailbox-Zustellung geprüft werden.

## Befundmatrix

| Thema | Status | Nachweis | Risiko / Maßnahme |
| --- | --- | --- | --- |
| Standort von Homepage zum Planer | behoben | `PublicPlannerSearch.tsx`, `public-location-navigation-runtime.mjs` | Query, PLZ, Ort, Koordinaten, Place-ID und Quelle werden strukturiert übertragen. |
| Alte Entwürfe überschreiben neue PLZ | behoben | `SmartOrderWizard.tsx`, Draft-Version `v3` | Expliziter URL-Kontext hat Vorrang; alte Standort-/Polygonwerte werden verworfen. |
| Veraltete Karten-/Quote-Antworten | behoben | `SmartOrderWizard.tsx` | AbortController und monotone Request-Sequenz verhindern verspätete Überschreibungen. |
| Falsche reine PLZ-Antwort | behoben | `/api/public/planner/geocode` | Server lehnt einen erkannten PLZ-Mismatch ab; es gibt keinen stillen lokalen Stadt-Fallback. |
| Mehrgebiete | vorhanden | Order-Segmente und Module-27.1-Tests | Segmente bleiben getrennt; Gesamtquote wird serverseitig erzeugt. |
| Öffentliche Nachweisgrafiken | behoben | `ProcessPreview`, `ProofStatusPanel`, `module16-landing-smoke.mjs` | Keine echte Kampagne, GPS-Spur oder Prüfung wird aus Marketing-Markup behauptet. |
| Online-Druck | bewusst deaktiviert | `src/lib/publicCapabilities.ts` | Druck bleibt eine separate Kontakt-/Anfrageleistung. |
| Anfrageformular | behoben | `LeadForm.tsx`, `/api/leads`, `public-inquiry-runtime.mjs` | Strukturierte Pflichtangaben, Idempotenzschlüssel, Anfragenummer, Audit und Benachrichtigungen. |
| Anfrage-CTA je Zielgruppe | behoben | `/fuer-unternehmen`, `AudienceCard` | Jede Zielgruppe führt mit eigener Handlungsbeschriftung zur Anfrage. |
| Preisbeispiele | behoben | `/preise`, zentrale Pricing-Engine | Keine zweite Preisformel im Marketing. |
| E-Mail an Betrieb | technisch direkt versucht | `notifyOperations`, `dispatchNotificationImmediately` | Queue-Eintrag wird gespeichert und sofort an Resend/SMTP übergeben; Worker ist Retry-Fallback. |
| E-Mail-Zustellung im Postfach | extern zu verifizieren | `deliveryLatencyMs`, Resend-Dashboard | `SENT` bedeutet Provider-Annahme. Provider-/Mailbox-Zustellung wird nicht von der App kontrolliert. |
| Public Analytics | behoben | `/api/public/planner/experience`, `public-analytics-runtime.mjs` | Start, Erfolg und Fehler der Anfrage sind datensparsam und ohne freie Adressdaten. |
| SEO/Kanonicals | geprüft | `src/app/seo.ts`, `layout.tsx` | `flyero.org` ist die konfigurierte kanonische Basis; öffentliche Routen sind registriert. |
| Mobile/Accessibility | geprüft | `module28-public-playwright.mjs`, `visual:marketing` | Desktop und mobile Routen werden ohne horizontalen Überlauf und mit sichtbarer Navigation geprüft. |

## Verbindlicher Datenfluss

```text
öffentliche Suche
  -> URL-Standortkontext
  -> SmartOrderWizard
  -> serverseitiges Geocoding
  -> PLZ-/Kontextprüfung
  -> atomare Segmente, Polygon- und Quote-Aktualisierung
  -> zentrale Pricing-Engine
  -> Online-Buchung oder idempotente Anfrage
```

## Anfrage- und E-Mail-Verhalten

Eine Anfrage erzeugt in einem nachvollziehbaren Ablauf:

1. Lead mit Anfragenummer und strukturierten `inquiryData`
2. Lead-Aktivität
3. AuditLog
4. interne Betriebsnachricht an `OPERATIONS_EMAIL`
5. Kundenbestätigung an die Anfrageadresse

Die Betriebsnachricht wird nach dem Queue-Insert direkt versucht. `NotificationQueue.sentAt` und `NotificationLog.metadata.deliveryLatencyMs` messen die Zeit vom Queue-Eintrag bis zur Provider-Antwort. Wenn diese Zeit niedrig ist, die Mail aber später im Postfach erscheint, ist das eine Resend-/Empfänger-Mailbox-Verzögerung. Dafür muss die Resend-Ereignisansicht oder ein Resend-Webhook als externe Zustellquelle herangezogen werden.

### Produktionsdiagnose

Auf Hetzner für eine konkrete Nachricht ausführen:

```bash
cd /opt/flyero
docker compose --env-file /opt/flyero/.env.production -f docker-compose.production.yml exec -T postgres psql -U flyero -d flyero -c "SELECT q.id, q.status, q.attempts, q.provider, q.\"providerMessageId\", q.\"createdAt\", q.\"sentAt\", q.\"lastError\", l.metadata FROM \"NotificationQueue\" q LEFT JOIN \"NotificationLog\" l ON l.\"queueId\" = q.id AND l.action = 'email.sent' WHERE q.\"recipientEmail\" = 'hallo@flyero.org' ORDER BY q.\"createdAt\" DESC LIMIT 10;"
```

Interpretation:

- `status=SENT`, niedrige Differenz zwischen `createdAt` und `sentAt`: App/Provider-Annahme war schnell; Verzögerung liegt danach.
- `RETRY` oder hohe Differenz: Resend-Aufruf, Netzwerk, Container oder Retry-Worker prüfen.
- `FAILED`: `lastError` zuerst beheben; keine erfolgreiche Zustellung annehmen.

## Claims- und Mock-Regeln

Öffentliche Seiten zeigen keine echten Kampagnen-, GPS-, Tour- oder Zustellstatusdaten. Das Prozesspreview ist ausdrücklich als beispielhafter Ablauf gekennzeichnet. Reale GPS-, Foto- und PDF-Nachweise bleiben an veröffentlichte Kampagnen-/Reportdaten gebunden.

## Migrationen und Rückwärtskompatibilität

Modul 28 erzeugt keine neue Datenbankmigration. Bestehende Modul-27.1-Tabellen, Statusketten und Mehrgebietsstrukturen bleiben unverändert. Die Anfrage nutzt das vorhandene `Lead`-Modell; es wird keine parallele Inquiry-V2-Struktur eingeführt.

## Ausgeführte Prüfungen

Erfolgreich ausgeführt:

- `npx prisma validate`
- `npm run prisma:generate`
- `npm run prisma:migrate deploy`
- `npm run test:module27-1-runtime`
- `npm run test:module27-1-playwright`
- `npm run test:customer-order-area`
- `npm run test:customer-order-checkout`
- `npm run test:public-abuse`
- `npm run test:maps-abuse`
- `npm run test:pricing-system-linkage`
- `npm run test:pricing-admin-propagation`
- `npm run test:operations-email-runtime`
- `npm run test:module16-landing`
- `npm run test:module28-public-runtime`
- `npm run test:module28-public-playwright`
- `npm run test:module28-public-production-parity`
- `npm run visual:marketing`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:ci-config`
- `npm run test:operations-email-routing`
- `npm run test:production-preflight`
- `git diff --check`

Die aktuelle Playwright-Abdeckung prüft zusätzlich `/verteilung-planen`, `/kontakt`, `/so-funktionierts` und `/fuer-unternehmen` auf Desktop und Mobil. Ein aktueller GitHub-Actions-Lauf für Commit `cb67bfd` war zum Auditzeitpunkt über die GitHub-API noch nicht sichtbar; das ist eine externe Verifikationslücke und kein lokaler Testnachweis.

## Offen vor echtem Launch

- Resend-Zustellereignisse für Betriebs-E-Mails optional per Webhook korrelieren, damit Provider-Annahme und tatsächliche Zustellung getrennt sichtbar sind.
- Einen echten Produktions-Lead mit Testadresse auslösen und `createdAt`, `sentAt`, Resend-Status und Posteingang zeitgleich dokumentieren.
- Google Maps Browser-Key, Domainrestriktionen und Kostenlimits in der Produktionsumgebung regelmäßig prüfen.
- Rechtliche Prüfung von Datenschutz, Auftragsverarbeitung, Tracking- und Nachweistexten abschließen.

