"use client";

import { useState } from "react";

type TemplateOption = {
  id: string;
  name: string;
};

export function TemplatePreviewForm({ templates }: { templates: TemplateOption[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  return (
    <form className="form" action={templateId ? `/api/admin/templates/${templateId}/preview` : "/api/admin/templates/missing/preview"} method="post">
      <label>Vorlage
        <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </label>
      <label>Kunde<input name="customerName" required placeholder="Echten Kundennamen eingeben" /></label>
      <label>Firma<input name="companyName" required placeholder="Echten Firmennamen eingeben" /></label>
      <label>Auftrag<input name="orderNumber" required placeholder="Auftragsnummer eingeben" /></label>
      <label>Dashboard<input name="dashboardUrl" required placeholder="/customer/dashboard" /></label>
      <button type="submit">Vorschau erzeugen</button>
    </form>
  );
}
