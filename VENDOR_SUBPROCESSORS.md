# FLYERO Lieferanten- und Subprocessor-Matrix

Diese Matrix beschreibt die derzeit geplanten oder technisch vorbereiteten
Dienstleister. Sie ist keine bestaetigte AVV- oder Datenschutzfreigabe. Vor
Produktivbetrieb muessen Vertrag, Region, Rollen, Unterauftragnehmer,
Loeschung, Transfermechanismus und Ansprechpartner geprueft werden.

| Anbieter/Kategorie | Zweck | Datenmoeglich | Konfiguration | Pruefstatus |
| --- | --- | --- | --- | --- |
| Hetzner Server | App, PostgreSQL, private Container | alle produktiven FLYERO-Daten | Produktion auf Hetzner | Vertrag, Verschluesselung, Backup und Restore nachweisen |
| Hetzner Storage Box/S3-kompatibler Storage | Offsite-Backups/private Dateien | Datenbankexporte, Dokumente, Reports | Restic/S3-Adapter vorbereitet | Ziel, Versionierung, Lifecycle und AVV offen |
| Stripe | Checkout, Zahlung, Refund, Dispute | Zahlungs- und Kundenreferenzen | serverseitige Stripe-Secrets | Staging-E2E, Vertrag und Datenfluss pruefen |
| Google Maps Platform | Geocoding, Places, Karten/Routen | Suchanfragen, Gebiets-/Koordinatendaten | Browser-/Server-Key getrennt | Key-Restriktionen, Region, Vertrag und Datenschutz pruefen |
| Resend oder SMTP-Provider | Verifizierung, Status- und System-E-Mails | E-Mail-Adresse, Nachricht, Versandmetadaten | `EMAIL_PROVIDER`/SMTP/Resend | echter Provider, AVV und Bounce-Prozess offen |
| ClamAV | Malware-Scan von Uploads | Dateistream, Dateiname/Metadaten | `FILE_SCAN_MODE=required` in Produktion | produktiver Betrieb und Alarmierung offen |

## Freigabe-Checkliste

- DPA/AVV und aktuelle Subprocessor-Liste archiviert.
- Speicher- und Verarbeitungsregion dokumentiert.
- Zweck, Datenklassen und Loeschfristen bestaetigt.
- Secrets nicht im Repository und Rotation getestet.
- Ausfall- und Exit-Strategie dokumentiert.
- Sicherheitsvorfall- und Kontaktweg getestet.
- Anbieterwechsel/Exportformat fuer Kundendaten geklaert.

## Aktueller Status

Die Matrix schliesst die Dokumentationsluecke, aktiviert aber keine externen
Vertraege oder Provider. Hetzner-Backup, S3, ClamAV, echter E-Mail-Provider,
Stripe-Staging und externe Monitoringdienste muessen auf der Zielumgebung noch
konfiguriert und nachgewiesen werden.
