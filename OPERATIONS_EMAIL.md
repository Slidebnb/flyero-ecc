# Betriebs-E-Mails an FLYERO

## Zweck

FLYERO erstellt fuer jeden wichtigen Geschaeftsvorgang eine interne
Betriebs-E-Mail an `OPERATIONS_EMAIL`. Die Nachricht wird nicht direkt aus dem
Browser verschickt, sondern ueber die bestehende Notification-Queue und den
Notification-Worker verarbeitet.

## Abgedeckte Vorgange

Die zentrale Funktion `notifyAdmins` erzeugt neben den internen
Admin-Benachrichtigungen eine Kopie fuer die Betriebsadresse. Damit werden die
bereits vorhandenen Ereignisse zentral abgedeckt, unter anderem:

- neue Anfrage oder Lead
- neue Bestellung/Kampagne
- gestarteter Zahlungsvorgang
- erfolgreiche Zahlung
- fehlgeschlagene Zahlung
- Erstattung und Zahlungsstreitfall
- hochgeladene Druck- oder Nachweisdateien
- Berichte, Touren, Lager, Dispatch und operative Statusaenderungen
- kritische Betriebs- und Webhook-Fehler

Jede Betriebsnachricht enthaelt den Ereignistext und die verfuegbaren
Vorgangsdaten, zum Beispiel Auftragsnummer, Lead-Kontakt, Zahlungs-ID,
Betrag, Status, Dokument-ID oder Bericht-ID. Secrets, Passwoerter und Tokens
werden nicht in die Nachricht aufgenommen.

## Produktionskonfiguration

In `/opt/flyero/.env.production` muss stehen:

```env
EMAIL_PROVIDER="resend"
EMAIL_FROM="FLYERO <hallo@flyero.org>"
OPERATIONS_EMAIL="hallo@flyero.org"
RESEND_API_KEY="..."
```

Alternativ kann `EMAIL_PROVIDER="smtp"` mit den SMTP-Variablen verwendet
werden. Der Produktions-Preflight lehnt eine fehlende oder ungueltige
`OPERATIONS_EMAIL` ab.

## Versandweg und Kontrolle

1. Ein Geschaeftsvorgang ruft `notifyAdmins` auf.
2. Message und E-Mail-Queue werden in der Datenbank gespeichert.
3. Der Notification-Worker verarbeitet `PENDING` und `RETRY`.
4. Erfolgreiche Nachrichten erhalten den Status `SENT` und eine Provider-ID.
5. Fehler werden mit Retry-Zaehler und internem Fehlerstatus protokolliert.

Die Queue kann im Adminbereich unter `/admin/notifications/queue` kontrolliert
und erneut angestoßen werden. Der systemd-Timer
`flyero-notification-worker.timer` muss auf dem Produktionsserver aktiv sein.

## Verifikation

Lokal:

```bash
npm run test:operations-email-routing
npm run test:operations-email-runtime
```

Auf Hetzner nach dem Deployment:

```bash
docker compose --env-file /opt/flyero/.env.production -f docker-compose.production.yml exec app node scripts/production-preflight.mjs
sudo systemctl status flyero-notification-worker.timer --no-pager
sudo journalctl -u flyero-notification-worker.service -n 80 --no-pager
```

Der Runtime-Test verwendet bewusst den Mock-Provider nur lokal. In Produktion
muss Resend oder SMTP aktiv konfiguriert sein.
