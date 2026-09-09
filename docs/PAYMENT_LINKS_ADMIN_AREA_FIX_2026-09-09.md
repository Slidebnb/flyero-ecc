# Zahlungslinks und Admin-Gebietsansicht – 09.09.2026

## Ausgangspunkt und Bestandsmatrix

- Start-Commit: `ba4c5a0a587bf251512cfdccecad6e712b9d3a29`.
- Arbeitsbranch: `fix/payment-links-admin-area`.
- Vorhanden: tenantgebundener Kunden-Checkout, serverseitige Preis-/Integritätsprüfung, Checkout-Idempotenz, gespeicherte Auftragsgeometrie und Teilgebiete, Maps-Vorschaukomponente.
- Unvollständig: Erstellungs- und Annahmebenachrichtigungen übergaben keine verwendbare Auftrags-Zieladresse an das E-Mail-Template.
- Fehlerhaft: Caddy erlaubte `form-action 'self'`, obwohl das HTML-Zahlungsformular über eine 303-Antwort zu Stripe wechselt. Maps-Vorschau verbrauchte drei unmittelbare Wiederholungen, während der asynchrone API-Namensraum noch keine Konstruktoren enthielt.
- Fehlend: Karte auf der Admin-Auftragsdetailseite; zuvor nur Gebietsname und Tabelle.
- Nicht Teil der Aufgabe: Pricing-/Checkout-Neuentwicklung, Änderung von Kundenaufträgen, Zahlungsausführung, neue operative Funktionen.

## Ursachen und Belege

`https://flyero.org/api/health` antwortete mit HTTP 200 und der oben beschriebenen CSP. Im angemeldeten Chrome-Adminportal war ORD-2026-001016 am 09.09.2026 im Status PAYMENT_PENDING sichtbar, mit einer bereits erzeugten Zahlung im Status CHECKOUT_CREATED. Die Detailseite enthielt keine Gebietskarte. Der Kundenbereich war in dieser Live-Sitzung wegen der Adminrolle nicht zugänglich; keine Kundensitzung wurde übernommen.

Eine lokale, datenfreie Browser-Reproduktion mit derselben CSP verwendet ein POST-Formular und eine 303-Weiterleitung nach `https://checkout.stripe.com/c/pay/cs_test_flyero_redirect_probe`. Mit der alten CSP blieb das Formular stehen und das DOM protokollierte `BLOCKED: form-action`. Mit der aktualisierten CSP wurde die Stripe-Adresse erreicht. Stripe zeigte für den absichtlich nicht existierenden Prüf-Link „This link is incomplete“. Dies belegt die erlaubte Navigation, keine erfolgreiche Live-Zahlung.

Die Maps-Diagnose im lokalen Browser zeigte zweimal `Area preview constructors undefined undefined undefined`. Der Ablauf war zeitabhängig: teils Karte, teils dauerhafter Fehlerzustand. Temporäre Diagnoselogs wurden wieder entfernt. Die Vorschau wartet jetzt bis zu zehn Sekunden mit Intervallen auf die Konstruktoren, auch ein hängender Bibliotheksimport läuft in diese Zeitgrenze.

## Änderung und Sicherheitsentscheidungen

- `Caddyfile`: ausschließlich `https://checkout.stripe.com` zusätzlich zu `self` für Formularnavigation. Keine Wildcard und keine Abschaltung der CSP.
- `src/app/api/customer/orders/route.ts`: absolute Auftragsadresse; bei Direktzahlung zusätzlich Zahlungsaktion.
- `src/lib/orderReviewWorkflow.ts`: absolute, langlebige Portaladresse für die bestehenden Review-Benachrichtigungen einschließlich Annahme.
- `src/lib/customerEmailTemplate.ts`: relative interne URLs werden absolut, Zahlungsaktion erhält Vorrang, Protokoll-relative URLs und Backslashes werden verworfen.
- `src/app/admin/orders/[id]/page.tsx`: vorhandene Karte zeigt `targetAreaGeoJson` vor der Entscheidung; zusätzliche Teilgebiete lassen sich einzeln aufklappen. Keine nachträglich veränderbare Gebietsvorlage als Ersatz für den Auftragssnapshot.
- `src/app/components/DistributionAreaPreviewMap.tsx`: stabile Geometrieabhängigkeiten und zeitlich begrenzte Bereitschaftsprüfung.
- Neu: `src/lib/mapsReadiness.ts`, `tests/maps-readiness-runtime.mjs`, `tests/payment-links-admin-area-smoke.mjs`, dieser Bericht.
- `package.json` und `.github/workflows/ci.yml`: neue Prüfungen in den regulären CI-Ablauf eingebunden.

Keine Migrationen, keine neuen Abhängigkeiten, keine veränderten Preisformeln, keine Eingriffe in produktive Aufträge oder Zahlungen. Kundenlinks führen weiterhin durch Login, aktive Tenant-Mitgliedschaft und Eigentumsprüfung. Die bestehende Adminrolle bleibt erforderlich.

## Suchläufe

Gezielte `rg`-Suche nach Zahlungsbutton-Texten, `paymentUrl`, `campaignUrl`, `ORDER_ACCEPTED`, `ACCEPTED_AWAITING_PAYMENT`, `form-action`, `__flyeroMapsLoading`, Maps-Komponenten, Auftragsseiten/APIs und nächstliegenden Tests. Eingeordnet als Darstellung (Portal/Karte), Schreibstelle (Benachrichtigungsdaten), Transformation (E-Mail-Renderer), Validierung (Checkout/Tenant), Nebenwirkung (Stripe-Redirect), Infrastruktur (Caddy) und Test.

## Ausgeführte Prüfungen

Alle folgenden Befehle bestanden lokal:

```text
npm run test:payment-links-admin-area  (7 Prüfungen)
npm run test:customer-email-design
npm run test:order-review-notifications
npm run test:security-headers
npm run test:admin-order-workspace
npm run test:module27
npm run test:order-review-payment-runtime
npm run test:customer-order-checkout-idempotency
npm run test:customer-portal-action-ux
npm run test:customer-order-multi-segment-checkout-ux
npm run test:customer-order-boundary-checkout
npm run test:maps-loader-async
npm run test:public-url
npm run test:ci-config
npx prisma validate
npm run prisma:generate
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Die ersten fünf neuen Prüfungen schlugen vor der Reparatur fehl (0/5). Die zwei zusätzlichen Maps-Prüfungen decken verspätete Bereitschaft und fehlende/hängende Bibliotheken ab. Der bestehende PostgreSQL-Laufzeittest prüfte Anfrage, Annahme und Zahlungsverarbeitung ausschließlich in der lokalen Testumgebung. Keine Live-Zahlung wurde ausgelöst.

Browserbelege mit lokalen Testaufträgen, keine Produktivdaten:

- `C:/Users/Administrator/ecc/.tmp/payment-area-qa/admin-desktop.png`: 1440 × 1000, gespeichertes Polygon sichtbar.
- `C:/Users/Administrator/ecc/.tmp/payment-area-qa/admin-mobile.png`: 390 × 844, Gebietsabschnitt und Karte sichtbar.
- Kartenlade- und Fehlerzustand gesehen; verzögerte Bibliotheken per Laufzeittest abgedeckt. Keine Kartenfehler in den abschließenden Browser-Error-Logs.
- Ein Scrollbefehl lief in einen Browsersteuerungs-Timeout; die anschließende tatsächliche Ansicht wurde separat erfasst und geprüft.

## Release und verbleibende Grenzen

Eine Veröffentlichung muss App **und Caddy** aktualisieren. Das bestehende Deploy-Skript erstellt beide Container neu. Ein reiner App-Neustart übernimmt die geänderte CSP nicht zuverlässig.

Bereits verschickte E-Mails werden nicht verändert oder automatisch erneut versendet. Der Kunde kann nach Veröffentlichung über seine Kampagne im Portal erneut zur Zahlung wechseln. Neue E-Mails erhalten den funktionalen Button. Externe Zustellung und eine echte Stripe-Zahlung nach dem Release sind separat zu bestätigen.

Die vorhandene Wiederverwendung abgelaufener Stripe-Sitzungen, allgemeine Checkout-Fehlerdarstellung und die Darstellung ausgesparter Innenringe in der bestehenden Polygonvorschau wurden in diesem begrenzten Fix nicht neu gestaltet. Sie sind keine durch diesen Lauf verifizierten Garantien.

Lokale Prüfungen und Browserbelege sind kein Nachweis eines erfolgten Produktionsdeployments. GitHub-CI- und Release-Status werden im Abschluss separat genannt.
