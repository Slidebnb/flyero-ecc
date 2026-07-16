# FLYERO Visual QA Checklist

Diese Checkliste gilt fuer jede sichtbare Aenderung an Public-, Auth- oder Kundenansichten.

## Pflichtseiten

Oeffentlich:

- `/`
- `/verteilung-planen`
- `/verteilung-planen?query=56112`
- `/verteilung-anfragen`
- `/preise`
- `/kontakt`
- `/so-funktionierts`
- `/fuer-unternehmen`
- `/fuer-unternehmen#zielgruppen`

Kundenportal:

- `/customer/dashboard`
- `/customer/orders`
- `/customer/orders/new`
- `/customer/reports`
- `/customer/documents`
- `/customer/invoices`
- `/customer/support`

## Viewports und Belege

Fuer betroffene Seiten muessen echte Screenshots gespeichert werden:

- Desktop: `1440 x 1000` oder der im Test definierte Desktop-Viewport.
- Mobile: `390 x 844` oder der im Test definierte Mobile-Viewport.

Screenshots muessen im QA-Artefaktverzeichnis liegen und im Abschlussbericht mit absolutem Pfad genannt werden. Ein Timeout, ein leeres Bild oder ein nicht erzeugter Screenshot ist kein bestandener Check.

## Sichtbare Pruefungen

- Header, Logo, Navigation und CTA sind sichtbar und nicht verschoben.
- Keine Ueberlappung von Text, Buttons, Badges, Menues oder Karten.
- Text passt in den Container und bleibt auf Mobile lesbar.
- Keine Default-HTML-Links, fehlenden CSS-Regeln oder ungeplanten Scrollbars.
- Keine sichtbaren Demo-, Mock-, Seed- oder Entwicklertexte.
- Keine Fake-Nachweise. Empty States sagen klar, dass echte Nachweise erst nach Durchfuehrung und Freigabe erscheinen.
- Public Planner und Kundenwizard zeigen bei gleicher Eingabe dieselbe Gebietidentitaet und keine alten Auswahlwerte.
- PLZ-/Ort-Suche zeigt die ausgewaehlte Stadt und verwirft sie bei Textaenderung.
- Preiszustand unterscheidet `Gebiet auswaehlen`, `Preis wird aktualisiert`, echte Preisvorschau und manuelle Pruefung.
- Buttons fuehren zu einer realen Aktion und zeigen Lade-, Fehler- und Erfolgsszustand.

## Browser- und Konsolenpruefung

- Jede Seite im echten Browser laden, nicht nur Server-HTML lesen.
- Desktop und Mobile jeweils mindestens den ersten sichtbaren Bereich pruefen.
- Relevante Interaktionen ausfuehren: Menue, Suche, Vorschlag, CTA, Wizard-Schritt und Fehlerzustand.
- Console-Errors und Framework-Overlays dokumentieren.
- Bei fehlender externer API darf nur ein kundenfreundlicher, ehrlicher Zustand erscheinen.
- Das Impressum muss die aktuellen Unternehmensdaten anzeigen und darf keine Musterfirma, Beta-Hinweise oder alten Kontaktdaten enthalten.

## Abnahme

Eine visuelle QA gilt nur als bestanden, wenn:

1. alle angeforderten Screenshots tatsaechlich erzeugt wurden,
2. keine relevanten Console-Errors vorhanden sind,
3. die Pflichtinteraktionen funktionieren,
4. die automatischen Assertions ohne Timeout durchlaufen,
5. offene technische oder externe Blocker im Bericht stehen.
