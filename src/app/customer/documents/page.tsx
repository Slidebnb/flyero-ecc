import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createDocument, createPrintOrder, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, listDocuments, listPrintOrders, PRINT_STATUS_LABELS } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

async function uploadDocument(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createDocument(session, {
    orderId: String(formData.get("orderId") || ""),
    documentType: String(formData.get("documentType") || "OTHER"),
    title: String(formData.get("title") || ""),
    originalFilename: String(formData.get("originalFilename") || "upload.pdf"),
    mimeType: String(formData.get("mimeType") || "application/pdf"),
    content: String(formData.get("content") || "Demo upload"),
  });
  redirect("/customer/documents");
}

async function requestPrint(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  await createPrintOrder(session, {
    orderId: String(formData.get("orderId") || ""),
    printFormat: String(formData.get("printFormat") || "DIN_A5"),
    paperType: String(formData.get("paperType") || "Bilderdruck"),
    paperWeight: Number(formData.get("paperWeight") || 135),
    colorMode: String(formData.get("colorMode") || "4/4"),
    doubleSided: String(formData.get("doubleSided") || "true") === "true",
    folded: String(formData.get("folded") || "NONE"),
    finishing: String(formData.get("finishing") || "NONE"),
    quantity: Number(formData.get("quantity") || 1000),
    notes: String(formData.get("notes") || ""),
  });
  redirect("/customer/documents");
}

export default async function CustomerDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const params = await searchParams;
  const [documents, printOrders, orders, folders] = await Promise.all([
    listDocuments(session, params),
    listPrintOrders(session),
    prisma.order.findMany({ where: { customer: { userId: session.id } }, select: { id: true, orderNumber: true, targetAreaName: true }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.documentFolder.findMany({ where: { order: { customer: { userId: session.id } } }, include: { order: { select: { orderNumber: true } }, _count: { select: { documents: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <PortalShell
      eyebrow="Kundenportal"
      title="Dokumentencenter"
      description="Druckdateien, Versionen, Berichte, Rechnungen und Druckstatus an einem Ort."
      navItems={[
        { href: "/customer/dashboard", label: "Dashboard" },
        { href: "/customer/orders", label: "Aufträge" },
        { href: "/customer/reports", label: "Berichte" },
        { href: "/customer/support", label: "Support" },
      ]}
    >
      <section className="portalMetrics">
        <MetricTile label="Dokumente" value={documents.length} />
        <MetricTile label="In Prüfung" value={documents.filter((item) => item.status === "UNDER_REVIEW").length} tone="warning" />
        <MetricTile label="Freigegeben" value={documents.filter((item) => item.status === "APPROVED").length} tone="success" />
        <MetricTile label="Druckaufträge" value={printOrders.length} />
      </section>

      <DataSection title="Suche und Filter" description="Dokumente nach Auftrag, Ordner, Typ, Status oder Suchbegriff eingrenzen.">
        <form className="form grid">
          <label>Suche<input name="q" defaultValue={params.q ?? ""} placeholder="Titel, Datei oder Auftragsnummer" /></label>
          <label>Auftrag<select name="orderId" defaultValue={params.orderId ?? ""}><option value="">Alle Aufträge</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} - {order.targetAreaName}</option>)}</select></label>
          <label>Ordner<select name="folderId" defaultValue={params.folderId ?? ""}><option value="">Alle Ordner</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} / {folder.order.orderNumber}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Alle Status</option>{Object.entries(DOCUMENT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          <label>Typ<select name="documentType" defaultValue={params.documentType ?? ""}><option value="">Alle Typen</option>{Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <DataSection title="Ordner">
        {folders.length ? (
          <div className="portalActions">
            {folders.map((folder) => (
              <a key={folder.id} href={`/customer/documents?folderId=${folder.id}`}>
                {folder.name} · {folder.order.orderNumber} · {folder._count.documents}
              </a>
            ))}
          </div>
        ) : (
          <EmptyState title="Noch keine Ordner." description="Auftragsbezogene Ordner werden automatisch im Dokumentenmodell vorbereitet." />
        )}
      </DataSection>

      <div className="portalDashboardGrid">
        <ActionPanel title="Dokument hochladen" description="MVP-Upload ist storage-abstrahiert; echte Dateien können später auf S3/R2/Azure gelegt werden.">
          <form action={uploadDocument} className="form">
            <label>Auftrag<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} - {order.targetAreaName}</option>)}</select></label>
            <label>Titel<input name="title" required placeholder="Flyer Vorderseite" /></label>
            <label>Dateiname<input name="originalFilename" required defaultValue="flyer.pdf" /></label>
            <label>Typ<select name="documentType" defaultValue="PRINT_FILE">{Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
            <label>Inhalt/Notiz<textarea name="content" rows={3} defaultValue="Upload-Datei wird im Storage-Service gespeichert." /></label>
            <button type="submit">Hochladen</button>
          </form>
        </ActionPanel>

        <ActionPanel title="Druck beauftragen" description="Die Druckherstellungspreise werden später mit euren echten FLYERO-Konditionen gepflegt, nicht geraten.">
          <form action={requestPrint} className="form">
            <label>Auftrag<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} - {order.targetAreaName}</option>)}</select></label>
            <label>Format<select name="printFormat" defaultValue="DIN_A5"><option value="DIN_A4">DIN A4</option><option value="DIN_A5">DIN A5</option><option value="DIN_LANG">DIN Lang</option><option value="SQUARE">Quadratisch</option><option value="CUSTOM">Individuell</option></select></label>
            <label>Papier<select name="paperWeight" defaultValue="135">{[90, 115, 135, 170, 250, 300].map((weight) => <option key={weight} value={weight}>{weight}g</option>)}</select></label>
            <label>Farbe<select name="colorMode" defaultValue="4/4"><option>4/4</option><option>4/0</option><option>1/1</option></select></label>
            <label>Veredelung<select name="finishing" defaultValue="NONE"><option value="NONE">Keine</option><option value="VARNISH">Lack</option><option value="MATTE">Matt</option><option value="GLOSS">Glanz</option></select></label>
            <label>Falzung<select name="folded" defaultValue="NONE"><option value="NONE">Keine</option><option value="HALF_FOLD">Einbruchfalz</option><option value="ROLL_FOLD">Wickelfalz</option><option value="Z_FOLD">Zickzack</option></select></label>
            <label>Menge<input name="quantity" type="number" min="1" defaultValue="5000" /></label>
            <input type="hidden" name="paperType" value="Bilderdruck" />
            <button type="submit">Druck anfragen</button>
          </form>
        </ActionPanel>
      </div>

      <DataSection title="Alle Dokumente">
        <div className="tableWrap"><table><thead><tr><th>Titel</th><th>Auftrag</th><th>Typ</th><th>Status</th><th>Version</th><th></th></tr></thead><tbody>
          {documents.map((document) => <tr key={document.id}><td>{document.title}<br /><small>{document.originalFilename}</small></td><td>{document.order.orderNumber}</td><td>{DOCUMENT_TYPE_LABELS[document.documentType]}</td><td><StatusBadge>{DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td><td>v{document.version}</td><td><a className="textLink" href={`/api/customer/documents/${document.id}/download`}>Download</a></td></tr>)}
          {documents.length === 0 ? <tr><td colSpan={6}><EmptyState title="Noch keine Dokumente." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>

      <DataSection title="Druckstatus">
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Status</th><th>Format</th><th>Menge</th><th>Tracking</th></tr></thead><tbody>
          {printOrders.map((printOrder) => <tr key={printOrder.id}><td>{printOrder.order.orderNumber}</td><td><StatusBadge>{PRINT_STATUS_LABELS[printOrder.status]}</StatusBadge></td><td>{printOrder.printFormat}</td><td>{printOrder.quantity}</td><td>{printOrder.trackingNumber ?? "-"}</td></tr>)}
          {printOrders.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Druckaufträge." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
