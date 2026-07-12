# FLYERO Datei-Upload-Sicherheit

## Pipeline

1. Die Datei wird vor der Speicherung auf erlaubte Endung, Größe und Signatur bzw. Struktur geprüft.
2. Der ClamAV-Adapter prüft den Byteinhalt serverseitig, sofern `CLAMSCAN_PATH` gesetzt ist.
3. Ein sauberer Upload wird im privaten Dokument- bzw. Proof-Speicher abgelegt.
4. Uploads ohne erfolgreichen Scan werden im privaten Quarantänepfad abgelegt und bleiben nicht kundenfreigabefähig, wenn `FILE_SCAN_MODE=required` aktiv ist.
5. Admins können Dokumente und Fotos über die Scan-Endpunkte erneut prüfen.

## Betriebsmodi

- `required`: Produktionsmodus. Ein fehlender Scanner, ein Fehler oder ein Treffer blockiert den Upload bzw. die Freigabe.
- `optional`: Lokale/Beta-Entwicklung. Nicht gescannte Dateien erhalten den Status `NOT_CONFIGURED` und werden quarantänisiert.
- `disabled`: Nur für ausdrücklich isolierte Entwicklung. Es wird kein Malware-Scan behauptet.

## Konfiguration

```env
FILE_SCAN_MODE=required
CLAMSCAN_PATH=/usr/bin/clamscan
```

Der Scanner muss auf dem Produktionshost bzw. im Container installiert, regelmäßig mit Signaturen aktualisiert und überwacht werden. Ein produktiver ClamAV-Lauf ist ein Deployment-Nachweis und wird nicht durch den lokalen Smoke-Test ersetzt.

## Status und Freigabe

`FileScanStatus` wird an Dokumenten und Foto-Nachweisen gespeichert. Freigaben und Kunden-Sichtbarkeit werden serverseitig geprüft. Scanmeldungen enthalten keine Datei-Inhalte oder Secrets. Die privaten Storage-Keys werden nicht als öffentliche URLs ausgegeben.

## Noch offen

- Altbestände müssen bewertet und gegebenenfalls nachgescannt werden.
- ClamAV-Health, Signaturalter und Fehler müssen an das externe Monitoring angebunden werden.
- Für große Uploadvolumen ist ein separater asynchroner Scan-Worker mit Queue sinnvoll.
