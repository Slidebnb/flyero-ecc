# FLYERO API-Vertragsbaseline

## Status

Dieses Dokument beschreibt den aktuellen internen API-Vertrag der Next.js-
Anwendung. Es ist eine Baseline fuer Wartung, Security-Reviews und spaetere
OpenAPI-Generierung. Es ist noch keine vollstaendige maschinenlesbare
OpenAPI-Spezifikation fuer alle Routen.

## URL- und Versionsregeln

- Aktuelle interne Routen liegen unter `/api/...` und sind nicht als externe
  Partner-API freigegeben.
- Neue externe oder mobile Integrationen werden erst unter `/api/v1/...`
  eingefuehrt.
- Bestehende `/api`-Routen werden nicht stillschweigend inkompatibel geaendert;
  Breaking Changes benoetigen Migration, Release-Notiz und Deprecation-Frist.
- Die kanonische Quelle der Route-Liste ist der Next-Build sowie die Dateien
  unter `src/app/api`.

## Antwortformat

Erfolgreiche JSON-Antworten verwenden nach Moeglichkeit:

```json
{"ok":true,"data":{}}
```

Fehler verwenden nach Moeglichkeit:

```json
{"ok":false,"error":"Verstaendliche Fehlermeldung"}
```

Clients duerfen sich nicht auf interne Stacktraces, Prisma-Codes oder
ungepruefte Datenbankdetails verlassen. Statuscodes bleiben semantisch:
`400` fuer ungueltige Eingabe, `401` fuer fehlende Anmeldung, `403` fuer
fehlende Berechtigung, `404` fuer nicht sichtbare Ressource, `409` fuer
ungueltigen Zustand und `5xx` fuer nicht behobene Serverfehler.

## Authentifizierung und Mandant

- Geschuetzte Browser-/API-Routen verwenden die serverseitige Session.
- `requirePermission()` prueft Rolle, Permission und aktive Tenant-Membership.
- Kundenressourcen werden auf Benutzer und `tenantId` eingeschraenkt.
- Support-/Disposition-Ressourcen erhalten den Tenant-Scope ueber die zentrale
  Policy bzw. den jeweiligen Scope-Helper.
- Plattformweite Admin-Aktionen bleiben bis zur Trennung von Plattform- und
  Unternehmensrollen ein eigener Auditpunkt.
- Frontend-Guards sind nur UX; API-Pruefungen sind verbindlich.

## Request-Korrelation

- Der Proxy akzeptiert eine validierte `x-request-id` oder erzeugt eine UUID.
- Die ID wird an die Route weitergegeben und in der Response zurueckgegeben.
- Audit- und technische Logs uebernehmen den aktuellen Request-Kontext.
- IP-Adresse und User-Agent sind personenbezogene Betriebsdaten und werden
  gekuerzt bzw. nach der Retention-Policy behandelt.

## Kritische Vertragsregeln

### Zahlungen

- Checkout wird serverseitig mit dem aktuellen Preis-Snapshot erzeugt.
- Stripe-Webhooks werden aus dem Rohbody mit Signatur und Event-ID verarbeitet.
- Wiederholte Events muessen idempotent bleiben.
- Mock-Zahlungen sind im Produktions-Preflight verboten.

### Downloads und Dateien

- Kunden-, Report-, Rechnungs- und Dokumentdownloads sind authentifiziert,
  tenant-/eigentumsgeprueft und privat.
- Uploads benoetigen serverseitige Groessen-, Typ-, Struktur- und Scanpruefung.
- Interne Dateien werden nicht ueber erratbare Public-URLs veroeffentlicht.

### Status und Mutationen

- Statuswechsel werden ueber zentrale Transition-Pruefungen validiert.
- Preis-, Zahlungs-, Freigabe- und Berichtsmutationen schreiben AuditLogs.
- Wiederholte Mutation muss entweder idempotent sein oder mit `409` abgewiesen
  werden.

## Betriebsgrenzen

- Rate Limits, Response-Timeouts, Pagination und Exportgroessen muessen je Route
  gegen das konkrete Lastprofil geprueft werden.
- Externe Partner erhalten noch keinen stabilen, versionierten Vertrag.
- OpenAPI-Schema, generierte Clienttypen und automatischer Contract-Test fuer
  alle 187 Routen sind noch offen.
