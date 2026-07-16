<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FLYERO Agent Rules

Diese Regeln gelten fuer jede Arbeit an FLYERO.

## Grundsatz

FLYERO ist kein Demo-Projekt. FLYERO soll professionell, vertrauenswuerdig, wirtschaftlich und exit-ready gebaut werden.

Keine sichtbaren Demo-, Mock-, Seed-, Debug- oder Technikbegriffe im Public UI oder Kundenportal.

## Pflicht vor jeder Aenderung

1. Diese Datei lesen.
2. Projekt-Memory lesen.
3. Bestehende Tests pruefen.
4. Root Cause finden.
5. Regressionstest schreiben.
6. Minimal fixen.
7. Tests ausfuehren.
8. Bei UI: echte Screenshots erzeugen.

## Verbotene sichtbare Begriffe im Public/Kundenbereich

- Demo
- Mock
- Seed
- Testdaten
- Fixture
- Debug
- Fallback
- Quote
- Fingerprint
- localhost
- RPT-SEED
- pi_seed
- Beispielhafter Ablauf
- keine echte Kampagne
- Wartet intern
- Abgelehnt

Ausnahme: Tests, interne Admin-Diagnose oder Entwicklerdokumentation.

## FLYERO Produktprinzipien

- Keine Fake-Nachweise.
- Keine Fake-GPS-Spuren als echte Ergebnisse.
- Nachweise erst anzeigen, wenn echte Verteilung abgeschlossen und geprueft ist.
- GPS-/Foto-/PDF-Visualisierung darf hochwertig sein, aber keine echte Kampagne vortaeuschen.
- Kundenportal muss menschlich, klar und nicht technisch sein.
- Preise immer serverseitig berechnen.
- Client-Werte sind nur Vorschau.
- Seed-Daten sind niemals vertrauenswuerdig.
- Sampling immer manuelle Pruefung, bis der operative Prozess final steht.
- Checkout nur mit aktuellem Preis-Fingerprint.
- Keine stillen Fallbacks auf falsche PricingRules.

## UI-Qualitaet

Jede sichtbare Aenderung braucht Pruefung auf Desktop und Mobile, verschiebungsfreie Buttons, ungekuerzte Texte, keine technischen Begriffe, klare CTA, verstaendliche leere Zustaende und keine dauerhaft haengende Preisberechnung.

## Abschlussregel

Eine Aufgabe ist erst fertig, wenn Tests und relevante Screenshots wirklich gelaufen sind. Ein nicht gelaufener Build, Test, Screenshot oder eine ungepruefte visuelle QA bleibt offen und wird im Bericht genannt.
