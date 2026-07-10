import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_DOCUMENT_STATUS_LABELS, CUSTOMER_PRINT_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
import { ActionPanel, DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createDocument, createPrintOrder, DOCUMENT_TYPE_LABELS, listDocuments, listPrintOrders } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

async function uploadDocument(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createDocument(session, {
    orderId: String(formData.get("orderId") || ""),
    documentType: String(formData.get("documentType") || "PRINT_FILE"),
    title: String(formData.get("title") || ""),
    originalFilename: String(formData.get("originalFilename") || "flyer.pdf"),
    mimeType: String(formData.get("mimeType") || "application/pdf"),
    content: String(formData.get("content") || "Flyerdatei wurde fuer die Pruefung vorgemerkt."),
  });
  redirect("/customer/documents");
}

async function requestPrint(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createPrintOrder(session, {
    orderId: String(formData.get("orderId") || ""),
    printFormat: String(formData.get("printFormat") || "DIN_A5"),
    paperType: "Bilderdruck",
    paperWeight: Number(formData.get("paperWeight") || 135),
    colorMode: "4/4",
    doubleSided: true,
    folded: "NONE",
    finishing: "NONE",
    quantity: Number(formData.get("quantity") || 5000),
    notes: String(formData.get("notes") || ""),
  });
  redirect("/customer/documents");
}

export default async function CustomerDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const params = await searchParams;
  const [documents, printOrders, orders] = await Promise.all([
    listDocuments(session, params),
    listPrintOrders(session),
    prisma.order.findMany({
      where: { customer: { userId: session.id } },
      select: { id: true, orderNumber: true, targetAreaName: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);
  const hasOrders = orders.length > 0;

  return (
    <CustomerPortalShell
      active="/customer/documents"
      title="Dateien"
      description="Flyerdatei hochladen, Druck anfragen und Freigaben ohne Umwege prüfen."
    >
      <section className="portalMetrics">
        <MetricTile label="Dateien" value={documents.length} />
        <MetricTile label="In Prüfung" value={documents.filter((item) => item.status === "UNDER_REVIEW").length} tone="warning" />
        <MetricTile label="Freigegeben" value={documents.filter((item) => item.status === "APPROVED").length} tone="success" />
        <MetricTile label="Druckaufträge" value={printOrders.length} />
      </section>

      <div className="customerActionRow">
        <a className="primaryButton" href="#flyer-upload">Flyerdatei hochladen</a>
        <a className="secondaryButton" href="#print-request">Druck anfragen</a>
        <a className="secondaryButton" href="#documents-list">Freigaben ansehen</a>
      </div>

      <div className="portalDashboardGrid">
        <ActionPanel title="Flyerdatei hochladen" description="Datei der richtigen Kampagne zuordnen. FLYERO prueft danach die Druckdaten." id="flyer-upload">
          {hasOrders ? (
            <form action={uploadDocument} className="form">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Titel<input name="title" required placeholder="Flyer Vorderseite" /></label>
              <label>Dateiname<input name="originalFilename" required defaultValue="flyer.pdf" /></label>
              <input type="hidden" name="documentType" value="PRINT_FILE" />
              <input type="hidden" name="mimeType" value="application/pdf" />
              <button type="submit">Hochladen</button>
            </form>
          ) : (
            <EmptyState title="Erst Kampagne starten" description="Druckdaten koennen hochgeladen werden, sobald eine Kampagne angelegt ist." action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }} />
          )}
        </ActionPanel>

        <ActionPanel title="Druck anfragen" description="Wenn FLYERO den Druck mitplanen soll, reicht eine kurze Anfrage.">
          {hasOrders ? (
            <form action={requestPrint} className="form">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Format<select name="printFormat" defaultValue="DIN_A5"><option value="DIN_A4">DIN A4</option><option value="DIN_A5">DIN A5</option><option value="DIN_LANG">DIN Lang</option><option value="SQUARE">Quadratisch</option><option value="CUSTOM">Individuell</option></select></label>
              <label>Papier<select name="paperWeight" defaultValue="135">{[90, 115, 135, 170, 250, 300].map((weight) => <option key={weight} value={weight}>{weight}g</option>)}</select></label>
              <label>Menge<input name="quantity" type="number" min="1" defaultValue="5000" /></label>
              <label>Hinweis<textarea name="notes" rows={3} placeholder="Format, Wunschpapier oder Rueckfrage" /></label>
              <button type="submit">Druck anfragen</button>
            </form>
          ) : (
            <EmptyState title="Erst Kampagne starten" description="Ein Druckauftrag braucht eine Kampagne." action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }} />
          )}
        </ActionPanel>
      </div>

      <DataSection title="Freigaben & Dateien" description="Alles, was FLYERO geprüft oder freigegeben hat." id="documents-list">
        <div className="customerActionRow">
          <form className="form grid">
            <label>Suche<input name="q" defaultValue={params.q ?? ""} placeholder="Titel, Datei oder Kampagne" /></label>
            <label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Alle Status</option>{Object.entries(CUSTOMER_DOCUMENT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
            <button type="submit">Filtern</button>
          </form>
        </div>
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Titel</th><th>Kampagne</th><th>Typ</th><th>Status</th><th>Aktion</th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td data-label="Titel"><strong>{document.title}</strong><br /><small>{document.originalFilename}</small></td>
                  <td data-label="Kampagne">{customerOrderName(document.order.orderNumber)}</td>
                  <td data-label="Typ">{DOCUMENT_TYPE_LABELS[document.documentType]}</td>
                  <td data-label="Status"><StatusBadge>{CUSTOMER_DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td>
                  <td data-label="Aktion"><a className="textLink" href={`/api/customer/documents/${document.id}/download`}>Download</a></td>
                </tr>
              ))}
              {documents.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Dateien." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Druckstatus">
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Kampagne</th><th>Status</th><th>Format</th><th>Menge</th></tr></thead>
            <tbody>
              {printOrders.map((printOrder) => (
                <tr key={printOrder.id}>
                  <td data-label="Kampagne">{customerOrderName(printOrder.order.orderNumber)}</td>
                  <td data-label="Status"><StatusBadge>{CUSTOMER_PRINT_STATUS_LABELS[printOrder.status]}</StatusBadge></td>
                  <td data-label="Format">{printOrder.printFormat}</td>
                  <td data-label="Menge">{printOrder.quantity.toLocaleString("de-DE")}</td>
                </tr>
              ))}
              {printOrders.length === 0 ? <tr><td colSpan={4}><EmptyState title="Noch keine Druckaufträge." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
