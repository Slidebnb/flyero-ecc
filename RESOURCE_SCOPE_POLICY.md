# FLYERO Resource Scope Policy

Stand: 13.07.2026

Dieses Dokument trennt bewusst zwischen tenant-sensiblen FLYERO-Daten und
plattformweiten Betriebs- oder Voraccount-Ressourcen. Ein fehlendes `tenantId`
ist nur dann zulaessig, wenn die Ressource fachlich nicht zu genau einem
Unternehmen gehoert.

## Tenant-sensible Ressourcen

Diese Ressourcen muessen bei jedem kunden- oder unternehmensbezogenen Lesen,
Mutieren und Download serverseitig gegen die aktive Tenant-Mitgliedschaft
geprueft werden:

- `CustomerProfile`
- `Order`, `Payment`, `Refund` und `Invoice`
- `Document`, `DocumentVersion` und Druckauftraege
- `Report`, `DistributionTour`, externe Nachweise und freigegebene Fotos
- kundengebundene `DistributionArea`- und `OrderExperienceEvent`-Daten
- `SupportTicket`, wenn es einen Kunden-, Auftrag-, Tour- oder Reportbezug hat
- Dispatch-, Lager-, Sendungs-, Transfer- und Inventurdaten mit Auftragsbezug
- Analytics- und Exportabfragen, sobald sie Unternehmensdaten aggregieren

Fuer diese Bereiche ist `requirePermission()` mit aktiver
`TenantMembership` die bevorzugte API-Grenze. Der Zugriff auf eine konkrete
Ressource verwendet `tenantWhereForSession()` oder einen gleichwertigen
Relation-Scope. Ein vorheriger Frontend-Check ist keine Sicherheitsgrenze.

## Plattformweite Ressourcen

Die folgenden Objekte sind im aktuellen MVP bewusst plattformweit:

- `Lead`, `LeadNote` und `LeadActivity`: Ein Lead wird ueber die oeffentliche
  Website erzeugt, bevor ein Kundenmandant existiert. Nach Conversion kann er
  ueber `wonCustomerId` einem Kundenkonto zugeordnet werden. CRM-Zugriff ist
  ausschliesslich auf Admin/Support beschraenkt.
- `SystemHealthCheck`, `ErrorLog`, `SystemLog` und `BackgroundJobLog`: Diese
  beschreiben den Betrieb der gesamten FLYERO-Plattform und werden nur im
  geschuetzten Monitoringbereich fuer interne Betriebsrollen angezeigt.
- Notification-Vorlagen, Versandqueue und plattformweite Nummernkreise:
  Diese dienen dem zentralen Betrieb und sind keine Kundendatenansichten.

Plattformweit bedeutet nicht oeffentlich. Diese Daten bleiben serverseitig
rollenbeschraenkt und duerfen keine Kunden- oder Verteileransicht erreichen.

## Rollenregeln

- `ADMIN` hat im aktuellen Modell eine plattformweite Sicht. Eine spaetere
  Trennung zwischen Plattform-Superadmin und Unternehmensadmin ist noch offen.
- `SUPPORT_DISPATCHER` benoetigt fuer sensible tenant-sensible Aktionen eine
  aktive Mitgliedschaft und die passende Permission, zum Beispiel
  `REPORT_REVIEW`, `DOCUMENT_REVIEW`, `INVOICE_VIEW` oder `ANALYTICS_VIEW`.
- Kunden, Verteiler und Lagerrollen erhalten niemals CRM- oder Monitoringdaten.

## Aktueller Nachweis

Tenant-Scopes und Permission-Vertraege sind fuer Customer-Kernobjekte,
Analytics, Dispatch, Logistik, Reports, externe Evidence und interne
Rechnungs-PDF-Downloads umgesetzt. Die Customer-A/B-Matrix prueft zusaetzlich
Listen, Details und geschuetzte Downloads fuer Auftraege, Dokumente,
Rechnungen, Zahlungen und Reports gegen zwei echte Demo-Tenants. Contract-Smokes
decken die zentralen Pfadregeln ab.

## Bewusst offene Punkte

- Vollstaendige A/B-IDOR-Tests fuer jede interne Ressource fehlen noch; die
  aktuelle Matrix umfasst die Customer-Kernkette und ersetzt keine Tests fuer
  Support-, Lager-, Dispatch- und Admin-Ressourcen.
- Die globale CRM-Policy braucht fuer einen spaeteren Enterprise-Betrieb eine
  fachliche Entscheidung: zentrale FLYERO-Vertriebspipeline oder CRM je
  Unternehmen. Erst danach ist eine `tenantId`-Migration fuer Leads sinnvoll.
- Monitoring bleibt plattformweit, benoetigt aber externe Alarmierung,
  Aufbewahrungsregeln und ein manipulationsgeschuetztes Archiv.
- Plattformrollen sind noch nicht in Superadmin, Unternehmensadmin und
  Support-Organisation getrennt.
