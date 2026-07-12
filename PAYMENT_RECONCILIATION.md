# Stripe-Reconciliation

Der Reconciliation-Lauf vergleicht Stripe-Zahlungen mit den internen `Payment`- und Order-Daten. Er ist read-only: Bei Abweichungen werden keine Zahlungen oder Aufträge automatisch geändert.

## Ausführung

```text
npm run payments:reconcile
```

Der Prozess ruft den geschützten Admin-Endpunkt `/api/admin/payments/reconcile` mit `INTERNAL_API_TOKEN` auf. Alternativ kann ein Admin die Route mit einer gültigen Session und der Berechtigung `payment.reconcile` auslösen.

## Ergebnis

Jeder Lauf speichert:

- geprüfte Zahlungen
- Übereinstimmungen
- Betrags-/Statusabweichungen
- fehlende Stripe-Ressourcen
- technische Fehler

Abweichungen landen in `PaymentReconciliationIssue` und werden zusätzlich über `AuditLog` protokolliert. Die betroffene Zahlung bleibt unverändert und muss kontrolliert geprüft werden.

## Betrieb

Der Job benötigt `STRIPE_SECRET_KEY`, `APP_URL` und `INTERNAL_API_TOKEN`. Er darf nur serverseitig und niemals aus dem Browser gestartet werden. Für Produktion ist ein Scheduler mit begrenztem Token, Fehleralarm und dokumentierter Aufbewahrung einzurichten.
