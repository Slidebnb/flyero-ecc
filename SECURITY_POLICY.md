# FLYERO Security Policy

## Zweck und Geltungsbereich

Diese Policy beschreibt die technischen Mindestkontrollen fuer FLYERO, seine
Mitarbeiter, Dienstleister und Produktionssysteme. Sie gilt fuer Quellcode,
Entwicklungs- und Produktionsumgebungen, Datenbank, private Nachweise,
Zahlungen, Backups und administrative Zugriffe.

Die Policy ist ein Betriebsrahmen und keine bestaetigte ISO-27001-Zertifizierung.
Kontrollen muessen mit Logs, CI-Ergebnissen, Deploymentdaten oder externen
Dienstleister-Nachweisen belegt werden.

## Sicherheitsgrundsaetze

- Zugriff nach Least Privilege und zentraler Permission-Matrix.
- Autorisierung serverseitig; Frontend-Sichtbarkeit ist keine Sicherheit.
- Jeder kundenbezogene Zugriff wird tenantbezogen geprueft.
- Secrets liegen ausserhalb des Repositories und werden nicht geloggt.
- Private Dokumente, Reports, Rechnungen und Fotos werden nur ueber autorisierte
  Downloads ausgeliefert.
- Uploads werden typ-, groessen- und strukturgeprueft und vor Freigabe gescannt.
- Bezahlte Auftraege, Stripe-Webhooks und Statuswechsel sind idempotent bzw.
  werden durch AuditLogs nachvollziehbar gemacht.
- Sicherheitsrelevante Aenderungen werden reviewt und ueber CI verifiziert.

## Verantwortlichkeiten

| Bereich | Verantwortlich | Nachweis |
| --- | --- | --- |
| Plattform- und Secret-Betrieb | Betreiber | Hetzner-/Secret-Review |
| Rollen und Berechtigungen | Plattform-Admin | Permission-Matrix, AuditLog |
| Zahlungen und Webhooks | Finanz-/Plattformverantwortliche | Stripe-Reconciliation, AuditLog |
| Uploads und Nachweise | Plattform-Admin | Scanstatus, Freigabeprotokoll |
| Backups und Restore | Betreiber | Restic-Snapshot, Restore-Protokoll |
| Datenschutz und Fristen | Verantwortliche Stelle | Rechtsfreigabe, Retention-Review |

## Kontrollen

### Identitaet und Zugriff

- Passwort-Login, Session-Widerruf und DB-autorisierte Membership-Pruefung sind
  aktiv.
- Admin- und Supportzugriffe benoetigen die passende Permission.
- MFA, SSO und regelmaessige Access Reviews sind vor Enterprise-Betrieb noch
  einzufuehren.
- Produktionszugriffe werden personengebunden vergeben; gemeinsame Konten sind
  nicht zulaessig.

### Anwendung und Daten

- Input wird serverseitig validiert.
- Origin-/CSRF-Pruefungen gelten fuer Cookie-basierte Mutationen.
- Security-Header und private Download-Header sind Bestandteil der CI-Smokes.
- Tenant-Scope- und A/B-IDOR-Tests werden fuer kritische Ressourcen erweitert.
- GPS-, Foto- und Kundendaten werden nicht als oeffentliche Demo-Nachweise
  ausgegeben.

### Infrastruktur

- Produktion wird ausschliesslich ueber HTTPS betrieben.
- PostgreSQL bleibt im privaten Docker-Netz; der Datenbankport wird nicht
  oeffentlich exponiert.
- Storage fuer Dokumente und generierte Dateien muss privat und persistent sein.
- Offsite-Backup, Malware-Scanner, externes Monitoring und Restore-Nachweis sind
  vor echtem Kundenbetrieb verbindlich zu aktivieren.

## Sicherheitsvorfaelle

Sicherheitsereignisse werden nach `INCIDENT_RESPONSE.md` behandelt. Secrets,
Passwoerter, Tokens und vollstaendige personenbezogene Inhalte duerfen weder in
Tickets noch in Logs kopiert werden.

## Review und Ausnahmen

Die Policy wird mindestens quartalsweise und nach einem Sicherheitsvorfall
geprueft. Ausnahmen benoetigen Begruendung, Risikoakzeptanz, Verantwortlichen,
Ablaufdatum und einen dokumentierten Ersatz- oder Nachbesserungsplan.

## Aktueller Nachweisstatus

Repository-seitig existieren Security-Header, Upload-Pruefung, private
Downloads, RBAC-Grundlagen, Tenant-Smokes und CI-Gates. Nicht als erledigt gelten
produktive ClamAV-/S3-Konfiguration, externe Alarmierung, Penetrationstest,
MFA und der echte Hetzner-Restore.
