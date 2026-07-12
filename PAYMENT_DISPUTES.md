# FLYERO Stripe-Dispute-Prozess

## Zweck

Stripe-Disputes und Chargebacks werden serverseitig aus signierten Webhooks übernommen. Ein Dispute wird als eigene, tenantbezogene Akte gespeichert und nicht stillschweigend mit einer erfolgreichen Zahlung gleichgesetzt.

## Ablauf

1. Stripe sendet `charge.dispute.created`, `charge.dispute.updated` oder `charge.dispute.closed`.
2. Die Signatur wird in `/api/stripe/webhook` geprüft; die Event-ID bleibt idempotent in `PaymentEvent`.
3. FLYERO ordnet den Dispute über die Payment-Intent-ID einer Zahlung zu, sofern diese vorhanden ist.
4. Status, Betrag, Währung, Grund, Antwortfrist und letzte Eventzeit werden in `PaymentDispute` gespeichert.
5. Offene Fälle erzeugen eine Admin-Benachrichtigung und einen AuditLog-Eintrag.
6. Eine Erstattung für eine Zahlung mit offenem Dispute wird serverseitig blockiert.
7. Admins können den Fall über `PAYMENT_DISPUTE_MANAGE` und die Admin-API dokumentiert auf `WON`, `LOST`, `CLOSED` oder zurück auf `OPEN` setzen.

## Berechtigungen und Datenschutz

Dispute-Daten sind ausschließlich für Admins vorgesehen. Kunden erhalten keine Stripe-Rohdaten. Unzuordenbare Disputes bleiben gespeichert und werden als „Nicht zugeordnet“ in der Admin-Übersicht geführt, damit kein Webhook verloren geht.

## Noch operativ erforderlich

- Antwortverantwortlicher und SLA außerhalb der Anwendung festlegen.
- Belege und Antwort über das Stripe-Dashboard einreichen.
- Signierte Testevents für `created`, `updated`, `closed` und Wiederholungen in einer getrennten Staging-Umgebung nachweisen.
- Alarmierung für offene Fälle und ablaufende `dueBy`-Fristen an ein externes Monitoring anbinden.
