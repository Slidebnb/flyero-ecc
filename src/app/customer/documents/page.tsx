import Link from "next/link";
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
    content: String(formData.get("content") || "Flyerdatei wurde für die Prüfung vorgemerkt."),
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
  const underReview = documents.filter((item) => item.status === "UNDER_REVIEW").length;
  const approved = documents.filter((item) => item.status === "APPROVED").length;

  return (
    <CustomerPortalShell
      active="/customer/documents"
      title="Dateien & Druck"
      description="Flyerdateien hochladen, Druck anfragen und Freigaben schnell finden."
    >
      <section className="portalMetrics">
        <MetricTile label="Dateien" value={documents.length} />
        <MetricTile label="In Prüfung" value={underReview} tone={underReview ? "warning" : "neutral"} />
        <MetricTile label="Freigegeben" value={approved} tone={approved ? "success" : "neutral"} />
        <MetricTile label="Druckaufträge" value={printOrders.length} />
      </section>

      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Nächster sinnvoller Schritt</span>
          <h2>{hasOrders ? "Flyerdatei hochladen" : "Erst eine Kampagne starten"}</h2>
          <p>{hasOrders ? "Ordnen Sie die Datei der passenden Kampagne zu. FLYERO prüft die Druckdaten danach." : "Dateien und Druck gehören immer zu einer Kampagne."}</p>
        </div>
        {hasOrders ? (
          <a className="primaryButton" href="#flyer-upload">Datei hochladen</a>
        ) : (
          <Link className="primaryButton" href="/customer/orders/new">Kampagne starten</Link>
        )}
      </section>

      <div className="customerActionRow">
        <a className="secondaryButton" href="#documents-list">Freigaben ansehen</a>
        <a className="secondaryButton" href="#print-request">Druck anfragen</a>
        <Link className="secondaryButton" href="/customer/orders">Kampagnen öffnen</Link>
      </div>

      <div className="customerTwoColumn">
        <ActionPanel title="Flyerdatei hochladen" description="Kurze Angaben reichen. Die echte Prüfung übernimmt FLYERO." id="flyer-upload">
          {hasOrders ? (
            <form action={uploadDocument} className="form customerSimpleForm">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Titel<input name="title" required placeholder="Flyer Vorderseite" /></label>
              <label>Dateiname<input name="originalFilename" required defaultValue="flyer.pdf" /></label>
              <input type="hidden" name="documentType" value="PRINT_FILE" />
              <input type="hidden" name="mimeType" value="application/pdf" />
              <button type="submit">Hochladen</button>
            </form>
          ) : (
            <EmptyState title="Noch keine Kampagne." description="Starten Sie zuerst eine Verteilung, dann können Dateien zugeordnet werden." action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }} />
          )}
        </ActionPanel>

        <ActionPanel title="Druck über FLYERO" description="Wenn FLYERO den Druck mitplanen soll, senden Sie eine kurze Anfrage.">
          {hasOrders ? (
            <form action={requestPrint} className="form customerSimpleForm" id="print-request">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label>Format<select name="printFormat" defaultValue="DIN_A5"><option value="DIN_A4">DIN A4</option><option value="DIN_A5">DIN A5</option><option value="DIN_LANG">DIN Lang</option><option value="SQUARE">Quadratisch</option><option value="CUSTOM">Individuell</option></select></label>
              <label>Menge<input name="quantity" type="number" min="1" defaultValue="5000" /></label>
              <label>Hinweis<textarea name="notes" rows={3} placeholder="Format, Wunschpapier oder Rückfrage" /></label>
              <button type="submit">Druck anfragen</button>
            </form>
          ) : (
            <EmptyState title="Druck braucht eine Kampagne." description="So wissen wir, für welches Gebiet und welche Menge geplant wird." action={{ href: "/customer/orders/new", label: "Kampagne starten" }} />
          )}
        </ActionPanel>
      </div>

      <DataSection title="Freigaben & Dateien" description="Alles Wichtige als kurze Liste, ohne Tabellen-Suche." id="documents-list">
        <div className="customerActionRow">
          <form className="form customerSimpleForm">
            <label>Suche<input name="q" defaultValue={params.q ?? ""} placeholder="Titel, Datei oder Kampagne" /></label>
            <label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Alle Status</option>{Object.entries(CUSTOMER_DOCUMENT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
            <button type="submit">Filtern</button>
          </form>
        </div>
        <div className="customerMessageList">
          {documents.map((document) => (
            <article className="customerMessageItem" key={document.id}>
              <div className="customerItemHeader">
                <strong>{document.title}</strong>
                <StatusBadge>{CUSTOMER_DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge>
              </div>
              <div className="customerItemMeta">
                <span>{customerOrderName(document.order.orderNumber)}</span>
                <span>{DOCUMENT_TYPE_LABELS[document.documentType]}</span>
                <span>{document.originalFilename}</span>
              </div>
              <a className="secondaryButton" href={`/api/customer/documents/${document.id}/download`}>Download</a>
            </article>
          ))}
          {documents.length === 0 ? <EmptyState title="Noch keine Dateien." description="Sobald Dateien hochgeladen wurden, erscheinen sie hier." /> : null}
        </div>
      </DataSection>

      <DataSection title="Druckstatus" description="Nur laufende oder angefragte Druckaufträge.">
        <div className="customerMessageList">
          {printOrders.map((printOrder) => (
            <article className="customerMessageItem" key={printOrder.id}>
              <div className="customerItemHeader">
                <strong>{customerOrderName(printOrder.order.orderNumber)}</strong>
                <StatusBadge>{CUSTOMER_PRINT_STATUS_LABELS[printOrder.status]}</StatusBadge>
              </div>
              <div className="customerItemMeta">
                <span>{printOrder.printFormat}</span>
                <span>{printOrder.quantity.toLocaleString("de-DE")} Stück</span>
              </div>
            </article>
          ))}
          {printOrders.length === 0 ? <EmptyState title="Noch keine Druckaufträge." description="Wenn FLYERO den Druck übernimmt, sehen Sie hier den Stand." /> : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
