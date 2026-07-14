# Modul 27: Aktivierung bis Zahlung

Stand: 14.07.2026

## Ziel

Der oeffentliche Planner bleibt ohne Konto nutzbar. Ein Kunde kann ein Gebiet
planen und danach entweder eine Anfrage senden oder sicher in die Registrierung,
E-Mail-Bestaetigung und Anmeldung fuer die direkte Buchung wechseln.

## Aktivierungskette

1. Gast plant Gebiet und speichert den Entwurf lokal.
2. Bei direkter Buchung wird nur `AUTH_GATE_VIEWED` erfasst.
3. Registrierung verlangt im ersten Schritt nur Firma, Ansprechpartner,
   E-Mail, Passwort und optional Telefon.
4. Der Verifizierungslink bewahrt einen sicheren internen `next`-Pfad.
5. Nach der Anmeldung wird der gespeicherte Entwurf wieder aufgenommen.
6. Der Checkout erstellt oder verwendet eine eigene Order.
7. Erst der echte serverseitige Checkout-Aufruf schreibt
   `CHECKOUT_STARTED` und `PAYMENT_REDIRECTED`.

## Profilergänzung

Fehlen Firma, Ansprechpartner, Telefon oder Rechnungsadresse, liefert der
Checkout einen strukturierten HTTP-422-Fehler mit Code
`CUSTOMER_PROFILE_INCOMPLETE`. Die eigene Order wird an
`/customer/profile/complete?orderId=...` weitergeleitet. Nach dem Speichern
werden die vorhandene Order und eine offene Zahlung wiederverwendet; es wird
keine zweite Order absichtlich erzeugt.

## Sicherheit und Datenqualität

- Weiterleitungen akzeptieren nur interne Pfade zu erlaubten Bereichen.
- Oeffentliche Planner koennen keinen authentifizierten Checkout-Event
  behaupten.
- Funnel-Ereignisse enthalten keine E-Mail, Namen, Adressen oder freien
  Kundentext.
- Entwuerfe werden erst nach erfolgreicher Auftragserstellung geloescht.
- Stripe-/Provider-Fehler bleiben echte Zahlungsfehler und werden nicht als
  Profilproblem maskiert.

## Geaenderte Systeme

- additive Prisma-Migration fuer `EmailVerificationToken.redirectPath`
- zentrale Redirect-Validierung in `src/lib/redirects.ts`
- zentrale Profilvollstaendigkeitspruefung in
  `src/lib/customerProfileCompleteness.ts`
- fokussierte Profilergänzung unter
  `src/app/customer/profile/complete`
- Checkout-Fortsetzung im bestehenden Payment-System
- serverseitige Aktivierungs- und Zahlungsereignisse

## Tests

```text
npm run test:registration-progressive
npm run test:verification-continuation
npm run test:activation-handoff
npm run test:profile-completion-checkout
npm run test:planner-funnel-events
npm run test:module27
```

## Offen vor Livebetrieb

Produktiver Stripe-Checkout inklusive Webhook-Replay, echte E-Mail-Zustellung
und Bounce-Monitoring, mobile Browserpruefung, Backup-Restore, rechtliche
Freigaben und ein kontrollierter Test mit realen Zahlungsmitteln bleiben
notwendig. Diese Punkte werden durch die Modul-27-Implementierung nicht
automatisch als erledigt betrachtet.
