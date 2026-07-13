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
  `REPORT_REVIEW`, `DOCUMENT_REVIEW`, `INVOICE_VIEW`, `ANALYTICS_VIEW` oder
  `SUPPORT_TICKET_VIEW/MANAGE`. Support-Tickets bleiben als zentraler
  Betriebsprozess plattformweit sichtbar, werden aber nicht mehr nur ueber die
  Rollenbezeichnung freigeschaltet.
- Kunden, Verteiler und Lagerrollen erhalten niemals CRM- oder Monitoringdaten.

## Aktueller Nachweis

Tenant-Scopes und Permission-Vertraege sind fuer Customer-Kernobjekte,
Analytics, Dispatch, Logistik, Reports, externe Evidence und interne
Rechnungs-PDF-Downloads sowie Lagerbestand-/Inventur-Schutz fuer zugewiesene
Lager umgesetzt. Die Customer-A/B-Matrix prueft zusaetzlich
Listen, Details und geschuetzte Downloads fuer Auftraege, Dokumente,
Rechnungen, Zahlungen und Reports gegen zwei echte Demo-Tenants. Der
Warehouse-Scope-Smoke prueft QR, Check-in, Status, Lagerplatz und Inventur
gegen ein fremdes Lager. Contract-Smokes decken die zentralen Pfadregeln ab.

Die Verteileransicht verwendet fuer Auftraege und Lagerdaten explizite
Privacy-Whitelists. Verteiler erhalten nur operative Angaben wie
Auftragsnummer, Gebiet, Ort, Flyerzahl, Abholfach und QR-Status; Kundenobjekte,
Kundenkontaktfelder und interne Lagerkontakte werden nicht serialisiert.
Eigene Tourdetails sind ueber `distributorId` geschuetzt, fremde Tour-IDs
liefern `404`. Der Contract-Smoke `npm run test:distributor-privacy` prueft
API-Responses und gerenderte Verteilerseiten gegen echte Seed-Touren.

Lageransichten verwenden ebenfalls eine explizite Privacy-Whitelist. Lagerrollen
sehen Auftragsnummer, Ort, Gebiet, Mengen, Status und notwendige Lagerdaten,
aber keine vollstaendigen Kundenobjekte, Firmennamen oder Antragsteller-/Freigabe-
Benutzerobjekte aus Umlagerungen. Der Contract-Smoke
`npm run test:warehouse-privacy` prueft diese sichtbaren Lagerpfade.
Die Wareneingangsliste filtert ausserdem nach `assignedWarehouseId`; ein
Lagerzugang erhaelt keine fremden Auftragsauswahlen. Der Warehouse-Scope-Smoke
prueft diesen Seitenpfad neben den API-Mutationen.

Der geschuetzte Foto-Download prueft bei Kunden zusaetzlich Auftragseigentum,
`customerVisible` und den Status `APPROVED`. Interne oder noch nicht
freigegebene Fotos liefern auch dann `404`, wenn der Kunde die eigene
Auftrags-ID kennt. Das prueft `npm run test:proof-download-privacy`.

Interne Tour- und Logistik-APIs verwenden ebenfalls explizite Benutzer- und
Kunden-Whitelists. Passwort-Hashes, vollstaendige Kundenadressen und andere
Profilfelder werden nicht an die Browserantwort angehaengt. Der Contract-Smoke
`npm run test:internal-response-privacy` schuetzt diese Grenze.

Support-/Dispatcher-Logistikseiten verwenden dieselbe Mandantengrenze wie die
APIs: Sendungen, Auftragseingaben und Lagerdetail-Bestände werden auf die
aktive `tenantId` beschränkt. Nur Admin darf die Plattformdaten global sehen.

Support-Tickets sind ebenfalls tenantbezogen: Support-Dispatcher erhalten nur
Tickets ihres aktiven Mandanten und dürfen keine fremden Kunden-/Auftragsbezüge
anlegen oder ändern. Nur Plattform-Admins haben globale Ticket-Sicht.

Druckaufträge verwenden dieselbe Trennung: Listen und Änderungen eines
Support-Dispatchers sind auf `tenantId` begrenzt; Plattform-Admins bleiben
global berechtigt.

Die Admin-Reportdetailseite verwendet dieselbe Tenant-/Permission-Policy wie die
Report-APIs; Support kann fremde Reports nicht per ID laden und sieht keine
unzulässigen Publish-/Archive-Aktionen.

Die Route-Analyse verwendet denselben Grundsatz: Kunden und Verteiler lesen
nur ihre eigene Tour, Admins die Plattformsicht. Die Query laedt keine
Kunden-/Verteilerprofile fuer eine nachgelagerte Pruefung und gibt bei fremden
Tour-IDs `404` zurueck. `npm run test:route-analysis-privacy` prueft eigene
und fremde Touren.

Die authentifizierten Google-Maps-Proxies sind mit einem gemeinsamen
persistenten IP-Limiter geschuetzt. Autocomplete, Geocoding und
Order-Intelligence verwenden den Scope `maps`; die Grenzwerte werden ueber
`PUBLIC_MAPS_RATE_LIMIT_MAX` und `PUBLIC_MAPS_RATE_LIMIT_WINDOW_MS`
konfiguriert. Das begrenzt Google-Kostenmissbrauch, ersetzt aber keinen
externen WAF- oder Edge-Limiter.

Die interne Heatmap verwendet fuer `SUPPORT_DISPATCHER` denselben Tenant-Scope
wie Analytics und akzeptiert keine reine Rollenfreigabe ohne aktive
Mitgliedschaft. Die globale Ansicht bleibt ausschliesslich der Plattformrolle
`ADMIN` vorbehalten.

Der oeffentliche Client-Error-Endpunkt verwendet ebenfalls einen persistenten
IP-Limiter (`client-error`). Er darf nur gekuerzte, nicht-sensitive
Fehlerhinweise ins plattformweite Monitoring schreiben; ein externer
Edge-Limiter und Alarmierung bleiben zusaetzliche Produktionsaufgaben.

Die Auth-Sitzungsverwaltung stellt dem eingeloggten Benutzer aktive eigene
Sitzungen bereit und kann alle anderen noch gueltigen Sitzungen widerrufen.
Die aktuelle Sitzung bleibt dabei aktiv. Die Antwort ist privat und wird nicht
gecacht; der Vorgang wird als `auth.sessions_revoked` auditiert. Der Contract-
Smoke `npm run test:auth-session-management` prueft zwei echte Logins,
Sitzungsanzeige, Widerruf der zweiten Sitzung und die weitere Gueltigkeit der
aktuellen Sitzung.

Die Admin-Druckauftragsrouten erzwingen `print-order.view` bzw.
`print-order.manage` und pruefen damit zusaetzlich die aktive
Unternehmensmitgliedschaft; die bestehende Support-Sicht bleibt auf
`tenantId` begrenzt.

## Bewusst offene Punkte

- Vollstaendige A/B-IDOR-Tests fuer jede interne Ressource fehlen noch; die
  aktuelle Matrix umfasst die Customer-Kernkette und ersetzt keine Tests fuer
  Support-, Lager-, Dispatch- und Admin-Ressourcen.
- Die Sitzungsverwaltung bietet aktuell die eigene Sitzungsliste und den
  Widerruf aller anderen Sitzungen. Einzelnes Geraetewiderrufen, MFA,
  Passwort-Historie und automatische Bereinigung abgelaufener Sitzungen sind
  weiterhin offen.
- Die globale CRM-Policy braucht fuer einen spaeteren Enterprise-Betrieb eine
  fachliche Entscheidung: zentrale FLYERO-Vertriebspipeline oder CRM je
  Unternehmen. Erst danach ist eine `tenantId`-Migration fuer Leads sinnvoll.
- Monitoring bleibt plattformweit, benoetigt aber externe Alarmierung,
  Aufbewahrungsregeln und ein manipulationsgeschuetztes Archiv.
- Die Verteiler-Privacy-Pruefung deckt die aktuellen Tour-, Auftrags- und
  Lageransichten ab; weitere interne Dispatch- und Support-Responses brauchen
  weiterhin eine vollstaendige Laufzeitmatrix.
- Plattformrollen sind noch nicht in Superadmin, Unternehmensadmin und
  Support-Organisation getrennt.

Der Admin-Logistikdetailpfad filtert BestÃ¤nde, Sendungen, Umlagerungen und
Inventuren fÃ¼r Support ebenfalls auf die aktive `tenantId` und serialisiert
nur operative Auftragsreferenzen. Lager-StammdatenÃ¤nderungen Ã¼ber diesen
Pfad erfordern `warehouse.view` und sind damit an die aktive Mitgliedschaft
gebunden; StammdatenÃ¤nderungen Ã¼ber diesen Pfad sind mit `warehouse.manage`
ausschlieÃŸlich Admins vorbehalten.
