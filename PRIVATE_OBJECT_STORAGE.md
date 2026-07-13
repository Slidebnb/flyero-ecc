# Privater Objekt-Storage

FLYERO unterstützt zwei Speicherprovider:

- `local`: Entwicklungsstandard. Dateien liegen unter `DOCUMENT_STORAGE_ROOT` und `GENERATED_ASSET_ROOT`.
- `s3`: privater S3-kompatibler Bucket für Dokumente, Fotos, Rechnungen, Reports und Exporte.

## Produktionsregeln

- `FILE_STORAGE_PROVIDER=s3` muss mit Bucket, Region, Access-Key und Secret-Key vollständig konfiguriert sein.
- Der Bucket darf keine öffentlichen Read-Rechte besitzen.
- Es werden keine S3-Zugangsdaten als `NEXT_PUBLIC_*`-Variable verwendet.
- Die Anwendung liefert Dateien ausschließlich über autorisierte Server-Routen aus.
- `S3_PREFIX` trennt FLYERO-Objekte innerhalb des Buckets logisch.
- Versionierung, Verschlüsselung at rest, Lifecycle und Offsite-Replikation müssen im Anbieter aktiviert und regelmäßig geprüft werden.

## Schutz vor Legacy-Webroot-Assets

Revisionsrelevante Generated-Assets duerfen nicht unter `public/generated`
liegen. Der lokale Produktionspfad ist `storage/generated`; im S3-Betrieb wird
der Namespace `generated` verwendet. `readGeneratedAsset()` akzeptiert ausschliesslich Pfade mit
`/private/generated/`; alte Datenbankpfade muessen vor einem Produktions-Rollout
ueber eine kontrollierte Storage-Migration uebertragen werden.

## Migration vom lokalen Speicher

1. Privaten Bucket und einen minimal berechtigten Service-User anlegen.
2. `FILE_STORAGE_PROVIDER=s3` und die S3-Variablen im Produktions-Secret setzen.
3. Lokale Dokumente und generierte Dateien mit einer separaten, checksum-geprüften Migration übertragen.
4. Stichproben-Downloads für Kundenberichte, Rechnungen, Nachweise und Exporte prüfen.
5. Erst danach lokale Volumes als Rückfallpfad archivieren und entfernen.

Die aktuelle Codeänderung aktiviert S3 nicht automatisch und löscht keine lokalen Daten. Für den echten Betrieb fehlen weiterhin Bucket-Einrichtung, initiale Migration, Restore-Test und Anbieter-/DSGVO-Dokumentation.
Der Produktionscontainer enthaelt ClamAV. Bei
`FILE_SCAN_MODE=required` muss der Preflight im Container erfolgreich laufen,
bevor Uploads fuer den Kundenbetrieb freigegeben werden.
