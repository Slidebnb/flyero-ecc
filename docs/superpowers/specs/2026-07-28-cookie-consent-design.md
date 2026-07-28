# FLYERO Cookie Consent Design

## Ziel

FLYERO erhält eine ruhige, nachvollziehbare Cookie-Einwilligung. Besucher werden nur einmal gefragt, ihre Auswahl bleibt gespeichert und kann jederzeit über den Footer geändert werden.

## Kategorien

- **Notwendig:** Session, Sicherheit und ausdrücklich angeforderte Funktionen. Immer aktiv; kein Banner-Opt-in erforderlich.
- **Statistik:** optionale, anonymisierte bzw. aggregierte Nutzungsanalyse. Standardmäßig deaktiviert.
- **Marketing:** in dieser Version nicht aktiv und wird nicht als auswählbarer Anbieter vorgetäuscht.

## Speicherung

Die Einwilligung wird als first-party Cookie `flyero_cookie_consent_v1` gespeichert. Der Wert enthält ausschließlich eine kleine versionierte Auswahl für `statistics`, `marketing` und `updatedAt`; keine Nutzer-ID, kein IP-Wert und keine Kampagnendaten. Das Cookie erhält `Path=/`, `SameSite=Lax`, `Secure` in Produktion und eine begrenzte Laufzeit. Ein bestehender notwendiger Login-/Session-Cookie wird nicht durch das Consent-System ersetzt.

## Verhalten

- Kein nicht notwendiges Tracking vor einer Entscheidung.
- Banner mit gleichwertigen Aktionen: **Nur notwendige**, **Auswahl speichern**, **Alle akzeptieren**.
- Detailansicht mit Schaltern; Statistik ist standardmäßig aus.
- Nach Speicherung verschwindet der Banner.
- Footer-Link **Cookie-Einstellungen** öffnet den Dialog erneut.
- Ungültige oder alte Werte werden ignoriert und führen zu einer neuen Auswahl.
- Die Auswahl wird beim erneuten Besuch wiederhergestellt.

## Analytics-Anbindung

Die vorhandenen öffentlichen Funnel-Events bleiben fachliche Serverereignisse. Es werden keine Drittanbieter-Tracking-Skripte nachgeladen. Eine spätere optionale Statistik-Integration darf nur über den zentralen Consent-Status aktiviert werden.

## UI

Der Banner sitzt als kompakte, responsive Fläche am unteren Rand, ohne die primären CTAs zu verdecken. Die Sprache ist deutsch und verständlich. Die Datenschutzseite wird verlinkt; der Banner ersetzt keine Datenschutzerklärung.

## Grenzen

Diese Änderung ist keine vollständige Rechtsberatung. Vor Einbindung neuer externer Analyse-, Werbe- oder Kartenanbieter müssen Zweck, Anbieter, Rechtsgrundlage, Drittlandtransfer und Datenschutzhinweise separat geprüft werden.
