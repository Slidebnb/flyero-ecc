# FLYERO No Regression Rules

Diese Regeln sind vor jeder Code-, Daten- oder UI-Aenderung zu pruefen.

Diese Fehler sind bereits passiert und duerfen nie wiederkommen.

1. **Fake-Nachweis im Dashboard**
   Kuenstliche Proof-Grafiken, Fake-Pins und Beispieltexte sind im Kundenportal verboten.

2. **Seed-/Mock-Zahlungen sichtbar**
   `pi_seed`, `RPT-SEED` und Seed-Modul-Texte duerfen nie im Kundenportal sichtbar sein.

3. **Technische Support-Labels**
   `Wartet intern` und `Abgelehnt` duerfen im Kundenportal nicht stehen. `WAITING_INTERNAL` wird als `In Pruefung`, `REJECTED` als `Geschlossen` dargestellt.

4. **Preis haengt auf Berechnung**
   Ohne Gebiet: `Gebiet auswaehlen`. Bei laufender Berechnung: `Preis wird aktualisiert`. Bei manueller Pruefung: `Preis wird von FLYERO geprueft`. Bei fertigem Preis: Netto, MwSt. und Brutto.

5. **Normale PLZ-Suche loest Rate-Limit aus**
   Autocomplete, Geocode und Quote brauchen getrennte Limits.

6. **Visuelle Freigabe ohne Screenshot**
   Wenn Browser, Playwright oder CDP einen Timeout haben, ist die visuelle QA nicht bestanden.

7. **Startseite wirkt nicht hochwertig**
   CTA, Suchfeld und Nachweis-Visualisierung muessen sauber ausgerichtet sein.

8. **Planner und Kundenwizard widersprechen sich**
   PLZ-Eingabe, Vorschlaege, Gebiet und Preisstatus muessen logisch gleich funktionieren.

9. **Client-Werte werden als Wahrheit verwendet**
   Gebiet, Preis, Difficulty, Gewicht, Snapshot und Checkout muessen serverseitig final berechnet und geprueft werden.

10. **Stille Pricing-Fallbacks**
    Eine fehlende Service-PricingRule darf nie auf einen Flyerpreis zurueckfallen.

## Verbotene sichtbare Kundentexte

Die folgenden Begriffe duerfen nicht in oeffentlichen oder Kundenansichten erscheinen:

- Demo, Mock, Seed, Fixture, Testdaten
- Beispielhafter Ablauf
- keine echte Kampagne
- Fallback
- Quote, Fingerprint, RPT-SEED, pi_seed
- Wartet intern
- technische Rohstatus, HTTP-Codes oder Stacktraces
- Abgelehnt im Kundenbereich, wenn damit ein interner Status statt einer klaren Handlung gemeint ist

Interne Admin- und Entwicklerdiagnosen bleiben getrennt von Kunden- und Public-Rendering.

## Fachliche Invarianten

```text
Planner-Preis = Order-Preis = Stripe-Betrag = Rechnungsbetrag
```

```text
bestaetigtes Kundenpolygon = Order-Snapshot = Admin-Sicht = operative Planung
```

Weitere Regeln:

- Eine sichtbare Preisvorschau gehoert immer zur aktuellen Eingabe.
- Alte asynchrone Antworten duerfen neue Eingaben nicht ueberschreiben.
- Eine normale PLZ-Suche darf nicht mit einem unpassenden Rate-Limit-Zustand reagieren.
- Ein bezahlter Auftrag darf nicht geloescht oder still veraendert werden.
- Jeder Bericht und jedes Dokument wird nur nach Berechtigungspruefung ausgeliefert.
- Seed-Daten duerfen nie als echte oder hochvertrauenswuerdige Kundendaten erscheinen.
- Fehlende Maps-Konfiguration darf keinen technischen Secret-Hinweis im Kundenportal zeigen.
- Keine Fake-GPS-Spur, kein Fake-Foto und keine Fake-Heatmap als Nachweis darstellen.

## Arbeitsregeln fuer Fehler

1. Fehler reproduzieren und exakte Eingabe/Ausgabe dokumentieren.
2. Datenfluss von UI ueber API und Service bis Datenbank bzw. externem Anbieter verfolgen.
3. Einen Regressionstest schreiben und den erwarteten Fehlschlag beobachten.
4. Nur die Root Cause minimal beheben.
5. Den Regressionstest, verwandte Tests, Lint, TypeScript und Build ausfuehren.
6. Bei UI-Aenderungen Desktop- und Mobile-Screenshots erzeugen und sichtbar pruefen.
7. Timeouts, Warnungen und nicht gelaufene Checks offen dokumentieren.

## Aenderungsgrenzen

- Keine destruktiven Git-Befehle.
- Keine Migrationen loeschen oder zuruecksetzen.
- Keine PostgreSQL-Portaenderung.
- Keine parallelen V2-/New-/Mock-Workflows ohne Architekturentscheidung.
- Keine neue Businessfunktion als vermeintliche Reparatur eines bestehenden Prozesses.
- Nur bewusst zugehoerige Dateien committen und pushen.
