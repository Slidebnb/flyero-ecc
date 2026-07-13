# FLYERO Datenklassifizierung

## Zweck

Die Klassifizierung legt Mindestregeln fuer Zugriff, Speicherung, Logging,
Weitergabe und Loeschung fest. Eine Klassifizierung ersetzt keine rechtliche
Bewertung der konkreten Verarbeitung.

## Klassen

| Klasse | Beispiele | Mindestschutz |
| --- | --- | --- |
| Oeffentlich | Landingpage, oeffentliche Leistungsbeschreibung, robots.txt | Integritaet und HTTPS |
| Intern | interne Prozessdoku, technische Metriken ohne Personenbezug | RBAC, kein unnoetiger Export |
| Vertraulich | Kundenkontakte, Auftraege, Rechnungen, Support, Vertragsdaten | Tenant-Scope, private Speicherung, autorisierte Downloads |
| Besonders sensibel | GPS-Punkte, Foto-Metadaten, Verteilerprofile, Audit-/Sicherheitsdaten, Zahlungsreferenzen | Least Privilege, private Speicherung, reduzierte Ausgabe, Fristen und Auditierung |

## Dateninventar

| Daten | Zweck | Zugriff | Speicherort | Friststatus |
| --- | --- | --- | --- | --- |
| Kunden- und Kontaktdaten | Auftrag, Kommunikation, Rechnung | Kunde eigener Tenant, berechtigte interne Rollen | PostgreSQL/private Storage | fachliche Frist zu bestaetigen |
| Gebiete und Gebietsschaetzungen | Planung und Preis | eigener Tenant, berechtigte Disposition | PostgreSQL | fachliche Frist zu bestaetigen |
| Flyer-/Druckdateien | Produktion und Verteilung | Kunde eigener Auftrag, Review-Rollen | privater Storage | nach Auftrag/Legal Hold festlegen |
| GPS-Nachweise und Tourdaten | Verteilnachweis | berechtigte interne Rollen, freigegebene Kundendaten | private DB/Storage | GPS-Frist rechtlich festlegen |
| Fotos | Nachweis und Bericht | nur freigegebene Fotos beim Kunden | private Storage/DB-Metadaten | Foto-Frist rechtlich festlegen |
| Rechnungen und Zahlungsreferenzen | Buchhaltung und Nachweis | Kunde eigener Tenant, Finance/Admin | PostgreSQL/private Storage | gesetzliche Frist pruefen |
| AuditLogs | Sicherheit, Nachweis, Incident Response | Admin/Monitoring mit Least Privilege | PostgreSQL, spaeter externes Archiv | manipulationsgeschuetzte Frist offen |
| Auth- und Rate-Limit-Daten | Kontosicherheit und Abuse-Schutz | System/eng berechtigte Admins | PostgreSQL | automatisierte Basisbereinigung vorhanden |

## Regeln

- Besonders sensible Daten werden nicht in URL-Parametern, Client-Dummyobjekten
  oder ungeschuetzten Public-Pfaden abgelegt.
- Exporte enthalten nur den benoetigten Umfang und werden privat ausgeliefert.
- Screenshots, Testfixtures und Logs muessen personenbezogene Werte maskieren.
- GPS-Rohdaten werden nicht pauschal an Kunden ausgeliefert; Kunden erhalten nur
  freigegebene Nachweise und verstaendliche Zusammenfassungen.
- Neue Datenfelder benoetigen Zweck, Zugriff, Frist und Loeschverantwortlichen.

## Offene Freigaben

Rechtsgrundlage, Einwilligungs-/Informationsprozess fuer GPS und Fotos,
Aufbewahrungsfristen, Verschluesselung at rest, AVV/Subprocessor und Legal Hold
muessen vor echtem Kundenbetrieb fachlich und rechtlich freigegeben werden.
