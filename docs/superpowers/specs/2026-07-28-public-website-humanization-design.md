# FLYERO Public Website Humanization Design

## Goal

Die öffentlichen FLYERO-Seiten sollen für normale Unternehmer verständlich, ruhig und vertrauenswürdig wirken. Technische Entwicklerbegriffe, interne Prozesssprache und widersprüchliche Aussagen werden aus der sichtbaren Public-UI entfernt, ohne funktionierende Gebiets-, Preis-, Checkout- oder Anfrageabläufe zu verändern.

## Scope

Geprüft und bei Bedarf angepasst werden:

- `/`
- `/verteilung-anfragen`
- `/verteilung-planen`
- `/fuer-unternehmen`
- `/so-funktionierts`
- `/preise`
- `/fuer-verteiler`
- `/kontakt`
- `/flyer-verteilen-lassen`
- `/branchen/baeckereien`
- `/branchen/gastronomie`
- `/branchen/fitnessstudios`
- `/branchen/handwerk`
- `/branchen/immobilien`
- `/branchen/einzelhandel`
- `/branchen/events-vereine`
- `/branchen/neueroeffnungen`
- `/flyer-fuer/neueroeffnung`
- `/flyer-fuer/events`
- `/flyer-fuer/gutscheine`
- `/flyer-fuer/saisonaktionen`
- `/flyer-fuer/tag-der-offenen-tuer`
- `/impressum`
- `/datenschutz`
- `/agb`

Nicht im Scope sind Backend, Prisma, Datenbank, Preisformeln, Stripe, Rollen, APIs, Maps-Interaktion, Auftragszustände und Authentifizierung.

## Current Findings Matrix

| Surface | Present and correct | Incomplete | Faulty or risky | Not part of scope |
|---|---|---|---|---|
| Startseite | FLYERO-Angebot, Nachweise, Gebiet-CTA | Einige operative Begriffe in Vorteilen und Ablauf | „Dispatch“ ist für Kunden unverständlich | Preis- und Gebietslogik |
| Anfrageweg | Onlinebuchung, Anfrageformular und Kontaktadresse vorhanden | Hierarchie zwischen drei Wegen weiter schärfen | Formularweg kann neben Onlinebuchung konkurrieren | Lead-API |
| Public Planner | Funktionierende bestehende Gebietsauswahl und Preisvorschau | Nutzertexte und Abschlussbereich | Technische Prozesssprache kann sichtbar werden | Karten- und Quote-Logik |
| Leistungen/Branchen/Anlässe | Gemeinsame Marketing-Komponenten und SEO-Daten | Texte pro Zielgruppe differenzieren | Wiederholungen und interne Ablaufbegriffe | SEO-Routing |
| Preise | Mindestauftrag und Preisrahmen vorhanden | Erklärungen vereinfachen | Interne Berechnungslogik darf nicht sichtbar werden | Pricing-Service |
| Kontakt/Verteiler | Formulare und Kontaktwege vorhanden | Felder und Bestätigungen sprachlich vereinfachen | Interne Kategorien/Status vermeiden | Lead-Speicherung |
| Rechtliches | Seiten und Unternehmensangaben vorhanden | Lesbarkeit prüfen | Nur offensichtliche Platzhalter melden | Rechtliche Inhalte nicht neu erfinden |

## Design Decisions

### Shared language

Kundentexte verwenden kurze, konkrete Verben:

- „Gebiet auswählen“ statt technischer Geometrie- oder Validierungsbegriffe
- „Wir prüfen Ihr Gebiet“ statt „System validiert“
- „Nach der Verteilung erhalten Sie …“ statt interner Statusbeschreibungen
- „Eigene, bereits gedruckte Flyer an das angegebene Lager senden“ als einheitliche Druckaussage

Interne Begriffe bleiben ausschließlich in Admin-, Entwickler- und Testoberflächen.

### Shared visual language

Die vorhandene FLYERO-Richtung bleibt erhalten. Es werden keine neuen Designsysteme und keine neuen Module eingeführt. Die Anpassungen beschränken sich auf vorhandene Marketing-Komponenten, Seitentexte und gezielte CSS-Regeln:

- ein dominanter Haupt-CTA pro Seite
- maximal ein klarer sekundärer Weg
- weniger technische Badges und Prozess-Chips
- ruhige Editorial-Listen statt zusätzlicher Dashboard-Karten
- stabile Desktop-/Mobile-Layouts ohne abgeschnittene Logos oder überlappende Buttons

### Public planner safety

Die funktionierende Gebietsauswahl, Preisberechnung, Registrierung und Buchung werden nicht umgebaut. Es werden nur sichtbare Hinweise, CTA-Texte und die Darstellung des Abschlussbereichs verändert. Bestehende Testverträge werden nur bei bewusst geändertem sichtbarem Text aktualisiert.

### Legal pages

Impressum, Datenschutz und AGB werden nur auf sichtbare Platzhalter, Beta-Hinweise, technische Notizen und Lesbarkeit geprüft. Rechtlich relevante Inhalte werden nicht redaktionell neu interpretiert.

## Verification Design

Für die Public-UI werden Regressionstests ergänzt oder erweitert für:

1. verbotene technische Begriffe in öffentlichen Renderquellen;
2. konsistente Aussage zu eigenen Drucksachen und Lageranlieferung;
3. sichtbare Kontaktadresse `hallo@flyero.org` ohne unnötiges Mailprogramm-Ziel;
4. sichtbaren und herunterladbaren Anfrageformular-Link;
5. jeden öffentlichen Sitemap-Pfad ohne Framework-Fehlerseite;
6. Desktop- und Mobile-Screenshots der zentralen Marketing- und Plannerflächen.

Die Tests bestätigen nicht die fachliche Richtigkeit von Preis, Maps, Stripe oder Datenbankwerten; diese bleiben durch ihre bestehenden Fachtests geschützt.

## Acceptance Criteria

- Alle 25 öffentlichen Sitemap-Routen sind einzeln geprüft oder als konkreter Blocker dokumentiert.
- Öffentliche Kundentexte enthalten keine internen Entwicklerbegriffe, Rohstatus, JSON, IDs oder Stacktraces.
- Jede Seite hat ein klares Hauptziel und eine klare nächste Aktion.
- Die Aussage zu eigenen, bereits gedruckten Flyern und Lageranlieferung ist konsistent.
- Desktop- und Mobile-Screenshots zeigen keine abgeschnittenen Logos, überlappenden Texte oder verschobenen CTAs.
- `npm run lint`, `npm run build` und alle relevanten Public-Smoke-Tests laufen erfolgreich.
- Keine Backend-, Datenbank-, Pricing-, Stripe-, Maps-, Rollen- oder API-Dateien werden geändert.

## Explicit Non-Goals

- keine neue Preislogik
- kein eigener Online-Druckservice
- keine Änderung der Kartenbedienung
- keine Entfernung funktionierender Buchungs- oder Anfragewege
- keine neuen Datenmodelle oder Migrationen
- keine technische Logik im Frontend als Ersatz für Serverlogik
