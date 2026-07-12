# Health-Monitoring-Betriebsregeln

## Oeffentlicher Health-Endpunkt

`GET /api/health` gibt bewusst nur den aktuellen Gesamtstatus zurueck. Der Endpunkt wird nicht gecacht. Wenn noch kein Health Check gespeichert wurde, ist der Status `DEGRADED`; ein fehlender Nachweis darf nicht als `OK` erscheinen.

Die Detailwerte bleiben im geschuetzten Admin-Monitoring unter `/admin/monitoring`.

## E-Mail-Provider

In lokalen Entwicklungs- und Testumgebungen darf `EMAIL_PROVIDER=mock` verwendet werden. In Produktion wird dieser Modus absichtlich als `DEGRADED` bewertet, weil keine echte E-Mail zugestellt wird.

Produktive Konfiguration:

- `smtp`: `SMTP_HOST` und `SMTP_FROM` oder `EMAIL_FROM`
- `resend`: `RESEND_API_KEY` und `EMAIL_FROM` oder `SMTP_FROM`

Fehlt eine benötigte Einstellung, bleibt der E-Mail-Teilstatus `DEGRADED`. Geheimnisse werden dabei nicht in Health-Antworten oder Metadaten geschrieben.

## Nachweis und verbleibende Luecke

Der Contract-Smoke `npm run test:health-fail-safe` prüft den konservativen Fallback, den Cache-Schutz und die Provider-Bewertung. Das ist kein Ersatz für externes Uptime-, Error- und Alarm-Monitoring. Vor einem offenen Launch bleiben mindestens ein externer Uptime-Check, ein Alarmweg und eine durchgängige Request-ID-Korrelation erforderlich.
