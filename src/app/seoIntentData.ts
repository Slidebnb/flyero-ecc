export type SeoIntentFaq = {
  question: string;
  answer: string;
};

export type SeoIntentSection = {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
};

export type SeoIntentPageData = {
  path: string;
  label: string;
  title: string;
  description: string;
  keywords: string[];
  areaServed?: string[];
  eyebrow: string;
  lead: string;
  asideTitle: string;
  asidePoints: string[];
  sections: SeoIntentSection[];
  faq: SeoIntentFaq[];
  relatedLinks: readonly (readonly [string, string])[];
  schemaKind: "service" | "article";
};

const serviceRelatedLinks = [
  ["Flyerverteilung planen", "/verteilung-planen"],
  ["Unverbindlich anfragen", "/verteilung-anfragen"],
  ["Preise verstehen", "/flyerverteilung-kosten"],
  ["GPS-Nachweis", "/flyerverteilung-mit-gps-nachweis"],
] as const;

const guideRelatedLinks = [
  ["Planer öffnen", "/verteilung-planen"],
  ["Anfrage senden", "/verteilung-anfragen"],
  ["Kosten der Flyerverteilung", "/flyerverteilung-kosten"],
  ["So funktioniert FLYERO", "/so-funktionierts"],
] as const;

export const seoIntentPages: SeoIntentPageData[] = [
  {
    path: "/flyerverteilung",
    label: "Flyerverteilung",
    title: "Flyerverteilung mit Gebietsauswahl, Nachweis und klarem Ablauf.",
    description:
      "Professionelle Flyerverteilung für Unternehmen: Gebiet auswählen, eigene Flyer anliefern, online buchen oder anfragen und Nachweise im Kundenkonto erhalten.",
    keywords: ["Flyerverteilung", "Flyerverteilung buchen", "professionelle Flyerverteilung"],
    eyebrow: "Leistung",
    lead:
      "FLYERO verbindet die klassische Haushaltsverteilung mit einer digitalen Planung: Sie wählen das Gebiet, legen die Menge fest und erhalten nach der Durchführung freigegebene Nachweise im Kundenkonto.",
    asideTitle: "Für Unternehmen, die nicht nur verteilen lassen wollen.",
    asidePoints: ["Gebiet online festlegen", "bereits gedruckte Flyer anliefern", "Nachweise nach der Durchführung erhalten"],
    sections: [
      {
        eyebrow: "Einsatz",
        title: "Wann Flyerverteilung sinnvoll ist.",
        text: "Flyerverteilung eignet sich für lokale Angebote, Neueröffnungen, Aktionen und wiederkehrende Kampagnen, bei denen Menschen in einem konkreten Gebiet erreicht werden sollen.",
        points: ["Neueröffnung oder Filialstart", "lokale Aktion oder Gutschein", "Verein, Event oder saisonale Kampagne"],
      },
      {
        eyebrow: "Ablauf",
        title: "Vom Gebiet zum Auftrag.",
        text: "Der Ablauf bleibt bewusst einfach: Gebiet auswählen, Menge prüfen, Zeitraum wählen und anschließend online buchen oder zuerst anfragen.",
        points: ["PLZ, Ort oder Karte nutzen", "mehrere Teilgebiete kombinieren", "Preisvorschau vor dem Absenden sehen"],
      },
      {
        eyebrow: "Nachweis",
        title: "Der Abschluss bleibt nachvollziehbar.",
        text: "Nach der Verteilung können GPS-Nachweis, Fotos und PDF-Bericht im Kundenkonto bereitgestellt werden. Sichtbar wird nur, was tatsächlich freigegeben wurde.",
        points: ["GPS-Nachweis nach Durchführung", "Foto-Dokumentation nach Freigabe", "PDF-Bericht im Kundenkonto"],
      },
    ],
    faq: [
      { question: "Kann ich mehrere Gebiete in einer Kampagne auswählen?", answer: "Ja. Sie können mehrere Teilgebiete auswählen und gemeinsam planen. Die Gesamtmenge gilt für die Kampagne." },
      { question: "Muss ich die Flyer über FLYERO drucken lassen?", answer: "Nein. Online geht FLYERO aktuell von eigenen, bereits gedruckten Flyern aus, die an das Empfangslager geschickt werden." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "service",
  },
  {
    path: "/prospektverteilung",
    label: "Prospektverteilung",
    title: "Prospektverteilung für Angebote, Filialen und lokale Aktionen.",
    description:
      "Prospektverteilung mit FLYERO: Einzugsgebiet festlegen, Menge planen, eigene Prospekte anliefern und die Verteilung nach Abschluss dokumentieren.",
    keywords: ["Prospektverteilung", "Prospekte verteilen lassen", "Angebotsblätter verteilen"],
    eyebrow: "Leistung",
    lead:
      "Prospekte und Angebotsblätter sollen nicht irgendwo landen, sondern in einem Gebiet, das zu Filiale, Angebot und Zielgruppe passt. FLYERO macht diese Auswahl online nachvollziehbar.",
    asideTitle: "Für Aktionen mit konkretem Einzugsgebiet.",
    asidePoints: ["Angebotsgebiet festlegen", "Menge passend zur Kampagne wählen", "Bericht nach der Verteilung erhalten"],
    sections: [
      {
        eyebrow: "Einsatz",
        title: "Für Angebote, die lokal wirken sollen.",
        text: "Prospektverteilung passt besonders zu Filialangeboten, Wochenaktionen, saisonalen Angeboten und wiederkehrenden lokalen Werbeaktionen.",
        points: ["Einzelhandel und Filialen", "Gastronomie und Lieferkarten", "Saison- und Rabattaktionen"],
      },
      {
        eyebrow: "Planung",
        title: "Gebiet und Menge gehören zusammen.",
        text: "Sie wählen das Verteilgebiet und passen anschließend die Stückzahl an. Die Preisvorschau gehört immer zu Ihrer konkreten Auswahl.",
        points: ["PLZ oder Ort eingeben", "markierte Fläche auswählen", "Stückzahl anpassen"],
      },
      {
        eyebrow: "Nach Abschluss",
        title: "Unterlagen im Kundenkonto.",
        text: "Nach der Durchführung stellt FLYERO freigegebene Nachweise und den Bericht im Kundenportal bereit.",
        points: ["GPS-Unterlagen", "Foto-Dokumentation", "PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Kann ich Prospekte für mehrere Filialen planen?", answer: "Ja. Mehrere Gebiete können in einer Kampagne zusammengefasst werden." },
      { question: "Ist die Preisvorschau verbindlich?", answer: "Die verbindliche Berechnung erfolgt serverseitig beim Auftrag. Wenn Gebiet oder Menge geändert werden, wird die Planung erneut aktualisiert." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "service",
  },
  {
    path: "/haushaltswerbung",
    label: "Haushaltswerbung",
    title: "Haushaltswerbung planen, buchen und nachvollziehbar abschließen.",
    description:
      "Haushaltswerbung mit FLYERO: lokale Verteilgebiete auswählen, Flyer oder Prospekte anliefern und Nachweise nach der Durchführung erhalten.",
    keywords: ["Haushaltswerbung", "Haushaltsverteilung", "Briefkastenwerbung"],
    eyebrow: "Leistung",
    lead:
      "Haushaltswerbung ist stark, wenn Gebiet, Botschaft und Menge zusammenpassen. FLYERO führt Sie vom ausgewählten Gebiet bis zum Abschlussbericht.",
    asideTitle: "Für lokale Reichweite ohne unnötige Streuverluste.",
    asidePoints: ["Gebiet sichtbar auswählen", "Stückzahl kontrollieren", "Verteilung dokumentieren lassen"],
    sections: [
      {
        eyebrow: "Ziel",
        title: "Haushalte im relevanten Umfeld erreichen.",
        text: "Ob Neueröffnung, Dienstleistung oder Aktion: Entscheidend ist nicht nur die Menge, sondern die passende regionale Auswahl.",
        points: ["direktes Umfeld eines Standorts", "Nachbarorte und Stadtteile", "mehrere Gebiete in einer Kampagne"],
      },
      {
        eyebrow: "Buchung",
        title: "Online starten oder zuerst anfragen.",
        text: "Wenn alles klar ist, können Sie den Auftrag online vorbereiten. Wenn Gebiet oder Timing geprüft werden sollen, nutzen Sie die unverbindliche Anfrage.",
        points: ["Planer ohne Registrierung testen", "Anfrage mit Projektangaben senden", "später im Kundenkonto weiterarbeiten"],
      },
      {
        eyebrow: "Transparenz",
        title: "Keine vorgespielten Ergebnisse.",
        text: "FLYERO zeigt Nachweise erst nach Durchführung und Freigabe. Damit bleibt die Kommunikation gegenüber Kunden und internen Teams sauber.",
        points: ["keine Vorab-Behauptungen", "freigegebene Dokumente", "klarer PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Ist Haushaltswerbung deutschlandweit möglich?", answer: "Gebiete können deutschlandweit angefragt werden. FLYERO prüft anschließend die Zustellbarkeit und Organisation für die konkrete Auswahl." },
      { question: "Kann ich nur einen Ortsteil auswählen?", answer: "Wenn eine passende Fläche verfügbar ist, kann sie ausgewählt werden. Alternativ kann eine Anfrage mit genauer Beschreibung gestellt werden." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "service",
  },
  {
    path: "/flyerverteilung-mit-gps-nachweis",
    label: "GPS-Nachweis",
    title: "Flyerverteilung mit GPS-Nachweis und freigegebenem PDF-Bericht.",
    description:
      "FLYERO dokumentiert Flyerverteilung nach Durchführung mit GPS-Nachweis, Foto-Dokumentation und PDF-Bericht im Kundenkonto.",
    keywords: ["Flyerverteilung GPS Nachweis", "GPS Nachweis Flyer", "Flyerverteilung mit Bericht"],
    eyebrow: "Nachweis",
    lead:
      "Wer Flyer verteilt, braucht nach dem Abschluss Klarheit. FLYERO trennt Planung und tatsächliche Dokumentation: Nachweise erscheinen erst, wenn sie vorliegen und freigegeben sind.",
    asideTitle: "Nachweise, die zum Auftrag passen.",
    asidePoints: ["GPS-Unterlagen nach Durchführung", "Fotos nach Freigabe", "PDF-Bericht im Kundenportal"],
    sections: [
      {
        eyebrow: "Dokumentation",
        title: "Was der Kunde nach der Verteilung sieht.",
        text: "Im Kundenkonto können freigegebene Nachweise und Berichte heruntergeladen werden. Interne Rohdaten bleiben geschützt.",
        points: ["GPS-Nachweis", "Foto-Dokumentation", "PDF-Verteilbericht"],
      },
      {
        eyebrow: "Abgrenzung",
        title: "Kein Ergebnis vor der Durchführung.",
        text: "FLYERO stellt keine künstlichen Routen oder angeblichen Zustellnachweise bereit. Die Anzeige folgt dem tatsächlichen Stand.",
        points: ["Planung ist nicht Durchführung", "Nachweis erst nach Verteilung", "Freigabe durch FLYERO"],
      },
      {
        eyebrow: "Nutzung",
        title: "Gut für interne Kontrolle und Kundenkommunikation.",
        text: "Der Bericht hilft, Kampagnen intern nachvollziehbar abzuschließen und die Verteilung sauber zu dokumentieren.",
        points: ["Kampagnenabschluss", "interne Ablage", "Nachweis gegenüber Auftraggebern"],
      },
    ],
    faq: [
      { question: "Sind GPS-Daten sofort sichtbar?", answer: "Nein. GPS-Unterlagen werden nach der Durchführung geprüft und anschließend im Kundenkonto bereitgestellt." },
      { question: "Ersetzt der GPS-Nachweis jeden einzelnen Briefkasten?", answer: "Nein. Der Nachweis dokumentiert die Durchführung und die freigegebenen Unterlagen, nicht jede einzelne Zustellung." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "service",
  },
  {
    path: "/bundesweite-flyerverteilung",
    label: "Bundesweite Flyerverteilung",
    title: "Flyerverteilung deutschlandweit anfragen und regional planen.",
    description:
      "FLYERO ermöglicht deutschlandweite Gebietsauswahl für Flyerverteilung. Direkte Buchung oder manuelle Prüfung hängen vom gewählten Gebiet ab.",
    keywords: ["bundesweite Flyerverteilung", "Flyerverteilung deutschlandweit", "Flyer deutschlandweit verteilen"],
    eyebrow: "Deutschlandweit",
    lead:
      "FLYERO ist nicht auf eine einzelne Stadt beschränkt. Sie können Gebiete deutschlandweit auswählen und die Kampagne mit mehreren Teilgebieten vorbereiten.",
    asideTitle: "Deutschlandweit planen, sauber prüfen.",
    asidePoints: ["PLZ und Orte in Deutschland auswählen", "mehrere Gebiete kombinieren", "Zustellbarkeit je Gebiet prüfen"],
    sections: [
      {
        eyebrow: "Gebiete",
        title: "Mehrere Orte in einer Kampagne.",
        text: "Eine Kampagne kann verschiedene Städte, Ortsteile oder Regionen enthalten. Die Gesamtmenge gilt für die gesamte Kampagne.",
        points: ["Stadt und Nachbarorte", "mehrere Filialgebiete", "getrennte Teilflächen"],
      },
      {
        eyebrow: "Organisation",
        title: "Nicht jedes Gebiet ist sofort gleich buchbar.",
        text: "Wenn ein Gebiet organisatorisch geprüft werden muss, führt FLYERO den Nutzer über die Anfrage. So bleibt der Prozess ehrlich und belastbar.",
        points: ["Zustellbarkeit prüfen", "Empfangslager klären", "Timing abstimmen"],
      },
      {
        eyebrow: "Wachstum",
        title: "Für Kampagnen, die regional starten und wachsen.",
        text: "Unternehmen können klein beginnen und später zusätzliche Gebiete ergänzen, ohne den grundlegenden Ablauf zu ändern.",
        points: ["ein Standort", "mehrere Filialen", "deutschlandweite Anfrage"],
      },
    ],
    faq: [
      { question: "Kann ich jeden Ort in Deutschland auswählen?", answer: "Gebiete können deutschlandweit gesucht und angefragt werden. Ob eine direkte Buchung möglich ist, hängt von der konkreten Zustellbarkeit ab." },
      { question: "Wird der Mindestpreis pro Stadt berechnet?", answer: "Nein. Die Preisberechnung bezieht sich auf die Kampagne und die gewählte Gesamtmenge." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "service",
  },
  {
    path: "/flyerverteilung-kosten",
    label: "Kosten",
    title: "Flyerverteilung Kosten: Preisvorschau, Mindestauftrag und Nachweis.",
    description:
      "Kosten der Flyerverteilung verstehen: Mindestauftrag, Gebiet, Menge, Mehrwertsteuer und transparente Preisvorschau bei FLYERO.",
    keywords: ["Flyerverteilung Kosten", "Flyer verteilen lassen Kosten", "Prospektverteilung Preis"],
    eyebrow: "Kosten",
    lead:
      "FLYERO soll nicht billig wirken, sondern nachvollziehbar. Die Preisvorschau zeigt den Netto-Preis zur gewählten Planung und weist die weiteren Beträge im Buchungsprozess transparent aus.",
    asideTitle: "Preis entsteht aus konkreter Planung.",
    asidePoints: ["Gebiet auswählen", "Stückzahl anpassen", "Preis vor dem Absenden prüfen"],
    sections: [
      {
        eyebrow: "Grundlage",
        title: "Mindestauftrag und Menge.",
        text: "Der Mindestauftrag schützt die operative Qualität. Bei größeren Mengen greift die hinterlegte Staffel für die gewählte Leistung.",
        points: ["Mindestauftrag 599 Euro netto bei Standard-Flyern", "mengenbasierte Berechnung", "MwSt. separat ausgewiesen"],
      },
      {
        eyebrow: "Planung",
        title: "Warum Gebiet und Menge zusammengehören.",
        text: "Ein Gebiet kann groß sein, aber die gewünschte Stückzahl wird vom Kunden bewusst festgelegt. FLYERO berechnet den Auftrag serverseitig neu.",
        points: ["Gebiet beeinflusst Planung", "Stückzahl bleibt bewusst wählbar", "Preis gehört zur aktuellen Auswahl"],
      },
      {
        eyebrow: "Sicherheit",
        title: "Preisvorschau vor dem Auftrag.",
        text: "Vor dem Absenden sehen Sie die aktuelle Preisvorschau. Ändern sich Gebiet oder Menge, wird die Planung aktualisiert.",
        points: ["keine versteckten Schritte", "klare CTA", "Checkout mit aktueller Berechnung"],
      },
    ],
    faq: [
      { question: "Sind die Preise netto?", answer: "Ja. FLYERO zeigt Preise netto zzgl. MwSt. Der Bruttobetrag wird im Buchungs- und Zahlungsprozess berücksichtigt." },
      { question: "Warum gibt es einen Mindestauftrag?", answer: "Eine seriöse Verteilung braucht Planung, Lager, Durchführung und Nachweise. Der Mindestauftrag deckt diese Mindestorganisation ab." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/gps-nachweis",
    label: "GPS-Nachweis",
    title: "GPS-Nachweis für Flyerverteilung: sichtbar nach der Durchführung.",
    description:
      "Was ein GPS-Nachweis bei FLYERO bedeutet: Dokumentation nach der Verteilung, Freigabe und Download im Kundenkonto.",
    keywords: ["GPS Nachweis", "Flyer GPS Dokumentation", "Verteilbericht GPS"],
    eyebrow: "Nachweis",
    lead:
      "Der GPS-Nachweis ist Teil des Abschlusses, nicht der Planung. FLYERO zeigt ihn im Kundenkonto, wenn die Verteilung durchgeführt und die Unterlagen freigegeben wurden.",
    asideTitle: "Klarer Unterschied zwischen Planung und Nachweis.",
    asidePoints: ["kein vorgespielter Routenverlauf", "Freigabe vor Veröffentlichung", "Download im Kundenkonto"],
    sections: [
      {
        eyebrow: "Bedeutung",
        title: "Was der GPS-Nachweis leisten soll.",
        text: "Er unterstützt die Nachvollziehbarkeit der Verteilung und wird zusammen mit weiteren Unterlagen bereitgestellt.",
        points: ["Verteilgebiet nachvollziehen", "Durchführung belegen", "Bericht ergänzen"],
      },
      {
        eyebrow: "Grenze",
        title: "Was er nicht behauptet.",
        text: "Der GPS-Nachweis ist kein Versprechen für jeden einzelnen Briefkasten. FLYERO kommuniziert diese Grenze bewusst sauber.",
        points: ["keine Einzelbriefkasten-Garantie", "keine künstlichen Routen", "kein Vorab-Ergebnis"],
      },
      {
        eyebrow: "Portal",
        title: "So erhält der Kunde die Unterlagen.",
        text: "Nach Freigabe erscheint der Nachweis im Kundenkonto und kann heruntergeladen werden.",
        points: ["Kundenkonto öffnen", "Kampagne wählen", "Nachweis herunterladen"],
      },
    ],
    faq: [
      { question: "Wann wird der GPS-Nachweis sichtbar?", answer: "Nach Durchführung, Prüfung und Freigabe durch FLYERO." },
      { question: "Bekomme ich zusätzlich Fotos?", answer: "Wenn Fotos für die Kampagne freigegeben wurden, stehen sie ebenfalls im Kundenkonto bereit." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/qualitaetssicherung",
    label: "Qualitätssicherung",
    title: "Qualitätssicherung bei FLYERO: Planung, Freigabe und Bericht.",
    description:
      "Wie FLYERO Qualität in der Flyerverteilung absichert: klare Planung, eigene Flyeranlieferung, Nachweisfreigabe und Kundenbericht.",
    keywords: ["Flyerverteilung Qualität", "Flyerverteilung Kontrolle", "Verteilbericht"],
    eyebrow: "Qualität",
    lead:
      "Qualität entsteht nicht durch große Versprechen, sondern durch klare Schritte: Gebiet auswählen, Auftrag sauber speichern, Durchführung organisieren und Unterlagen nach Abschluss freigeben.",
    asideTitle: "Qualität braucht einen einfachen Ablauf.",
    asidePoints: ["Gebiet sauber festlegen", "Flyer eindeutig zuordnen", "Nachweise erst nach Freigabe anzeigen"],
    sections: [
      {
        eyebrow: "Vorbereitung",
        title: "Der Auftrag muss eindeutig sein.",
        text: "Gebiet, Menge, Zeitraum und Empfangslager werden im Auftrag zusammengeführt. So entstehen weniger Rückfragen und weniger Fehlinterpretationen.",
        points: ["Gebietsauswahl", "Stückzahl", "Zeitraum und Hinweise"],
      },
      {
        eyebrow: "Durchführung",
        title: "Operative Prüfung statt blinder Zusage.",
        text: "Wenn ein Gebiet geprüft werden muss, wird der Auftrag nicht still als vollständig behandelt. FLYERO hält den nächsten Schritt sichtbar.",
        points: ["Zustellbarkeit", "Lagerzuordnung", "Kampagnenstatus"],
      },
      {
        eyebrow: "Abschluss",
        title: "Freigegebene Unterlagen statt Rohdaten.",
        text: "Kunden erhalten die Dokumente, die FLYERO freigegeben hat. Dadurch bleibt der Abschluss verständlich und kontrolliert.",
        points: ["GPS", "Fotos", "PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Wer gibt Nachweise frei?", answer: "FLYERO prüft die Unterlagen und stellt sie anschließend im Kundenkonto bereit." },
      { question: "Kann ich den Bericht herunterladen?", answer: "Ja. Sobald ein Bericht freigegeben ist, kann er im Kundenkonto heruntergeladen werden." },
    ],
    relatedLinks: serviceRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/haeufige-fragen",
    label: "Häufige Fragen",
    title: "Häufige Fragen zur Flyerverteilung mit FLYERO.",
    description:
      "Antworten zu Gebietsauswahl, Preisen, Flyeranlieferung, Zahlung, Nachweisen und Kundenkonto bei FLYERO.",
    keywords: ["Flyerverteilung Fragen", "FLYERO FAQ", "Flyer verteilen lassen Fragen"],
    eyebrow: "FAQ",
    lead:
      "Die wichtigsten Fragen zur Planung und Buchung: Gebiet auswählen, Flyer anliefern, online bezahlen oder zuerst anfragen.",
    asideTitle: "Kurz erklärt.",
    asidePoints: ["Gebiet und Preis prüfen", "eigene Flyer anliefern", "Nachweise nach Abschluss erhalten"],
    sections: [
      {
        eyebrow: "Start",
        title: "Wie starte ich eine Verteilung?",
        text: "Sie können öffentlich mit dem Planer starten oder direkt eine Anfrage senden. Für die Buchung wird ein Kundenkonto benötigt.",
        points: ["Planer ohne Registrierung testen", "Gebiet auswählen", "weiter zur Buchung oder Anfrage"],
      },
      {
        eyebrow: "Flyer",
        title: "Was passiert mit meinen Flyern?",
        text: "Online geht FLYERO von bereits gedruckten Flyern aus. Nach der Buchung sehen Sie, wohin die Flyer gesendet werden sollen.",
        points: ["eigene gedruckte Flyer", "Empfangslager im Auftrag", "Anlieferung vor Verteilung"],
      },
      {
        eyebrow: "Nachweise",
        title: "Wann sehe ich den Bericht?",
        text: "Nach der Durchführung und Freigabe stehen die Unterlagen im Kundenkonto bereit.",
        points: ["GPS-Nachweis", "Fotos", "PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Kann ich ohne Registrierung den Preis prüfen?", answer: "Ja. Der öffentliche Planer erlaubt eine Preisvorschau ohne Kundenkonto." },
      { question: "Kann ich zuerst unverbindlich anfragen?", answer: "Ja. Das ist besonders sinnvoll, wenn Gebiet, Termin oder Menge noch abgestimmt werden sollen." },
      { question: "Kann ich online bezahlen?", answer: "Ja, wenn der Auftrag direkt buchbar ist und die aktuelle Preisberechnung bestätigt wurde." },
    ],
    relatedLinks: guideRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/ratgeber",
    label: "Ratgeber",
    title: "Ratgeber für Flyerverteilung, Gebietsauswahl und Nachweise.",
    description:
      "FLYERO Ratgeber: Flyerverteilung planen, richtige Flyerauflage wählen, Verteilgebiet bestimmen und Nachweise verstehen.",
    keywords: ["Flyerverteilung Ratgeber", "Flyer Verteilgebiet planen", "Flyerauflage berechnen"],
    eyebrow: "Ratgeber",
    lead:
      "Eine gute Verteilung beginnt vor dem ersten Flyer. Der FLYERO Ratgeber bündelt die wichtigsten Entscheidungen rund um Gebiet, Menge, Zeitraum und Nachweise.",
    asideTitle: "Wissen, bevor Sie buchen.",
    asidePoints: ["Gebiet richtig eingrenzen", "Menge bewusst wählen", "Nachweise einordnen"],
    sections: [
      {
        eyebrow: "Planung",
        title: "Die wichtigsten Entscheidungen.",
        text: "Bevor Sie buchen, sollten Gebiet, Menge und Zeitpunkt zusammenpassen. Genau diese Entscheidungen führt der Planer zusammen.",
        points: ["Standort und Einzugsgebiet", "Flyeranzahl", "Vorlauf und Zeitraum"],
      },
      {
        eyebrow: "Praxis",
        title: "Nicht jede Kampagne braucht dieselbe Menge.",
        text: "Die passende Menge hängt von Ziel, Gebiet, Budget und Material ab. FLYERO zeigt eine Vorschau und lässt die Menge bewusst anpassen.",
        points: ["Neueröffnung", "Gutscheinaktion", "regelmäßige Angebotsverteilung"],
      },
      {
        eyebrow: "Nachweis",
        title: "Was nach der Verteilung zählt.",
        text: "Ein sauberer Abschluss hilft, die Aktion intern zu bewerten und Unterlagen nachvollziehbar abzulegen.",
        points: ["GPS-Unterlagen", "Fotos", "PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Ist der Ratgeber für alle Branchen gleich?", answer: "Die Grundlagen sind gleich, aber Anlass und Gebiet unterscheiden sich. Deshalb verlinkt FLYERO zusätzlich auf Branchen- und Anlassseiten." },
      { question: "Kann ich direkt aus dem Ratgeber planen?", answer: "Ja. Jede Ratgeberseite führt zum Planer oder zur Anfrage." },
    ],
    relatedLinks: [
      ["Flyerverteilung planen", "/ratgeber/flyerverteilung-planen"],
      ["Richtige Flyerauflage", "/ratgeber/richtige-flyer-auflage"],
      ["Verteilgebiet bestimmen", "/ratgeber/verteilgebiet-bestimmen"],
      ["Flyerverteilung kontrollieren", "/ratgeber/flyerverteilung-kontrollieren"],
    ],
    schemaKind: "article",
  },
  {
    path: "/ratgeber/flyerverteilung-planen",
    label: "Flyerverteilung planen",
    title: "Flyerverteilung planen: Gebiet, Menge und Zeitraum richtig vorbereiten.",
    description:
      "Flyerverteilung planen: Welche Entscheidungen vor der Buchung wichtig sind und wie FLYERO Gebiet, Menge und Ablauf zusammenführt.",
    keywords: ["Flyerverteilung planen", "Flyeraktion planen", "Flyer Kampagne vorbereiten"],
    eyebrow: "Ratgeber",
    lead:
      "Eine Flyerverteilung wird besser, wenn vor dem Auftrag drei Dinge klar sind: wo verteilt wird, wie viele Stück geplant sind und wann die Aktion stattfinden soll.",
    asideTitle: "Die drei Grundlagen.",
    asidePoints: ["Gebiet", "Menge", "Zeitraum"],
    sections: [
      {
        eyebrow: "Gebiet",
        title: "Erst das Gebiet, dann die Menge.",
        text: "Das Gebiet bestimmt den Rahmen der Kampagne. Danach kann die Stückzahl bewusst angepasst werden.",
        points: ["PLZ oder Ort starten", "Fläche auswählen", "mehrere Gebiete ergänzen"],
      },
      {
        eyebrow: "Menge",
        title: "Die Stückzahl bleibt eine bewusste Entscheidung.",
        text: "Die Vorschau hilft bei der Orientierung. Am Ende wählen Sie die Menge, die zu Budget und Aktion passt.",
        points: ["Mindestauftrag beachten", "Material und Zielgruppe berücksichtigen", "Preisvorschau prüfen"],
      },
      {
        eyebrow: "Zeit",
        title: "Planen Sie mit Vorlauf.",
        text: "Flyer müssen ankommen, Gebiet und Durchführung müssen organisiert werden. Ein früher Start reduziert Rückfragen.",
        points: ["Flyeranlieferung", "Wunschzeitraum", "Durchführung"],
      },
    ],
    faq: [
      { question: "Kann ich später noch anpassen?", answer: "Vor dem verbindlichen Auftrag können Gebiet und Menge angepasst werden. Danach hängen Änderungen vom Auftragsstand ab." },
      { question: "Was, wenn ich unsicher bin?", answer: "Dann ist die unverbindliche Anfrage der richtige Weg." },
    ],
    relatedLinks: guideRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/ratgeber/richtige-flyer-auflage",
    label: "Richtige Flyerauflage",
    title: "Richtige Flyerauflage wählen: Menge ohne Abschreckung planen.",
    description:
      "Wie Sie die passende Flyerauflage wählen: Gebiet, Anlass, Budget und Mindestauftrag sinnvoll zusammenbringen.",
    keywords: ["Flyerauflage", "Flyer Stückzahl", "Wie viele Flyer verteilen"],
    eyebrow: "Ratgeber",
    lead:
      "Die passende Flyerauflage ist nicht automatisch die größte Zahl. Entscheidend ist, was Sie erreichen möchten und welches Gebiet wirklich relevant ist.",
    asideTitle: "Menge passend zur Kampagne.",
    asidePoints: ["nicht unnötig groß starten", "Budget berücksichtigen", "Gebiet und Ziel verbinden"],
    sections: [
      {
        eyebrow: "Ziel",
        title: "Was soll die Kampagne auslösen?",
        text: "Ein Gutschein, eine Neueröffnung und eine regelmäßige Angebotsverteilung brauchen unterschiedliche Mengen.",
        points: ["Bekanntheit", "Besuch vor Ort", "Bestellung oder Anfrage"],
      },
      {
        eyebrow: "Gebiet",
        title: "Große Flächen sind nicht automatisch besser.",
        text: "Ein kleineres, relevantes Gebiet kann sinnvoller sein als eine breite Streuung ohne klare Zielgruppe.",
        points: ["direktes Umfeld", "Nachbarorte", "mehrere Teilgebiete"],
      },
      {
        eyebrow: "Preis",
        title: "Mindestauftrag transparent einordnen.",
        text: "FLYERO arbeitet mit einem Mindestauftrag, weil Planung, Organisation und Nachweise auch bei kleineren Mengen Aufwand verursachen.",
        points: ["Qualität sichern", "Aufwand abdecken", "Preis vor Absenden sehen"],
      },
    ],
    faq: [
      { question: "Warum zeigt FLYERO nicht nur eine automatische Menge?", answer: "Weil die richtige Menge von Ziel, Gebiet und Budget abhängt. Die Vorschau unterstützt, ersetzt aber nicht die Entscheidung." },
      { question: "Kann ich mit einer kleinen Menge starten?", answer: "Ja, solange der Mindestauftrag berücksichtigt wird." },
    ],
    relatedLinks: guideRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/ratgeber/verteilgebiet-bestimmen",
    label: "Verteilgebiet bestimmen",
    title: "Verteilgebiet bestimmen: PLZ, Ort und mehrere Teilgebiete sinnvoll nutzen.",
    description:
      "Verteilgebiet bestimmen: Wie Unternehmen PLZ, Orte, Nachbarstädte und Teilgebiete für eine Flyerkampagne planen.",
    keywords: ["Verteilgebiet bestimmen", "Flyer Gebiet auswählen", "PLZ Flyer verteilen"],
    eyebrow: "Ratgeber",
    lead:
      "Das Verteilgebiet entscheidet darüber, ob eine Kampagne zur Zielgruppe passt. FLYERO unterstützt PLZ-, Orts- und Karten-Auswahl sowie mehrere Teilgebiete.",
    asideTitle: "Gebietsauswahl ohne unnötige Komplexität.",
    asidePoints: ["PLZ oder Ort eingeben", "Gebiet sichtbar auswählen", "weitere Gebiete hinzufügen"],
    sections: [
      {
        eyebrow: "Startpunkt",
        title: "Beginnen Sie mit dem Standort.",
        text: "Viele Kampagnen starten rund um eine Filiale, ein Geschäft, eine Praxis, ein Studio oder einen Veranstaltungsort.",
        points: ["Adresse oder PLZ", "Einzugsgebiet", "Nachbarorte"],
      },
      {
        eyebrow: "Mehrgebiete",
        title: "Mehrere Teilgebiete können sinnvoll sein.",
        text: "Wenn Zielgruppen in mehreren Orten sitzen, ist eine Kampagne mit mehreren Gebieten klarer als ein ungenaues großes Gebiet.",
        points: ["Filialen", "Stadtteile", "Nachbarstädte"],
      },
      {
        eyebrow: "Kontrolle",
        title: "Die Auswahl bleibt sichtbar.",
        text: "Die Karte zeigt das gewählte Gebiet, damit die Planung nachvollziehbar bleibt.",
        points: ["Fläche", "Preisvorschau", "Empfangslager"],
      },
    ],
    faq: [
      { question: "Kann ich nur eine PLZ auswählen?", answer: "Ja, wenn die passende Fläche verfügbar ist. Sie können anschließend weitere Gebiete hinzufügen." },
      { question: "Was passiert bei sehr großen Gebieten?", answer: "FLYERO zeigt die Planung an und kann je nach Gebiet eine Prüfung vor der Buchung verlangen." },
    ],
    relatedLinks: guideRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/ratgeber/flyerverteilung-kontrollieren",
    label: "Flyerverteilung kontrollieren",
    title: "Flyerverteilung kontrollieren: Was Nachweise wirklich leisten.",
    description:
      "Flyerverteilung kontrollieren: GPS-Nachweis, Fotos und PDF-Bericht bei FLYERO richtig verstehen.",
    keywords: ["Flyerverteilung kontrollieren", "Flyer Nachweis", "Verteilbericht verstehen"],
    eyebrow: "Ratgeber",
    lead:
      "Kontrolle bedeutet nicht, vorab perfekte Ergebnisse zu versprechen. Kontrolle bedeutet, nach der Durchführung freigegebene Unterlagen nachvollziehbar bereitzustellen.",
    asideTitle: "Nachweise richtig einordnen.",
    asidePoints: ["Planung speichern", "Durchführung dokumentieren", "Bericht freigeben"],
    sections: [
      {
        eyebrow: "GPS",
        title: "GPS unterstützt die Nachvollziehbarkeit.",
        text: "GPS-Unterlagen helfen, den Ablauf einer Verteilung besser einzuordnen. Sie werden erst nach der Durchführung sichtbar.",
        points: ["Zeitpunkt", "Gebiet", "Dokumentation"],
      },
      {
        eyebrow: "Fotos",
        title: "Fotos ergänzen den Bericht.",
        text: "Freigegebene Fotos können die Dokumentation ergänzen, ersetzen aber keine unrealistischen Einzelzusagen.",
        points: ["Foto-Dokumentation", "Freigabe", "Kundenkonto"],
      },
      {
        eyebrow: "Bericht",
        title: "Der PDF-Bericht fasst den Abschluss zusammen.",
        text: "Der Bericht ist für die Ablage und interne Kommunikation gedacht und bündelt die freigegebenen Informationen.",
        points: ["Kampagne", "Gebiet", "Nachweise"],
      },
    ],
    faq: [
      { question: "Kann ich Nachweise herunterladen?", answer: "Ja. Freigegebene Nachweise stehen im Kundenkonto zum Download bereit." },
      { question: "Sind die Nachweise sofort nach Zahlung vorhanden?", answer: "Nein. Sie entstehen nach der Verteilung und werden anschließend freigegeben." },
    ],
    relatedLinks: guideRelatedLinks,
    schemaKind: "article",
  },
  {
    path: "/flyerverteilung-bendorf",
    label: "Bendorf",
    title: "Flyerverteilung Bendorf: Gebiet waehlen, Preis pruefen, Nachweis erhalten.",
    description:
      "Flyerverteilung in Bendorf und Umgebung mit FLYERO: Gebiet online auswaehlen, eigene Flyer anliefern, Auftrag buchen oder anfragen und Nachweise im Kundenkonto erhalten.",
    keywords: ["Flyerverteilung Bendorf", "Flyer verteilen Bendorf", "Prospektverteilung Bendorf", "Haushaltswerbung Bendorf"],
    areaServed: ["Bendorf", "Sayn", "Muelhofen", "Stromberg", "Weitersburg", "Neuwied", "Koblenz"],
    eyebrow: "Raum Bendorf",
    lead:
      "FLYERO hilft Unternehmen im Raum Bendorf, Flyer- und Prospektkampagnen sauber zu planen: Gebiet auswaehlen, Menge festlegen, eigene Drucksachen anliefern und nach der Durchfuehrung freigegebene Nachweise erhalten.",
    asideTitle: "Fuer lokale Aktionen rund um Bendorf.",
    asidePoints: ["Bendorf und Stadtteile planen", "Nachbarorte als Teilgebiete ergaenzen", "Nachweise nach der Verteilung erhalten"],
    sections: [
      {
        eyebrow: "Einsatz",
        title: "Flyerverteilung fuer Bendorf und direkte Umgebung.",
        text: "Ob Geschaeft, Praxis, Verein, Gastronomie oder Dienstleister: In Bendorf zaehlt ein klar begrenztes Gebiet, damit die Verteilung zur lokalen Zielgruppe passt.",
        points: ["Sayn und Muelhofen", "Stromberg und Weitersburg", "Kampagnen mit Neuwied oder Koblenz kombinieren"],
      },
      {
        eyebrow: "Planung",
        title: "Ort oder PLZ eingeben und Gebiet auswaehlen.",
        text: "Im Planer starten Sie mit Bendorf oder einer PLZ, waehlen die passende Flaeche und koennen bei Bedarf weitere Teilgebiete hinzufuegen.",
        points: ["Gebiet sichtbar auf der Karte", "mehrere Teilgebiete moeglich", "Preisvorschau vor dem Absenden"],
      },
      {
        eyebrow: "Nachweis",
        title: "Nach Abschluss bleiben Unterlagen greifbar.",
        text: "Nach der Durchfuehrung stellt FLYERO freigegebene Nachweise und den PDF-Bericht im Kundenkonto bereit.",
        points: ["GPS-Unterlagen nach Durchfuehrung", "Foto-Dokumentation nach Freigabe", "PDF-Bericht zum Download"],
      },
    ],
    faq: [
      { question: "Kann ich Bendorf zusammen mit Neuwied oder Koblenz planen?", answer: "Ja. Mehrere Orte koennen als Teilgebiete in einer Kampagne zusammengefuehrt werden." },
      { question: "Muss ich die Flyer selbst drucken?", answer: "Online geht FLYERO von bereits gedruckten Flyern aus. Die Empfangslager-Informationen erhalten Sie im Auftrag." },
    ],
    relatedLinks: [
      ["Flyerverteilung Neuwied", "/flyerverteilung-neuwied"],
      ["Flyerverteilung Koblenz", "/flyerverteilung-koblenz"],
      ["Gebiet und Preis pruefen", "/verteilung-planen"],
      ["Unverbindlich anfragen", "/verteilung-anfragen"],
    ],
    schemaKind: "service",
  },
  {
    path: "/flyerverteilung-koblenz",
    label: "Koblenz",
    title: "Flyerverteilung Koblenz: lokale Kampagnen mit Gebiet und Nachweis.",
    description:
      "Flyerverteilung in Koblenz planen: Gebiet online auswaehlen, Flyer anliefern, Preisvorschau pruefen und Nachweise nach der Verteilung im Kundenkonto erhalten.",
    keywords: ["Flyerverteilung Koblenz", "Flyer verteilen Koblenz", "Prospektverteilung Koblenz", "Haushaltswerbung Koblenz"],
    areaServed: ["Koblenz", "Altstadt", "Luetzel", "Metternich", "Rauental", "Karthause", "Neuwied", "Bendorf"],
    eyebrow: "Raum Koblenz",
    lead:
      "Koblenz hat viele unterschiedliche Einzugsgebiete. FLYERO macht die Auswahl sichtbar: Sie legen die passende Flaeche fest, bestimmen die Stueckzahl und erhalten nach Abschluss freigegebene Unterlagen.",
    asideTitle: "Fuer Kampagnen in Koblenz und Nachbarorten.",
    asidePoints: ["Koblenzer Stadtteile gezielt planen", "Teilgebiete ergaenzen", "Nachweise im Kundenkonto erhalten"],
    sections: [
      {
        eyebrow: "Lokale Reichweite",
        title: "Koblenz braucht eine saubere Gebietsauswahl.",
        text: "Eine Verteilung in Koblenz kann je nach Ziel rund um Innenstadt, Stadtteile, Filialstandort oder Nachbarorte sinnvoll sein.",
        points: ["Innenstadt und Altstadt", "Metternich, Luetzel und Rauental", "Kombination mit Bendorf oder Neuwied"],
      },
      {
        eyebrow: "Ablauf",
        title: "Von der Karte zum Auftrag.",
        text: "Der Planer verbindet Gebietsauswahl, Menge, Zeitraum und Preisvorschau. Wenn alles passt, kann online gebucht oder zuerst angefragt werden.",
        points: ["PLZ, Ort oder Adresse nutzen", "Flaeche sichtbar auswaehlen", "Auftrag oder Anfrage starten"],
      },
      {
        eyebrow: "Dokumentation",
        title: "Verteilung nachvollziehbar abschliessen.",
        text: "Nachweise werden erst nach Durchfuehrung und Freigabe bereitgestellt. So bleibt der Abschluss ehrlich und belastbar.",
        points: ["GPS-Nachweis", "Foto-Dokumentation", "PDF-Bericht"],
      },
    ],
    faq: [
      { question: "Kann ich nur einzelne Koblenzer Stadtteile auswaehlen?", answer: "Wenn passende Flaechen verfuegbar sind, koennen einzelne Bereiche ausgewaehlt und kombiniert werden." },
      { question: "Ist Koblenz direkt online buchbar?", answer: "Der Planer zeigt die aktuelle Buchungsmoeglichkeit. Falls FLYERO ein Gebiet pruefen muss, fuehrt der Ablauf zur unverbindlichen Anfrage." },
    ],
    relatedLinks: [
      ["Flyerverteilung Bendorf", "/flyerverteilung-bendorf"],
      ["Flyerverteilung Neuwied", "/flyerverteilung-neuwied"],
      ["Kosten verstehen", "/flyerverteilung-kosten"],
      ["Planer oeffnen", "/verteilung-planen"],
    ],
    schemaKind: "service",
  },
  {
    path: "/flyerverteilung-neuwied",
    label: "Neuwied",
    title: "Flyerverteilung Neuwied: Gebiet planen, Flyer einsenden, Bericht erhalten.",
    description:
      "Flyerverteilung in Neuwied und Umgebung mit FLYERO: Gebiet auswaehlen, Preis pruefen, Empfangslager nutzen und Nachweise nach Abschluss herunterladen.",
    keywords: ["Flyerverteilung Neuwied", "Flyer verteilen Neuwied", "Prospektverteilung Neuwied", "Haushaltswerbung Neuwied"],
    areaServed: ["Neuwied", "Heddesdorf", "Engers", "Feldkirchen", "Irlich", "Oberbieber", "Bendorf", "Koblenz"],
    eyebrow: "Raum Neuwied",
    lead:
      "Im Raum Neuwied kann FLYERO lokale Kampagnen vom Gebiet bis zum Bericht abbilden. Sie waehlen die Flaeche, senden eigene gedruckte Flyer an das Empfangslager und erhalten nach Abschluss freigegebene Nachweise.",
    asideTitle: "Fuer Verteilungen in Neuwied und Umgebung.",
    asidePoints: ["Neuwied und Stadtteile planen", "Bendorf oder Koblenz ergaenzen", "Empfangslager im Auftrag sehen"],
    sections: [
      {
        eyebrow: "Gebiet",
        title: "Neuwied mit passenden Teilgebieten planen.",
        text: "Je nach Kampagne kann eine Verteilung in Neuwied einzelne Stadtteile, Gewerbeumfelder oder Nachbarorte enthalten.",
        points: ["Heddesdorf und Innenstadt", "Engers, Feldkirchen und Irlich", "mehrere Orte in einer Kampagne"],
      },
      {
        eyebrow: "Buchung",
        title: "Eigene Flyer anliefern und Auftrag sauber starten.",
        text: "Online geht FLYERO von bereits gedruckten Flyern aus. Nach der Buchung sehen Sie die relevanten Informationen zur Anlieferung.",
        points: ["Stueckzahl festlegen", "Zeitraum waehlen", "Empfangslager beachten"],
      },
      {
        eyebrow: "Nachweise",
        title: "Unterlagen nach der Durchfuehrung.",
        text: "Freigegebene Nachweise und Berichte erscheinen im Kundenkonto und koennen dort heruntergeladen werden.",
        points: ["GPS-Unterlagen", "Fotos", "PDF-Abschlussbericht"],
      },
    ],
    faq: [
      { question: "Kann ich im Raum Neuwied mehrere Orte zusammen buchen?", answer: "Ja. Bendorf, Koblenz oder weitere Orte koennen als Teilgebiete in derselben Kampagne geplant werden." },
      { question: "Wo sende ich meine Flyer hin?", answer: "Das Empfangslager wird im Auftrag angezeigt. Fuer den aktuellen Betrieb ist Neuwied als Lagerstandort vorgesehen." },
    ],
    relatedLinks: [
      ["Flyerverteilung Bendorf", "/flyerverteilung-bendorf"],
      ["Flyerverteilung Koblenz", "/flyerverteilung-koblenz"],
      ["Gebiet bestimmen", "/ratgeber/verteilgebiet-bestimmen"],
      ["Verteilung anfragen", "/verteilung-anfragen"],
    ],
    schemaKind: "service",
  },
];

export const seoIntentPageByPath = new Map(seoIntentPages.map((page) => [page.path, page]));

export const seoIntentRoutes = seoIntentPages.map((page) => ({
  path: page.path,
  priority: page.path === "/flyerverteilung" ? 0.9 : page.path === "/ratgeber" ? 0.76 : 0.74,
  changeFrequency: "monthly" as const,
}));
