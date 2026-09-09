# FLYERO Kundenreise – Audit und Umsetzungsstand

## Ziel

Jeder Kunde soll jederzeit wissen: Was ist passiert, was passiert als Nächstes, und welche konkrete Aktion ist jetzt nötig. Zahlungslinks dürfen nur auf den für diesen Auftrag erzeugten Stripe Checkout zeigen. Interne Statusnamen und technische IDs gehören nicht in die Kundenkommunikation.

## Audit-Matrix

| Bereich | Bewertung | Befund |
| --- | --- | --- |
| Anfrage direkt nach dem Absenden | vorhanden, aber unvollständig | Portal-Link und E-Mail waren vorhanden; bei direkter Zahlung wurde nicht zuverlässig sofort ein Stripe Checkout-Link mitgegeben. |
| Annahme durch FLYERO | vorhanden | `ORDER_ACCEPTED_PAYMENT_REQUIRED` führt den Kunden ins Portal und enthält den Zahlungsaufruf. |
| Zahlung fehlgeschlagen | fehlerhaft | Der Kunde erhielt bislang keinen neuen Zahlungslink. |
| Zahlung erfolgreich | vorhanden und korrekt | `buildPaymentConfirmationEmail` versendet eine Bestätigung mit Betrag, Zeitraum, Gebiet und Lageranweisung. |
| Lageranweisung | vorhanden, aber zeitlich uneinheitlich | Für eigene Flyer wird sie bei der Lagerzuweisung erstellt; die Zahlungsbestätigung enthält sie, sobald das Lager feststeht. |
| Zustellung/Retry | vorhanden | Queue, sofortiger Versand kritischer Nachrichten, Retry und AuditLog sind vorhanden. |
| Organisations-Zahlung | teilweise vorhanden | Der Checkout wird serverseitig über den konfigurierten Stripe-Provider erzeugt; pro Auftrag wird ausschließlich die zurückgegebene Checkout-URL verwendet. Eine getrennte Stripe-Konfiguration pro Tenant existiert derzeit nicht. |

## Umgesetzte Korrekturen

1. Direkte Online-Aufträge erzeugen vor der Kunden-E-Mail einen Checkout über den zentralen serverseitigen Payment-Service. Die E-Mail enthält die echte, für diesen Auftrag erzeugte Stripe-URL; fällt die Erzeugung aus, bleibt der Portal-Link als klarer Fallback bestehen und der Vorgang wird auditiert.
2. Nach einem fehlgeschlagenen Zahlungsversuch wird einmalig ein neuer Checkout-Link erzeugt. Die Kunden-E-Mail enthält diesen Link, eine verständliche Handlungsanweisung und den Portal-Link als Fallback.
3. Kritische Kundenmails werden direkt an die E-Mail-Queue übergeben. Präferenzen werden nicht still übergangen; `forceEmail` wird nur für transaktionale Ereignisse verwendet: Auftrag eingegangen, Zahlungsfehler und Zahlungserfolg.
4. Die vorhandene Zahlungserfolgs-Mail bleibt die zentrale Bestätigung. Sie nennt Betrag, Zeitraum, ausgewählte Gebiete, Versand-/Empfangslager und die Auftragsnummer als Paket-Referenz. Bei Druckservice wird ausdrücklich keine Eigenanlieferung verlangt.
5. Alle Schritte bleiben idempotent: Checkout-Erzeugung verwendet die vorhandenen Claims, Zahlungsabschluss ist über Stripe-Event und Payment-Status geschützt, Benachrichtigungen werden über den Queue-/Audit-Pfad nachvollziehbar.

## Bewusste Grenze

FLYERO besitzt aktuell einen global konfigurierten Stripe-Provider (`PaymentProvider` mit Code `stripe`). Eine eigene Stripe-Organisation pro Tenant ist im Datenmodell nicht hinterlegt. Der aktuelle Code kann deshalb den korrekten globalen FLYERO-Stripe-Checkout sicher verwenden, aber keine nicht vorhandene Tenant-Stripe-Verbindung vortäuschen. Für echte getrennte Organisationen wären danach ein verschlüsseltes Tenant-Payment-Konto, serverseitige Account-Auswahl, Webhook-Zuordnung und eine Migration nötig.

## Nachweis

Die Regression wird über den Order-Notification-Smoke und den Payment-Link-/Admin-Area-Smoke abgesichert. Zusätzlich sind Prisma-Validierung, TypeScript, Lint, Produktions-Build und die bestehenden Beta-/Portal-Smokes auszuführen. Ein grüner lokaler Build ersetzt keine Produktions- oder Stripe-Live-Bestätigung.
