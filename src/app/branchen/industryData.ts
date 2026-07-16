export type IndustryFaq = {
  question: string;
  answer: string;
};

export type IndustryPageData = {
  slug: string;
  path: string;
  label: string;
  iconKey: string;
  title: string;
  description: string;
  keywords: string[];
  heroLead: string;
  intro: string;
  campaignExamples: string[];
  planningNote: string;
  proofNote: string;
  faq: IndustryFaq[];
};

export const industryPages: IndustryPageData[] = [
  {
    slug: "baeckereien",
    path: "/branchen/baeckereien",
    label: "Bäckereien",
    iconKey: "bakery",
    title: "Flyerverteilung für Bäckereien, die in der Nachbarschaft ankommt.",
    description: "Flyerverteilung für Bäckereien: Neueröffnung, Frühstücksangebot oder Saisonaktion im passenden Gebiet planen und nachvollziehbar dokumentieren.",
    keywords: ["Flyerverteilung Bäckerei", "Bäckerei Neueröffnung Flyer", "Bäckerei Werbung lokal"],
    heroLead: "Neue Filiale, Wochenangebot oder saisonale Aktion? Bringen Sie Ihre Botschaft in die Haushalte rund um Ihre Verkaufsstelle.",
    intro: "Bäckereien werben dort, wo Menschen morgens starten und regelmäßig einkaufen. FLYERO hilft dabei, Verteilgebiete passend zu planen und die Durchführung nach der Aktion verständlich zu dokumentieren.",
    campaignExamples: ["Eröffnung einer neuen Filiale", "Frühstücks- und Mittagsangebote", "Oster-, Weihnachts- oder Schulanfangsaktionen"],
    planningNote: "Legen Sie PLZ, Ort oder mehrere Teilgebiete fest und wählen Sie die Flyeranzahl. Die Gebiets- und Preisvorschau wird für Ihre konkrete Auswahl berechnet.",
    proofNote: "Nach der Verteilung können externer GPS-Nachweis, freigegebene Fotos und der geprüfte PDF-Bericht im Kundenkonto bereitgestellt werden.",
    faq: [
      { question: "Kann ich mehrere Filialgebiete gemeinsam planen?", answer: "Ja. Eine Kampagne kann mehrere getrennte Teilgebiete enthalten, zum Beispiel rund um verschiedene Filialen. Die Gebiete werden einzeln gespeichert und gemeinsam geprüft." },
      { question: "Wie früh sollte eine Bäckerei-Flyeraktion geplant werden?", answer: "Planen Sie den gewünschten Zeitraum mit Vorlauf ein. Der früheste auswählbare Start wird im Buchungsprozess angezeigt und hängt von Gebiet und Prüfung ab." },
    ],
  },
  {
    slug: "gastronomie",
    path: "/branchen/gastronomie",
    label: "Gastronomie",
    iconKey: "gastronomy",
    title: "Flyerverteilung für Gastronomie mit klarer Gebietsplanung.",
    description: "Flyerverteilung für Restaurants, Cafés und Lieferdienste: Speisekarte, Neueröffnung oder Aktion im relevanten Einzugsgebiet bekannt machen.",
    keywords: ["Flyerverteilung Gastronomie", "Restaurant Flyer verteilen", "Café Neueröffnung Werbung"],
    heroLead: "Eröffnen, liefern, reservieren: Verteilen Sie Ihre Gastro-Aktion dort, wo Gäste sie im Alltag wahrnehmen können.",
    intro: "Restaurants und Lieferdienste brauchen keine breite Streuung ohne Plan, sondern ein Gebiet, das zum Standort und Angebot passt. FLYERO unterstützt die Auswahl, Buchung und spätere Nachweisführung.",
    campaignExamples: ["Restaurant- oder Café-Eröffnung", "Liefergebiet und Speisekarte", "Mittagskarte, Gutschein- oder Saisonaktion"],
    planningNote: "Wählen Sie das Einzugsgebiet nach PLZ, Ort oder Karte. Bei mehreren Standorten können Sie getrennte Gebiete in einer Kampagne zusammenfassen.",
    proofNote: "Die Nachweise werden nicht vorweggenommen: Nach Abschluss sehen Sie nur tatsächlich hochgeladene und von FLYERO freigegebene Dokumente.",
    faq: [
      { question: "Kann ich eine Speisekarte direkt mitsenden?", answer: "Ja. Bereits gedruckte Flyer werden dem Auftrag zugeordnet. Weitere Dateien können im Kundenkonto hinterlegt oder später ergänzt werden." },
      { question: "Kann das Liefergebiet größer als eine Stadt sein?", answer: "Ja. Sie können mehrere Orte oder Teilgebiete auswählen. FLYERO prüft anschließend die Verfügbarkeit für jedes Gebiet." },
    ],
  },
  {
    slug: "fitnessstudios",
    path: "/branchen/fitnessstudios",
    label: "Fitnessstudios",
    iconKey: "fitness",
    title: "Flyerverteilung für Fitnessstudios rund um Ihren Standort.",
    description: "Flyerverteilung für Fitnessstudios und Gesundheitsanbieter: Probetraining, Kursstart und neue Angebote im passenden lokalen Gebiet bewerben.",
    keywords: ["Flyerverteilung Fitnessstudio", "Fitnessstudio Probetraining Flyer", "Fitness Werbung lokal"],
    heroLead: "Neue Kurse und Probetrainings verdienen Sichtbarkeit in der direkten Umgebung. Planen Sie Ihre Aktion mit einem Gebiet, das zu Ihrem Studio passt.",
    intro: "Für Fitnessangebote zählt die Nähe. Mit FLYERO definieren Sie Ihr gewünschtes Gebiet, sehen die Berechnung für die konkrete Auswahl und erhalten nach der Durchführung einen nachvollziehbaren Abschluss.",
    campaignExamples: ["Probetraining und Mitgliedschaft", "Kursstart oder Studio-Eröffnung", "Gesundheits-, Reha- oder Personal-Training-Angebote"],
    planningNote: "Kombinieren Sie Stadtteile, Nachbarorte oder einzelne Gebiete, wenn Ihre Zielgruppe über mehrere Standorte verteilt ist.",
    proofNote: "GPS-Bericht, Foto-Dokumentation und PDF-Verteilbericht werden erst nach der echten Durchführung und internen Prüfung sichtbar.",
    faq: [
      { question: "Kann ich eine Aktion für mehrere Studios planen?", answer: "Ja. Mehrere Teilgebiete können in einer Kampagne getrennt erfasst werden. Das erleichtert die Zuordnung und spätere Auswertung." },
      { question: "Wie wird die Flyeranzahl festgelegt?", answer: "Die Empfehlung basiert auf dem ausgewählten Gebiet. Sie können die Menge anschließend selbst anpassen; der Preis wird serverseitig neu berechnet." },
    ],
  },
  {
    slug: "handwerk",
    path: "/branchen/handwerk",
    label: "Handwerk",
    iconKey: "craft",
    title: "Flyerverteilung für Handwerksbetriebe mit regionalem Fokus.",
    description: "Flyerverteilung für Handwerker: Leistungen, Notdienst, Saisonangebote und freie Kapazitäten im eigenen Einzugsgebiet bekannt machen.",
    keywords: ["Flyerverteilung Handwerk", "Handwerker Flyer verteilen", "lokale Werbung Handwerksbetrieb"],
    heroLead: "Zeigen Sie, was Ihr Betrieb leistet, genau dort, wo neue Aufträge entstehen können.",
    intro: "Handwerksbetriebe arbeiten regional und brauchen Kampagnen, die zu ihrem tatsächlichen Einsatzgebiet passen. FLYERO macht Gebiet, Flyeranzahl und Abschluss nachvollziehbar.",
    campaignExamples: ["Saisonale Wartung und Sanierung", "Notdienst und kurzfristige Verfügbarkeit", "Neue Leistungen, Jobs oder Betriebsjubiläum"],
    planningNote: "Planen Sie mehrere Einsatzgebiete gemeinsam oder starten Sie mit einer klar abgegrenzten Region. Die Auswahl bleibt deutschlandweit offen.",
    proofNote: "Der Kundenbericht trennt Planung und dokumentierte Durchführung. Er enthält nur freigegebene Nachweise und keine pauschalen Briefkasten-Garantien.",
    faq: [
      { question: "Kann ich nur bestimmte Stadtteile auswählen?", answer: "Ja. Wenn die Kartendaten verfügbar sind, können Sie Gebiete über die Karte oder eine konkrete Ortsauswahl festlegen. Alternativ zeichnen Sie das Gebiet selbst." },
      { question: "Kann ich verschiedene Leistungen in einer Aktion bewerben?", answer: "Ja. Ihre bereits gedruckten Flyer können Sie gemeinsam mit den Hinweisen zur Kampagne im Auftrag hinterlegen." },
    ],
  },
  {
    slug: "immobilien",
    path: "/branchen/immobilien",
    label: "Immobilien",
    iconKey: "property",
    title: "Flyerverteilung für Immobilien mit planbarem Gebiet.",
    description: "Flyerverteilung für Makler, Bauträger und Projektentwickler: Besichtigungen, Neubauprojekte und Immobilienangebote in passenden Wohngebieten bekannt machen.",
    keywords: ["Flyerverteilung Immobilien", "Immobilien Flyer verteilen", "Makler Werbung Gebiet"],
    heroLead: "Vom Neubauprojekt bis zum Besichtigungstermin: Erreichen Sie das Wohnumfeld, das für Ihr Angebot relevant ist.",
    intro: "Immobilienkampagnen brauchen eine nachvollziehbare regionale Auswahl. FLYERO verbindet Gebietsplanung mit einem klaren Auftrag, eigener Flyeranlieferung und späterem Verteilbericht.",
    campaignExamples: ["Neubauprojekt und Grundstücke", "Tag der offenen Tür und Besichtigung", "Vermietung, Verkauf oder Maklerstandort"],
    planningNote: "Legen Sie mehrere Teilgebiete rund um ein Projekt oder mehrere Objekte an. Die Flächen und Berechnungen bleiben je Gebiet nachvollziehbar.",
    proofNote: "Nach der internen Prüfung kann der Kunde den Bericht mit Zeitraum, dokumentierter Menge, GPS-Nachweis und freigegebenen Fotos abrufen.",
    faq: [
      { question: "Kann eine Kampagne mehrere Bauprojekte enthalten?", answer: "Ja. Mehrere Teilgebiete können getrennt benannt und gemeinsam gebucht oder zunächst angefragt werden." },
      { question: "Werden private Adressdaten im Bericht veröffentlicht?", answer: "Nein. Kunden sehen nur die freigegebenen, für den Bericht notwendigen Informationen. Interne Rohdaten bleiben geschützt." },
    ],
  },
  {
    slug: "einzelhandel",
    path: "/branchen/einzelhandel",
    label: "Einzelhandel",
    iconKey: "retail",
    title: "Flyerverteilung für den Einzelhandel, die Angebote sichtbar macht.",
    description: "Flyerverteilung für Geschäfte und Filialen: Neueröffnung, Rabattaktion oder verkaufsoffener Sonntag im passenden Einzugsgebiet bewerben.",
    keywords: ["Flyerverteilung Einzelhandel", "Geschäft Neueröffnung Flyer", "lokale Rabattaktion Flyer"],
    heroLead: "Bringen Sie Angebote, Eröffnungen und Aktionen in die Umgebung Ihrer Filiale oder Ihres Geschäfts.",
    intro: "Einzelhändler müssen nicht ganz Deutschland ansprechen, sondern die Menschen in ihrem realistischen Einzugsgebiet. FLYERO macht diese Auswahl buchbar und den Abschluss prüfbar.",
    campaignExamples: ["Filial- oder Geschäftseröffnung", "Rabattwoche und Saisonverkauf", "Verkaufsoffener Sonntag oder lokale Aktion"],
    planningNote: "Wählen Sie ein oder mehrere Gebiete und passen Sie die Flyerzahl an Ihre Aktion an. Die aktuelle Preisvorschau gehört immer zur konkreten Auswahl.",
    proofNote: "Nachweise werden nach der Verteilung hochgeladen, geprüft und im Kundenkonto veröffentlicht. Vorher zeigt FLYERO keine angeblichen Ergebnisse.",
    faq: [
      { question: "Kann ich mehrere Filialen in einer Kampagne verbinden?", answer: "Ja. Für jede Filiale können Sie ein eigenes Teilgebiet anlegen und die Kampagne gemeinsam organisieren." },
      { question: "Kann ich die Flyer selbst drucken lassen?", answer: "Ja. Im Onlineprozess wählen Sie eigene, bereits gedruckte Flyer und erhalten nach bestätigter Gebietsprüfung die Lageradresse für die Anlieferung." },
    ],
  },
  {
    slug: "events-vereine",
    path: "/branchen/events-vereine",
    label: "Events & Vereine",
    iconKey: "events",
    title: "Flyerverteilung für Events und Vereine mit klarer Dokumentation.",
    description: "Flyerverteilung für Veranstaltungen, Vereine und lokale Initiativen: Termine, Feste und Mitgliederwerbung im passenden Gebiet bekannt machen.",
    keywords: ["Flyerverteilung Event", "Veranstaltung Flyer verteilen", "Verein Mitgliederwerbung Flyer"],
    heroLead: "Machen Sie Ihre Veranstaltung dort sichtbar, wo Besucher, Nachbarn und neue Mitglieder erreicht werden sollen.",
    intro: "Events haben einen festen Termin und Vereine arbeiten häufig in einem klaren lokalen Umfeld. FLYERO unterstützt die Gebietsplanung mit ausreichend Vorlauf und einem geordneten Nachweisprozess.",
    campaignExamples: ["Stadtfest, Konzert oder Markt", "Sportveranstaltung und Vereinsfest", "Mitgliederwerbung und Saisonstart"],
    planningNote: "Geben Sie den gewünschten Zeitraum frühzeitig an. Bei mehreren Veranstaltungsorten können die Teilgebiete getrennt geplant werden.",
    proofNote: "Der Bericht beschreibt die dokumentierte Durchführung. Er ersetzt keine Einzelbestätigung jedes Briefkastens und macht diese Grenze transparent.",
    faq: [
      { question: "Kann ich eine zeitlich begrenzte Aktion buchen?", answer: "Ja. Im Auftrag wählen Sie einen gewünschten Zeitraum. Der Start ist mit dem verfügbaren Vorlauf und der Gebietsprüfung abzustimmen." },
      { question: "Kann ein Verein auch unverbindlich anfragen?", answer: "Ja. Der Anfrageweg ist öffentlich und eignet sich besonders, wenn Termin, Gebiet oder Menge noch abgestimmt werden müssen." },
    ],
  },
  {
    slug: "neueroeffnungen",
    path: "/branchen/neueroeffnungen",
    label: "Neueröffnungen",
    iconKey: "opening",
    title: "Flyerverteilung für Neueröffnungen mit starkem Start in der Umgebung.",
    description: "Flyerverteilung für Neueröffnungen: Geschäft, Restaurant, Studio oder Praxis im passenden lokalen Gebiet bekannt machen und den Start dokumentieren.",
    keywords: ["Flyerverteilung Neueröffnung", "Neueröffnung Flyer verteilen", "Eröffnungswerbung lokal"],
    heroLead: "Ein neuer Standort braucht Aufmerksamkeit vor Ort. Planen Sie Ihre Eröffnungsaktion mit Gebiet, Menge und genügend Vorlauf.",
    intro: "Ob Laden, Praxis, Studio oder Gastronomie: Eine Neueröffnung ist ein konkreter Anlass mit einem klaren regionalen Ziel. FLYERO hilft, die Aktion online vorzubereiten und später nachvollziehbar abzuschließen.",
    campaignExamples: ["Eröffnung von Geschäft oder Filiale", "Praxis-, Studio- oder Restaurantstart", "Eröffnungstag mit Gutschein oder Einladung"],
    planningNote: "Wählen Sie das Umfeld Ihres neuen Standorts und planen Sie den Starttermin mit ausreichendem Vorlauf. Bei Bedarf können Sie zunächst ein Angebot anfragen.",
    proofNote: "Nach der Durchführung stehen freigegebene Nachweise und der PDF-Bericht im Kundenkonto bereit, sobald FLYERO die Unterlagen geprüft hat.",
    faq: [
      { question: "Wie viel Vorlauf braucht eine Neueröffnung?", answer: "Das hängt von Gebiet, Flyeranlieferung und gewünschtem Zeitraum ab. Der Buchungsprozess zeigt den frühestmöglichen Termin; bei engem Termin ist eine Anfrage sinnvoll." },
      { question: "Kann ich die Kampagne erst anfragen und später buchen?", answer: "Ja. Sie können unverbindlich starten und die verbindliche Buchung nach der Rückmeldung von FLYERO vornehmen." },
    ],
  },
];

export const industryPageBySlug = new Map(industryPages.map((page) => [page.slug, page]));

export const industrySeoRoutes = industryPages.map((page) => ({
  path: page.path,
  priority: 0.72,
  changeFrequency: "monthly" as const,
}));
