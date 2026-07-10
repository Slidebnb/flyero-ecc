import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_DOCUMENT_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { DOCUMENT_TYPE_LABELS, listDocuments } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerOrderDocumentsPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, customer: { userId: session.id } }, select: { id: true, orderNumber: true, targetAreaName: true } });
  if (!order) notFound();
  const documents = await listDocuments(session, { orderId: id });

  return (
    <CustomerPortalShell active="/customer/documents" title={`Dateien ${customerOrderName(order.orderNumber)}`} description={order.targetAreaName}>
      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/documents">Alle Dateien</Link>
        <Link className="secondaryButton" href={`/customer/orders/${id}`}>Kampagne</Link>
        <Link className="secondaryButton" href="/customer/orders">Kampagnen</Link>
      </div>

      <DataSection title="Dateien dieser Kampagne">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Datei</th><th>Typ</th><th>Status</th><th>Versionen</th><th></th></tr></thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.title}<br /><small>{document.originalFilename}</small></td>
                  <td>{DOCUMENT_TYPE_LABELS[document.documentType]}</td>
                  <td><StatusBadge>{CUSTOMER_DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td>
                  <td>{document.versions.length}</td>
                  <td><a className="textLink" href={`/api/customer/documents/${document.id}/download`}>Download</a></td>
                </tr>
              ))}
              {documents.length === 0 ? <tr><td colSpan={5}><EmptyState title="Keine Dateien für diese Kampagne." action={{ href: "/customer/documents", label: "Flyerdatei hochladen" }} /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
