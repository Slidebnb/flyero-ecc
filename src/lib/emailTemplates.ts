function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function buildEvidenceAvailableEmail(input: {
  customerName: string;
  companyName: string;
  orderNumber: string;
  areaLabel: string;
  evidenceLabel: string;
  evidenceUrl: string;
}) {
  const customerName = escapeHtml(input.customerName);
  const companyName = escapeHtml(input.companyName);
  const orderNumber = escapeHtml(input.orderNumber);
  const areaLabel = escapeHtml(input.areaLabel);
  const evidenceLabel = escapeHtml(input.evidenceLabel);
  const evidenceUrl = escapeHtml(input.evidenceUrl);
  const greeting = input.customerName ? `Hallo ${customerName},` : "Hallo,";

  return {
    subject: "Ihr FLYERO-Nachweis ist verfügbar",
    text: [
      input.customerName ? `Hallo ${input.customerName},` : "Hallo,",
      "",
      `${input.evidenceLabel} zu Ihrer Verteilung ist jetzt im Kundenportal verfügbar.`,
      `Verteilgebiet: ${input.areaLabel}`,
      `Kampagne: ${input.orderNumber}`,
      "",
      "Nachweis im Kundenportal öffnen:",
      input.evidenceUrl,
      "",
      "Viele Grüße",
      "Ihr FLYERO-Team",
    ].join("\n"),
    html: `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f2f5f0;color:#172019;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce5d9;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 32px;background:#101713;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:.04em;">FLYERO</div>
          <div style="margin-top:8px;color:#b7ff21;font-size:13px;font-weight:700;">NACHWEIS VERFÜGBAR</div>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;">${greeting}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#101713;">Ihr Nachweis ist verfügbar</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5a4d;">${evidenceLabel} zu Ihrer Verteilung wurde von FLYERO geprüft und im Kundenportal für Sie freigegeben.</p>
          <div style="margin:0 0 24px;padding:18px 20px;background:#f3f8ef;border-radius:12px;">
            <div style="font-size:13px;color:#647166;">Verteilgebiet</div>
            <div style="margin-top:4px;font-size:18px;font-weight:700;">${areaLabel}</div>
            <div style="margin-top:10px;font-size:13px;color:#647166;">${companyName} &middot; ${orderNumber}</div>
          </div>
          <a href="${evidenceUrl}" style="display:inline-block;padding:14px 22px;background:#b7ff21;color:#101713;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">Nachweis im Kundenportal öffnen</a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#647166;">Im Kundenportal können Sie den Nachweis ansehen und herunterladen.</p>
        </div>
        <div style="padding:20px 32px;background:#f7faf6;border-top:1px solid #e3ebe1;color:#647166;font-size:13px;line-height:1.5;">Viele Grüße<br /><strong style="color:#172019;">Ihr FLYERO-Team</strong></div>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function buildReportPublishedEmail(input: {
  customerName: string;
  companyName: string;
  reportNumber: string;
  orderNumber: string;
  areaLabel: string;
  reportUrl: string;
}) {
  const customerName = escapeHtml(input.customerName);
  const companyName = escapeHtml(input.companyName);
  const reportNumber = escapeHtml(input.reportNumber);
  const orderNumber = escapeHtml(input.orderNumber);
  const areaLabel = escapeHtml(input.areaLabel);
  const reportUrl = escapeHtml(input.reportUrl);
  const greeting = input.customerName ? `Hallo ${customerName},` : "Hallo,";

  return {
    subject: "Ihr FLYERO-Verteilbericht ist verfügbar",
    text: [
      input.customerName ? `Hallo ${input.customerName},` : "Hallo,",
      "",
      `der Verteilbericht für ${input.areaLabel} wurde von FLYERO geprüft und freigegeben.`,
      `Bericht: ${input.reportNumber}`,
      `Kampagne: ${input.orderNumber}`,
      "",
      "Den PDF-Bericht und die freigegebenen Nachweise finden Sie jetzt in Ihrem Kundenportal:",
      input.reportUrl,
      "",
      "Viele Grüße",
      "Ihr FLYERO-Team",
    ].join("\n"),
    html: `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f2f5f0;color:#172019;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce5d9;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 32px;background:#101713;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:.04em;">FLYERO</div>
          <div style="margin-top:8px;color:#b7ff21;font-size:13px;font-weight:700;">VERTEILBERICHT FREIGEGEBEN</div>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;">${greeting}</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#101713;">Ihr Verteilbericht ist verfügbar</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5a4d;">Die Nachweise zu Ihrer Verteilung wurden von FLYERO geprüft und für Sie im Kundenportal freigegeben.</p>
          <div style="margin:0 0 24px;padding:18px 20px;background:#f3f8ef;border-radius:12px;">
            <div style="font-size:13px;color:#647166;">Verteilgebiet</div>
            <div style="margin-top:4px;font-size:18px;font-weight:700;">${areaLabel}</div>
            <div style="margin-top:10px;font-size:13px;color:#647166;">${companyName} · ${reportNumber} · ${orderNumber}</div>
          </div>
          <a href="${reportUrl}" style="display:inline-block;padding:14px 22px;background:#b7ff21;color:#101713;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">Bericht im Kundenportal öffnen</a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#647166;">Dort können Sie den PDF-Bericht und die freigegebenen Nachweise ansehen und herunterladen.</p>
        </div>
        <div style="padding:20px 32px;background:#f7faf6;border-top:1px solid #e3ebe1;color:#647166;font-size:13px;line-height:1.5;">Viele Grüße<br /><strong style="color:#172019;">Ihr FLYERO-Team</strong></div>
      </div>
    </div>
  </body>
</html>`,
  };
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
  const customerName = escapeHtml(input.customerName);
  const companyName = escapeHtml(input.companyName);
  const invoiceNumber = escapeHtml(input.invoiceNumber);
  const orderNumber = escapeHtml(input.orderNumber);
  const netAmount = escapeHtml(input.netAmount);
  const vatAmount = escapeHtml(input.vatAmount);
  const grossAmount = escapeHtml(input.grossAmount);
  const invoiceUrl = escapeHtml(input.invoiceUrl);
  const greeting = input.customerName ? `Hallo ${customerName},` : "Hallo,";

  return {
    subject: "Ihre FLYERO-Rechnung ist verfügbar",
    text: [
      input.customerName ? `Hallo ${input.customerName},` : "Hallo,",
      "",
      `Ihre Rechnung ${input.invoiceNumber} für Auftrag ${input.orderNumber} ist jetzt im Kundenportal verfügbar.`,
      `Rechnungsbetrag: ${input.grossAmount}`,
      "",
      "Rechnung im Kundenportal öffnen:",
      input.invoiceUrl,
      "",
      "Viele Grüße",
      "Ihr FLYERO-Team",
    ].join("\n"),
    html: `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#eef3ed;color:#172019;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce5d9;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 32px;background:#101713;color:#ffffff;">
          <div style="font-size:25px;font-weight:800;letter-spacing:.06em;">FLYERO</div>
          <div style="margin-top:8px;color:#b7ff21;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Rechnung verfügbar</div>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;">${greeting}</p>
          <h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;color:#101713;">Ihre Rechnung ist verfügbar</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5a4d;">Die Rechnung zu Ihrer FLYERO-Verteilung wurde erstellt und steht jetzt in Ihrem Kundenportal zum Öffnen und Herunterladen bereit.</p>
          <div style="padding:19px 20px;background:#f3f8ef;border-radius:14px;">
            <div style="color:#617064;font-size:12px;">RECHNUNG</div>
            <div style="margin-top:5px;color:#172019;font-size:18px;font-weight:800;">${invoiceNumber}</div>
            <div style="margin-top:12px;color:#617064;font-size:13px;">${companyName} · Auftrag ${orderNumber}</div>
          </div>
          <div style="margin-top:24px;padding:18px 20px;border:1px solid #e1e7df;border-radius:14px;color:#4b5a4d;line-height:1.7;">
            Netto: <strong>${netAmount}</strong><br />
            MwSt.: <strong>${vatAmount}</strong><br />
            <span style="font-size:18px;color:#172019;">Gesamtbetrag: <strong>${grossAmount}</strong></span>
          </div>
          <a href="${invoiceUrl}" style="display:inline-block;margin-top:24px;padding:15px 22px;background:#b7ff21;color:#101713;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">Rechnung im Kundenportal öffnen</a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#647166;">Bei Fragen helfen wir Ihnen gerne unter hallo@flyero.org weiter.</p>
        </div>
        <div style="padding:20px 32px;background:#f7faf6;border-top:1px solid #e3ebe1;color:#647166;font-size:13px;line-height:1.5;">Viele Grüße<br /><strong style="color:#172019;">Ihr FLYERO-Team</strong></div>
      </div>
    </div>
  </body>
</html>`,
  };
}
