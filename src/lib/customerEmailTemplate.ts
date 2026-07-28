export type CustomerEmailDetail = {
  label: string;
  value: string;
};

export type CustomerEmailInput = {
  subject: string;
  eyebrow: string;
  title: string;
  customerName?: string | null;
  intro: string;
  content?: string | null;
  details?: CustomerEmailDetail[];
  action?: { label: string; url: string };
  note?: string | null;
};

export type CustomerNotificationEmailInput = {
  type: string;
  subject: string;
  body: string;
  data?: Record<string, unknown>;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\//.test(url)) return url;
  return null;
}

function paragraphs(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function actionForType(type: string) {
  if (type.includes("PAYMENT_FAILED")) return "Zahlung im Kundenportal erneut versuchen";
  if (type.includes("PAYMENT") || type.includes("ORDER_ACCEPTED")) return "Kampagne im Kundenportal \u00f6ffnen";
  if (type.includes("INVOICE")) return "Rechnung im Kundenportal \u00f6ffnen";
  if (type.includes("REPORT") || type.includes("DOCUMENT")) return "Nachweis im Kundenportal \u00f6ffnen";
  return "Kundenportal \u00f6ffnen";
}

export function buildCustomerEmail(input: CustomerEmailInput) {
  const greeting = input.customerName ? `Hallo ${input.customerName},` : "Hallo,";
  const contentParagraphs = [input.intro, ...paragraphs(input.content)];
  const detailLines = (input.details ?? []).flatMap((detail) => [detail.label, detail.value]);
  const actionUrl = input.action ? safeUrl(input.action.url) : null;
  const note = input.note?.trim() || null;
  const text = [
    greeting,
    "",
    ...contentParagraphs,
    ...(detailLines.length > 0 ? ["", ...detailLines] : []),
    ...(actionUrl && input.action ? ["", `${input.action.label}:`, actionUrl] : []),
    ...(note ? ["", note] : []),
    "",
    "Viele Gr\u00fc\u00dfe",
    "Ihr FLYERO-Team",
    "hallo@flyero.org",
  ].join("\n");
  const htmlContent = contentParagraphs
    .map((paragraph) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#4b5a4d;">${escapeHtml(paragraph)}</p>`)
    .join("");
  const htmlDetails = input.details?.length
    ? `<div style="margin:24px 0;padding:18px 20px;background:#f3f8ef;border-radius:14px;">${input.details.map((detail) => `<div style="margin:0 0 13px;color:#617064;font-size:12px;line-height:1.35;">${escapeHtml(detail.label)}<strong style="display:block;margin-top:4px;color:#172019;font-size:16px;line-height:1.45;white-space:pre-line;">${escapeHtml(detail.value)}</strong></div>`).join("")}</div>`
    : "";
  const htmlAction = actionUrl && input.action
    ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:15px 22px;background:#b7ff21;color:#101713;border-radius:10px;font-size:16px;font-weight:800;text-decoration:none;">${escapeHtml(input.action.label)}</a>`
    : "";
  const htmlNote = note
    ? `<p style="margin:24px 0 0;padding:16px 18px;background:#f7faf6;border:1px solid #e1e7df;border-radius:12px;font-size:14px;line-height:1.6;color:#647166;">${escapeHtml(note)}</p>`
    : "";

  return {
    subject: input.subject,
    text,
    html: `<!doctype html>
<html lang="de">
  <body style="margin:0;background:#f2f5f0;color:#172019;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dce5d9;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 32px;background:#101713;color:#ffffff;">
          <div style="font-size:24px;font-weight:800;letter-spacing:.04em;">FLYERO</div>
          <div style="margin-top:8px;color:#b7ff21;font-size:13px;font-weight:700;letter-spacing:.04em;">${escapeHtml(input.eyebrow)}</div>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;color:#172019;">${escapeHtml(greeting)}</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;color:#101713;">${escapeHtml(input.title)}</h1>
          ${htmlContent}
          ${htmlDetails}
          ${htmlAction}
          ${htmlNote}
        </div>
        <div style="padding:20px 32px;background:#f7faf6;border-top:1px solid #e3ebe1;color:#647166;font-size:13px;line-height:1.6;">Viele Gr\u00fc\u00dfe<br /><strong style="color:#172019;">Ihr FLYERO-Team</strong><br /><a href="mailto:hallo@flyero.org" style="color:#4b6b45;">hallo@flyero.org</a></div>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function buildCustomerNotificationEmail(input: CustomerNotificationEmailInput) {
  const data = input.data ?? {};
  const actionValue = [data.campaignUrl, data.dashboardUrl, data.invoiceUrl, data.paymentUrl, data.reportUrl, data.trackingUrl]
    .map(safeUrl)
    .find(Boolean) ?? null;
  const customerName = typeof data.customerName === "string" ? data.customerName : null;
  const bodyLines = paragraphs(input.body)
    .map((line) => line.replace(/https?:\/\/\S+/gi, "").replace(/\s*:\s*$/, "").trim())
    .filter(Boolean);
  const intro = bodyLines.shift() ?? "Es gibt eine neue Information zu Ihrer FLYERO-Kampagne.";
  return buildCustomerEmail({
    subject: input.subject,
    eyebrow: input.type.includes("REPORT") || input.type.includes("DOCUMENT") ? "NACHWEIS AKTUALISIERT" : "FLYERO KAMPAGNEN-UPDATE",
    title: input.subject,
    customerName,
    intro,
    content: bodyLines.join("\n"),
    action: actionValue ? { label: actionForType(input.type), url: actionValue } : undefined,
    note: typeof data.nextStep === "string" ? data.nextStep : null,
  });
}
