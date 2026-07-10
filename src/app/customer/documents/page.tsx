import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_DOCUMENT_STATUS_LABELS, CUSTOMER_PRINT_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createDocument, createPrintOrder, DOCUMENT_TYPE_LABELS, listDocuments, listPrintOrders } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

async function uploadDocument(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Flyerdatei auswählen.");
  }

  await createDocument(session, {
    orderId: String(formData.get("orderId") || ""),
    documentType: String(formData.get("documentType") || "PRINT_FILE"),
    title: String(formData.get("title") || file.name),
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
  }, {
    originalFilename: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer: Buffer.from(await file.arrayBuffer()),
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
  const openDocument = documents.find((item) => item.status === "REJECTED" || item.status === "UNDER_REVIEW");

  return (
    <CustomerPortalShell
      active="/customer/documents"
      title="Dateien & Druck"
      description="Flyerdateien senden, Druck anfragen und Freigaben schnell finden."
    >
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Nächster Schritt</span>
          <h2>{hasOrders ? (openDocument ? "Dateistatus prüfen oder neue Datei hochladen." : "Flyerdatei hochladen.") : "Erst eine Kampagne starten."}</h2>
          <p>{hasOrders ? "Eine Datei, eine Kampagne, danach prüft FLYERO die Druckdaten." : "Dateien und Druck gehören immer zu einer Kampagne."}</p>
        </div>
        {hasOrders ? (
          <a className="primaryButton" href="#flyer-upload">Datei hochladen</a>
        ) : (
          <Link className="primaryButton" href="/customer/orders/new">Kampagne starten</Link>
        )}
      </section>

      <DataSection title="Flyerdatei senden" description="Wählen Sie die Kampagne und laden Sie die Datei hoch. FLYERO prüft den Rest." id="flyer-upload">
          {hasOrders ? (
            <form action={uploadDocument} className="form customerSimpleForm">
              <label>Kampagne<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>)}</select></label>
              <label className="customerFilePicker">
                Datei
                <span>Datei auswählen</span>
                <small>PDF, Bild, ZIP, AI oder INDD</small>
                <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.ai,.indd" required />
              </label>
              <label>Titel optional<input name="title" placeholder="z. B. Flyer Frühjahr" /></label>
              <input type="hidden" name="documentType" value="PRINT_FILE" />
              <button type="submit">Datei senden</button>
            </form>
          ) : (
            <EmptyState title="Noch keine Kampagne." description="Starten Sie zuerst eine Verteilung, dann können Dateien zugeordnet werden." action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }} />
          )}
        </DataSection>

      <details className="customerSoftDetails">
        <summary>Druck über FLYERO anfragen</summary>
        <div>
          <p>Nur öffnen, wenn FLYERO den Druck zusätzlich organisieren soll.</p>
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
        </div>
      </details>

      <DataSection title="Freigaben & Dateien" description="Alles Wichtige als kurze Liste, ohne Tabellen-Suche." id="documents-list">
        <div className="customerCompactFilter">
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
