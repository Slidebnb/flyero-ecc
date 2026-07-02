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
      <label>Kunde<input name="customerName" defaultValue="Max Mustermann" /></label>
      <label>Firma<input name="companyName" defaultValue="Muster GmbH" /></label>
      <label>Auftrag<input name="orderNumber" defaultValue="ORD-2026-0001" /></label>
      <label>Dashboard<input name="dashboardUrl" defaultValue="http://localhost:3000/customer/dashboard" /></label>
      <button type="submit">Vorschau erzeugen</button>
    </form>
  );
}
