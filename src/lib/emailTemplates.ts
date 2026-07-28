import { buildCustomerEmail } from "./customerEmailTemplate.ts";

export function buildEvidenceAvailableEmail(input: {
  customerName: string;
  companyName: string;
  orderNumber: string;
  areaLabel: string;
  evidenceLabel: string;
  evidenceUrl: string;
}) {
  return buildCustomerEmail({
    subject: "Ihr FLYERO-Nachweis ist verf\u00fcgbar",
    eyebrow: "NACHWEIS VERF\u00dcGBAR",
    title: "Ihr Nachweis ist verf\u00fcgbar",
    customerName: input.customerName,
    intro: `${input.evidenceLabel} zu Ihrer Verteilung wurde von FLYERO gepr\u00fcft und im Kundenportal f\u00fcr Sie freigegeben.`,
    details: [
      { label: "Verteilgebiet", value: input.areaLabel },
      { label: input.companyName, value: `Auftrag ${input.orderNumber}` },
    ],
    action: { label: "Nachweis im Kundenportal \u00f6ffnen", url: input.evidenceUrl },
    note: "Im Kundenportal k\u00f6nnen Sie den Nachweis ansehen und herunterladen.",
  });
}

export function buildReportPublishedEmail(input: {
  customerName: string;
  companyName: string;
  reportNumber: string;
  orderNumber: string;
  areaLabel: string;
  reportUrl: string;
}) {
  return buildCustomerEmail({
    subject: "Ihr FLYERO-Verteilbericht ist verf\u00fcgbar",
    eyebrow: "VERTEILBERICHT VERF\u00dcGBAR",
    title: "Ihr Verteilbericht ist verf\u00fcgbar",
    customerName: input.customerName,
    intro: "Die Nachweise zu Ihrer Verteilung wurden von FLYERO gepr\u00fcft und f\u00fcr Sie im Kundenportal freigegeben.",
    details: [
      { label: "Verteilgebiet", value: input.areaLabel },
      { label: input.companyName, value: `Bericht ${input.reportNumber} \u00b7 Auftrag ${input.orderNumber}` },
    ],
    action: { label: "Bericht im Kundenportal \u00f6ffnen", url: input.reportUrl },
    note: "Dort k\u00f6nnen Sie den PDF-Bericht und die freigegebenen Nachweise ansehen und herunterladen.",
  });
}

export function buildInvoiceAvailableEmail(input: {
  customerName: string;
  companyName: string;
  invoiceNumber: string;
  orderNumber: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  invoiceUrl: string;
}) {
  return buildCustomerEmail({
    subject: "Ihre FLYERO-Rechnung ist verf\u00fcgbar",
    eyebrow: "RECHNUNG VERF\u00dcGBAR",
    title: "Ihre Rechnung ist verf\u00fcgbar",
    customerName: input.customerName,
    intro: "Die Rechnung zu Ihrer FLYERO-Verteilung wurde erstellt und steht jetzt in Ihrem Kundenportal zum \u00d6ffnen und Herunterladen bereit.",
    details: [
      { label: "Rechnung", value: input.invoiceNumber },
      { label: input.companyName, value: `Auftrag ${input.orderNumber}` },
      { label: "Gesamtbetrag", value: input.grossAmount },
      { label: "Aufschl\u00fcsselung", value: `Netto ${input.netAmount} \u00b7 MwSt. ${input.vatAmount}` },
    ],
    action: { label: "Rechnung im Kundenportal \u00f6ffnen", url: input.invoiceUrl },
    note: "Bei Fragen helfen wir Ihnen gerne unter hallo@flyero.org weiter.",
  });
}
