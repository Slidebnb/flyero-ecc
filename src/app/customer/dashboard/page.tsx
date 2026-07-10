import Link from "next/link";
import { ArrowRight, Camera, FileText, MapPinned, Navigation, ReceiptText, ShieldCheck, UploadCloud } from "lucide-react";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_ORDER_STATUS_LABELS, customerOrderName, customerOrderPlainNextStep, customerOrderTone } from "@/app/customer/customerUx";
import { EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

function formatDate(value?: Date | null) {
  return value ? value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Termin offen";
}

function ProofPreview({ hasRealReport }: { hasRealReport: boolean }) {
  const proofItems = [
    { icon: Navigation, label: "GPS-Spur", value: hasRealReport ? "geprüft" : "Beispiel Koblenz" },
    { icon: Camera, label: "Fotos", value: hasRealReport ? "im Bericht" : "Pins sichtbar" },
    { icon: ShieldCheck, label: "Tour", value: hasRealReport ? "freigegeben" : "Beispielprüfung" },
    { icon: FileText, label: "PDF", value: hasRealReport ? "bereit" : "Vorschau" },
  ];

  return (
    <div className="customerProofPreview" aria-label="FLYERO GPS- und Berichtsvorschau">
      <div className="proofMapCanvas" aria-hidden="true">
        <span className="proofRouteLine proofRouteLineA" />
        <span className="proofRouteLine proofRouteLineB" />
        <span className="proofRouteLine proofRouteLineC" />
        <i className="proofPin proofPinA" />
        <i className="proofPin proofPinB" />
        <i className="proofPin proofPinC" />
        <strong>Koblenz Süd</strong>
      </div>
      <div className="proofChecklist">
        {proofItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <span><Icon aria-hidden="true" /></span>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function CustomerDashboardPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
    select: { id: true, companyName: true, contactName: true },
  });

  if (!profile) {
    return (
      <CustomerPortalShell active="/customer/dashboard" title="Übersicht" description="Kundenprofil wurde nicht gefunden.">
        <EmptyState title="Kundenprofil wurde nicht gefunden." description="Bitte melden Sie sich erneut an oder kontaktieren Sie den Support." />
      </CustomerPortalShell>
    );
  }

  const [
    completedOrders,
    invoices,
    openSupportTickets,
    lastOrder,
    latestReport,
    latestInvoice,
  ] = await Promise.all([
    prisma.order.count({
      where: { customerId: profile.id, status: { in: ["REPORT_READY_PREVIEW", "DISTRIBUTION_APPROVED"] } },
    }),
    prisma.invoice.findMany({
      where: { customerId: profile.id },
      select: { id: true, totalGross: true, status: true, invoiceDate: true, invoiceNumber: true, pdfUrl: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportTicket.count({
      where: { customerId: profile.id, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.order.findFirst({
      where: { customerId: profile.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        targetAreaName: true,
        city: true,
        postalCode: true,
        flyerQuantity: true,
        status: true,
        preferredStartDate: true,
        calculatedGrossPrice: true,
      },
    }),
    prisma.report.findFirst({
      where: { status: "PUBLISHED", order: { customerId: profile.id }, tour: { status: "APPROVED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reportNumber: true,
        status: true,
        pdfUrl: true,
        createdAt: true,
        order: { select: { orderNumber: true, targetAreaName: true, city: true } },
      },
    }),
    prisma.invoice.findFirst({
      where: { customerId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceNumber: true, status: true, totalGross: true, invoiceDate: true, pdfUrl: true },
    }),
  ]);

  const distributedFlyers = lastOrder?.flyerQuantity ? completedOrders * lastOrder.flyerQuantity : 0;
  const primaryReportHref = latestReport ? `/customer/reports/${latestReport.id}` : latestInvoice ? `/customer/invoices/${latestInvoice.id}` : "/customer/reports";
  const currentActionHref = lastOrder ? `/customer/orders/${lastOrder.id}` : "/customer/orders";

  return (
    <CustomerPortalShell
      active="/customer/dashboard"
      title={`Hallo${profile.contactName ? `, ${profile.contactName}` : ""}`}
      description={profile.companyName ? `${profile.companyName} - Kampagnen starten, Nachweise prüfen und Rechnungen finden.` : "Kampagnen starten, Nachweise prüfen und Rechnungen finden."}
    >
      <section className="customerCommandHero" aria-label="Schnellstart">
        <div className="customerCommandCopy">
          <span>FLYERO Kundenportal</span>
          <h2>Was möchten Sie jetzt erledigen?</h2>
          <p>Die drei wichtigsten Wege stehen direkt bereit: neue Verteilung starten, aktuelle Kampagne öffnen oder Nachweis/Rechnung ansehen.</p>
          <div className="customerCommandActions">
            <Link className="primaryCommand" href="/customer/orders/new">Neue Verteilung starten<ArrowRight aria-hidden="true" /></Link>
            <Link href={currentActionHref}>Aktuelle Kampagne</Link>
            <Link href={primaryReportHref}>Nachweis oder Rechnung</Link>
          </div>
        </div>
        <ProofPreview hasRealReport={Boolean(latestReport)} />
      </section>

      <div className="customerMissionGrid">
        <section className="customerMissionPanel currentCampaignPanel">
          <div className="missionPanelHeader">
            <span>Was läuft gerade?</span>
            <h2>{lastOrder ? lastOrder.targetAreaName : "Noch keine Kampagne gestartet"}</h2>
          </div>
          {lastOrder ? (
            <>
              <div className="currentCampaignStatus">
                <StatusBadge tone={customerOrderTone(lastOrder.status)}>{CUSTOMER_ORDER_STATUS_LABELS[lastOrder.status]}</StatusBadge>
                <strong>{lastOrder.postalCode} {lastOrder.city}</strong>
              </div>
              <div className="customerPlainNextStep">
                <strong>Nächster Schritt</strong>
                <span>{customerOrderPlainNextStep(lastOrder.status)}</span>
              </div>
              <dl className="customerFactList">
                <div><dt>Kampagne</dt><dd>{customerOrderName(lastOrder.orderNumber)}</dd></div>
                <div><dt>Start</dt><dd>{formatDate(lastOrder.preferredStartDate)}</dd></div>
                <div><dt>Flyer</dt><dd>{formatNumber(lastOrder.flyerQuantity)}</dd></div>
                <div><dt>Preis</dt><dd>{formatCurrency(lastOrder.calculatedGrossPrice)}</dd></div>
              </dl>
              <Link className="customerPanelLink" href={`/customer/orders/${lastOrder.id}`}>Kampagne öffnen<ArrowRight aria-hidden="true" /></Link>
            </>
          ) : (
            <EmptyState
              title="Starten Sie Ihre erste Verteilung."
              description="Der Karten-Flow berechnet Gebiet, Preis und Bedarf live."
              action={{ href: "/customer/orders/new", label: "Jetzt starten" }}
            />
          )}
        </section>

        <section className="customerMissionPanel proofPanel">
          <div className="missionPanelHeader">
            <span>Welche Nachweise liegen vor?</span>
            <h2>{latestReport ? latestReport.reportNumber : "Beispiel-Nachweis Koblenz"}</h2>
          </div>
          <ProofPreview hasRealReport={Boolean(latestReport)} />
          {latestReport ? (
            <div className="proofPanelFooter">
              <p>{latestReport.order.targetAreaName} / {latestReport.order.city}</p>
              <Link className="customerPanelLink" href={`/customer/reports/${latestReport.id}`}>Bericht ansehen<ArrowRight aria-hidden="true" /></Link>
            </div>
          ) : (
            <p className="proofExampleNote">Beispielvorschau: echte GPS-Spuren, Fotos und PDF-Berichte erscheinen hier nach einer geprüften Tour.</p>
          )}
        </section>

        <section className="customerMissionPanel nextActionPanel">
          <div className="missionPanelHeader">
            <span>Direkt erledigen</span>
            <h2>Alles Wichtige in maximal 3 Klicks.</h2>
          </div>
          <div className="customerActionStack">
            <Link href="/customer/orders/new"><MapPinned aria-hidden="true" /><span>Gebiet planen</span><strong>1 Klick</strong></Link>
            <Link href="/customer/documents"><UploadCloud aria-hidden="true" /><span>Druckdaten senden</span><strong>2 Klicks</strong></Link>
            <Link href={latestInvoice ? `/customer/invoices/${latestInvoice.id}` : "/customer/invoices"}><ReceiptText aria-hidden="true" /><span>Rechnung öffnen</span><strong>{latestInvoice ? formatCurrency(latestInvoice.totalGross) : "sobald vorhanden"}</strong></Link>
            <Link href="/customer/support"><ShieldCheck aria-hidden="true" /><span>Hilfe bekommen</span><strong>{openSupportTickets} offen</strong></Link>
          </div>
        </section>
      </div>

      <section className="customerResultRail" aria-label="Ergebnisse">
        <article><strong>{formatNumber(distributedFlyers)}</strong><span>verteilte Flyer</span></article>
        <article><strong>{completedOrders}</strong><span>abgeschlossene Kampagnen</span></article>
        <article><strong>{invoices.length}</strong><span>Rechnungen</span></article>
      </section>
    </CustomerPortalShell>
  );
}
