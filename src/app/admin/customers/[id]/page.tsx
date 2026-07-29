import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { DocumentType, UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { createApprovedCustomerDocument, DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getOrderGrossPrice } from "@/lib/pricing";
import { productionCustomerWhere, productionDocumentWhere, productionInvoiceWhere, productionOrderWhere } from "@/lib/productionData";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string }>;
};

const CUSTOMER_UPLOAD_TYPES: DocumentType[] = ["REPORT", "IMAGE", "INVOICE"];

async function uploadApprovedDocument(customerId: string, formData: FormData) {
  "use server";
  const actor = await requireRole([UserRole.ADMIN]);
  const upload = formData.get("file");
  if (!upload || typeof upload === "string" || !("arrayBuffer" in upload)) {
    throw new Error("Bitte eine Datei auswaehlen.");
  }
  const file = upload as File;
  if (file.size <= 0) throw new Error("Die Datei ist leer.");

  const documentType = String(formData.get("documentType") || "REPORT");
  const title = String(formData.get("title") || "").trim() || (documentType === "INVOICE" ? "Rechnung" : "Nachweis");
  const orderId = String(formData.get("orderId") || "");

  await createApprovedCustomerDocument(
    actor,
    {
      customerId,
      orderId,
      documentType,
      title,
      originalFilename: file.name,
      mimeType: file.type || undefined,
    },
    {
      originalFilename: file.name,
      mimeType: file.type || undefined,
      buffer: Buffer.from(await file.arrayBuffer()),
    },
  );

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/customer/reports");
  revalidatePath("/customer/invoices");
  redirect(`/admin/customers/${customerId}?uploaded=1`);
}

export default async function AdminCustomerDetailPage({ params, searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;
  const search = await searchParams;

  const customer = await prisma.customerProfile.findFirst({
    where: { id, ...productionCustomerWhere() },
    include: {
      user: { select: { email: true, status: true, emailVerified: true, createdAt: true, updatedAt: true } },
      orders: {
        where: productionOrderWhere(),
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        },
      },
      invoices: {
        where: productionInvoiceWhere(),
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { order: { select: { id: true, orderNumber: true, targetAreaName: true } } },
      },
      documents: {
        where: productionDocumentWhere(),
        orderBy: { uploadedAt: "desc" },
        take: 50,
        include: { order: { select: { id: true, orderNumber: true, targetAreaName: true } } },
      },
    },
  });

  if (!customer) notFound();
  const latestOrder = customer.orders[0] ?? null;

  return (
    <AdminPortalShell
      title={customer.companyName}
      description={`${customer.user.email} - Kundenprofil, Aufträge und freigegebene Unterlagen.`}
    >
      {search.uploaded === "1" ? (
        <DataSection title="Upload gespeichert" description="Die Unterlage wurde freigegeben und ist im Kundenkonto sichtbar.">
          <StatusBadge tone="success">Bereitgestellt</StatusBadge>
        </DataSection>
      ) : null}

      <section className="portalMetrics">
        <div className="metricTile">
          <span>Kundenstatus</span>
          <strong>{customer.user.emailVerified ? "Bestätigt" : "E-Mail offen"}</strong>
        </div>
        <div className="metricTile">
          <span>Aufträge</span>
          <strong>{customer.orders.length}</strong>
        </div>
        <div className="metricTile">
          <span>Rechnungen</span>
          <strong>{customer.invoices.length}</strong>
        </div>
        <div className="metricTile">
          <span>Nachweise und Dateien</span>
          <strong>{customer.documents.length}</strong>
        </div>
      </section>

      <div className="portalDashboardGrid">
        <DataSection title="Kundendaten" description="Kontakt und Profilinformationen aus der Registrierung.">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p><strong>Kontakt:</strong> {customer.contactName || "Nicht angegeben"}</p>
            <p><strong>E-Mail:</strong> {customer.user.email}</p>
            <p><strong>Telefon:</strong> {customer.phone || "Nicht angegeben"}</p>
            <p><strong>Registriert:</strong> {formatDate(customer.user.createdAt)}</p>
          </div>
        </DataSection>

        <DataSection title="Unterlage für Kundenkonto hochladen" description="Die Datei wird nach erfolgreicher Dateiprüfung direkt freigegeben und dem Kunden angezeigt.">
          {customer.orders.length > 0 ? (
            <form className="form" action={uploadApprovedDocument.bind(null, customer.id)} method="post" encType="multipart/form-data">
              <label>
                Auftrag
                <select name="orderId" defaultValue={latestOrder?.id}>
                  {customer.orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.targetAreaName || order.city || "Gebiet"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Art der Unterlage
                <select name="documentType" defaultValue="REPORT">
                  {CUSTOMER_UPLOAD_TYPES.map((type) => (
                    <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
              <label>
                Titel im Kundenkonto
                <input name="title" placeholder="z. B. Abschlussbericht oder Rechnung" />
              </label>
              <label>
                Datei
                <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.docx,.xlsx,.gpx,.kml,.kmz" required />
              </label>
              <button type="submit">Freigegeben speichern</button>
            </form>
          ) : (
            <EmptyState title="Noch kein Auftrag vorhanden." description="Unterlagen werden immer einem Auftrag zugeordnet, damit sie im Kundenkonto eindeutig erscheinen." />
          )}
        </DataSection>
      </div>

      <DataSection title="Aufträge" description="Letzte Aufträge dieses Kunden.">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Gebiet</th>
                <th>Status</th>
                <th>Preis</th>
                <th>Datum</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.targetAreaName || order.city || "Gebiet"}</td>
                  <td><StatusBadge>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></td>
                  <td>{formatCurrency(getOrderGrossPrice(order))}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td><Link className="textLink" href={`/admin/orders/${order.id}`}>Auftrag oeffnen</Link></td>
                </tr>
              ))}
              {customer.orders.length === 0 ? (
                <tr>
                  <td colSpan={6}><EmptyState title="Noch keine Aufträge." /></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Freigegebene Unterlagen" description="Diese Dateien sind direkt im Kundenkonto sichtbar, sofern die Sichtbarkeit aktiviert ist.">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Art</th>
                <th>Auftrag</th>
                <th>Status</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {customer.documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.title}</td>
                  <td>{DOCUMENT_TYPE_LABELS[document.documentType]}</td>
                  <td>{document.order?.orderNumber || "-"}</td>
                  <td>
                    <StatusBadge tone={document.customerVisible && document.status === "APPROVED" ? "success" : "warning"}>
                      {document.customerVisible && document.status === "APPROVED" ? "Im Kundenkonto" : document.status}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(document.uploadedAt)}</td>
                </tr>
              ))}
              {customer.documents.length === 0 ? (
                <tr>
                  <td colSpan={5}><EmptyState title="Noch keine Unterlagen." /></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
