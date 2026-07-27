# FLYERO Registrierung und Verteilerzugang

## Kundenkonto

Die Kundenregistrierung legt Benutzer, Mandant, Kundenprofil, Mitgliedschaft und E-Mail-Bestätigung in einer Transaktion an. Die Zustimmung zu AGB und Datenschutz wird mit Zeitpunkt und `LEGAL_TERMS_VERSION` am Benutzer gespeichert. Ein Login ist erst nach bestätigter E-Mail möglich.

## Verteilerkonto

Die Verteilerregistrierung legt Benutzerprofil und Bestätigungstoken atomar an. Das Geburtsdatum wird serverseitig auf Volljährigkeit und einen plausiblen Altersbereich geprüft. Eine E-Mail-Bestätigung aktiviert nur den Benutzerzugang; die operative Nutzung bleibt bis zur Admin-Freigabe gesperrt.

## Schutz sensibler Daten

Steuernummer und Bankdaten werden bei neuen Schreibvorgängen mit AES-256-GCM verschlüsselt. Dafür wird bevorzugt `SENSITIVE_DATA_ENCRYPTION_KEY` verwendet; solange diese Variable fehlt, dient `AUTH_SECRET` als kompatibler Schlüssel. Für einen separaten Produktionsschlüssel sollte `SENSITIVE_DATA_ENCRYPTION_KEY` gesetzt werden. Alte Klartextwerte bleiben lesbar, damit bestehende Profile nicht unbrauchbar werden, werden aber bei der nächsten Änderung verschlüsselt gespeichert.

## Freigabeprüfung

Alle operativen Verteiler-Endpunkte prüfen serverseitig Benutzerstatus und Profilfreigabe. Nur aktive und durch FLYERO freigegebene Verteiler können Aufträge, Touren oder Nachweise operativ bearbeiten. Pausierte oder gesperrte Profile werden auch durch alte Bestätigungslinks nicht reaktiviert.

## Migration

`20260727100000_auth_registration_hardening` ergänzt die unveränderlichen Felder für Rechtszustimmung. Die Migration ist rückwärtskompatibel und löscht keine bestehenden Daten.
