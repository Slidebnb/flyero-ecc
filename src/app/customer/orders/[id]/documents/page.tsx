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
    <CustomerPortalShell active="/customer/documents" title="Dateien" description={`${customerOrderName(order.orderNumber)} - ${order.targetAreaName}`}>
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Kampagnen-Dateien</span>
          <h2>{documents.length ? "Dateien und Freigaben" : "Noch keine Datei hinterlegt"}</h2>
          <p>{documents.length ? "Hier stehen nur die Dateien dieser Kampagne." : "Laden Sie die Flyerdatei zentral hoch und ordnen Sie sie dieser Kampagne zu."}</p>
        </div>
        <Link className="primaryButton" href="/customer/documents#flyer-upload">Flyerdatei hochladen</Link>
      </section>

      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/documents">Alle Dateien</Link>
        <Link className="secondaryButton" href={`/customer/orders/${id}`}>Kampagne öffnen</Link>
        <Link className="secondaryButton" href="/customer/orders">Alle Kampagnen</Link>
      </div>

      <DataSection title="Dateien dieser Kampagne" description="Kurz prüfen, herunterladen oder bei Bedarf neue Datei hochladen.">
        <div className="customerMessageList">
          {documents.map((document) => (
            <article className="customerMessageItem" key={document.id}>
              <div className="customerItemHeader">
                <strong>{document.title}</strong>
                <StatusBadge>{CUSTOMER_DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge>
              </div>
              <div className="customerItemMeta">
                <span>{DOCUMENT_TYPE_LABELS[document.documentType]}</span>
                <span>{document.originalFilename}</span>
                <span>{document.versions.length} Version{document.versions.length === 1 ? "" : "en"}</span>
              </div>
              <a className="secondaryButton" href={`/api/customer/documents/${document.id}/download`}>Download</a>
            </article>
          ))}
          {documents.length === 0 ? (
            <EmptyState title="Keine Dateien für diese Kampagne." description="Die wichtigste Aktion ist jetzt der Datei-Upload." action={{ href: "/customer/documents#flyer-upload", label: "Flyerdatei hochladen" }} />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
