import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, listDocuments } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerOrderDocumentsPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, customer: { userId: session.id } }, select: { id: true, orderNumber: true, targetAreaName: true } });
  if (!order) notFound();
  const documents = await listDocuments(session, { orderId: id });

  return (
    <PortalShell eyebrow="Kundenportal" title={`Dokumente ${order.orderNumber}`} description={order.targetAreaName} navItems={[{ href: "/customer/documents", label: "Dokumentencenter" }, { href: `/customer/orders/${id}`, label: "Auftrag" }, { href: "/customer/orders", label: "Aufträge" }]}>
      <DataSection title="Chronologische Dokumente">
        <div className="tableWrap"><table><thead><tr><th>Dokument</th><th>Typ</th><th>Status</th><th>Versionen</th><th></th></tr></thead><tbody>
          {documents.map((document) => <tr key={document.id}><td>{document.title}<br /><small>{document.originalFilename}</small></td><td>{DOCUMENT_TYPE_LABELS[document.documentType]}</td><td><StatusBadge>{DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td><td>{document.versions.length}</td><td><a className="textLink" href={`/api/customer/documents/${document.id}/download`}>Download</a></td></tr>)}
          {documents.length === 0 ? <tr><td colSpan={5}><EmptyState title="Keine Dokumente für diesen Auftrag." action={{ href: "/customer/documents", label: "Dokument hochladen" }} /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
      <Link className="textLink" href="/customer/documents">Zum Dokumentencenter</Link>
    </PortalShell>
  );
}
