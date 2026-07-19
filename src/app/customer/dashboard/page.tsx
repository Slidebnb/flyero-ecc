import Link from "next/link";
import { ArrowRight, Camera, FileText, MapPinned, Navigation, ReceiptText, ShieldCheck, UploadCloud } from "lucide-react";
import { OrderStatus, type ReportStatus } from "@prisma/client";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_ORDER_STATUS_LABELS, customerAreaName, customerOrderName, customerOrderPlainNextStep, customerOrderTone } from "@/app/customer/customerUx";
import { EmptyState, StatusBadge } from "@/app/PortalComponents";
import { getOrderGrossPrice } from "@/lib/pricing";
import { requireTenantSession } from "@/lib/tenant";
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

type DashboardOrder = {
  id: string;
  orderNumber: string;
  targetAreaName: string;
  city: string;
  postalCode: string;
  flyerQuantity: number;
  status: OrderStatus;
  preferredStartDate: Date;
  calculatedGrossPrice: unknown;
  manualPriceOverride: unknown;
  priceRuleSnapshot: unknown;
  targetAreaGeoJson: unknown;
  distributionArea: { geoJson: unknown; geometryGeoJson: unknown } | null;
};

type DashboardReport = {
  id: string;
  reportNumber: string;
  status: ReportStatus;
  pdfUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  order: {
    orderNumber: string;
    targetAreaName: string;
    city: string;
    targetAreaGeoJson: unknown;
    distributionArea: { geoJson: unknown; geometryGeoJson: unknown } | null;
    documents: { id: string; documentType: string }[];
  };
  tour: {
    photoProofs: { id: string }[];
    _count: { gpsPoints: number };
  };
};

const runningStatuses = new Set<OrderStatus>();

const completedStatuses = new Set<OrderStatus>([
  OrderStatus.DISTRIBUTION_APPROVED,
  OrderStatus.REPORT_READY_PREVIEW,
]);

function evidenceState(order: DashboardOrder | null, report: DashboardReport | null) {
  if (report) return "completed";
  if (!order) return "empty";
  if (runningStatuses.has(order.status)) return "running";
  if (completedStatuses.has(order.status)) return "review";
  return "planned";
}

function evidenceGeoJson(order: DashboardOrder | null, report: DashboardReport | null) {
  return report?.order.targetAreaGeoJson
    ?? order?.targetAreaGeoJson
    ?? report?.order.distributionArea?.geoJson
    ?? report?.order.distributionArea?.geometryGeoJson
    ?? order?.distributionArea?.geoJson
    ?? order?.distributionArea?.geometryGeoJson
    ?? null;
}

function CampaignEvidencePreview({ order, report, compact = false }: { order: DashboardOrder | null; report: DashboardReport | null; compact?: boolean }) {
  const state = evidenceState(order, report);
  const geoJson = evidenceGeoJson(order, report);
  const gpsPoints = report?.tour._count.gpsPoints ?? 0;
  const photoCount = report?.tour.photoProofs.length ?? 0;
  const hasExternalGpsDocument = Boolean(report?.order.documents.some((document) => document.documentType === "REPORT"));
  const hasGpsEvidence = Boolean(report && (gpsPoints > 0 || hasExternalGpsDocument || report.pdfUrl));
  const hasPdf = Boolean(report?.pdfUrl);
  const hasPublishedReport = report?.status === "PUBLISHED";
  const title =
    state === "empty"
      ? "Noch kein Nachweis verfügbar."
      : state === "completed"
        ? "Geprüfter Nachweis verfügbar."
        : state === "running"
          ? "Verteilung wird vorbereitet."
          : state === "review"
            ? "Nachweise werden geprüft."
            : "Gebiet geplant.";
  const description =
    state === "empty"
      ? "Sobald die Verteilung abgeschlossen ist, sehen Sie hier GPS-Spur, Fotos und PDF-Bericht."
      : state === "completed"
        ? "Diese Übersicht basiert auf freigegebenen Kampagnendaten und geprüften Nachweisen."
        : state === "running"
          ? "FLYERO koordiniert die Zustellung. Nachweise erscheinen erst nach Prüfung."
          : state === "review"
            ? "Die Verteilung ist dokumentiert. FLYERO prüft Nachweise vor der Freigabe."
            : "Das Verteilgebiet ist geplant. GPS-Nachweis, Fotos und PDF-Bericht folgen nach Durchführung und Prüfung.";
  const proofItems = [
    { icon: Navigation, label: "GPS-Nachweis", value: hasGpsEvidence ? "verfügbar" : state === "running" ? "in Erfassung" : state === "empty" ? "noch nicht vorhanden" : "folgt" },
    { icon: Camera, label: "Fotos", value: photoCount > 0 ? `${photoCount} freigegeben` : state === "running" ? "werden gesammelt" : state === "empty" ? "noch nicht vorhanden" : "folgen" },
    { icon: ShieldCheck, label: "Prüfung", value: hasPublishedReport ? "abgeschlossen" : state === "empty" ? "noch nicht gestartet" : "nach Abschluss" },
    { icon: FileText, label: "PDF-Bericht", value: hasPdf ? "bereit" : state === "empty" ? "noch nicht vorhanden" : "wird nach Abschluss erstellt" },
  ];

  return (
    <div className={`customerEvidencePreview${compact ? " compact" : ""}`} aria-label="FLYERO Nachweisstatus">
      <div className="evidencePreviewHeader">
        <span>{state === "completed" ? "Echte Nachweise" : "Nachweisstatus"}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {geoJson && state !== "empty" ? (
        <div className="evidenceMapFrame">
          <DistributionAreaPreviewMap geoJson={geoJson} height={compact ? 180 : 230} />
        </div>
      ) : (
        <div className="evidenceEmptyState">
          <strong>{state === "empty" ? "Noch kein Nachweis verfügbar." : "Nachweis wird nach der Verteilung erstellt."}</strong>
          <span>{state === "empty" ? "Starten Sie eine Kampagne, danach führt FLYERO Sie Schritt für Schritt weiter." : "Nach Abschluss und Freigabe erscheinen hier die echten Nachweise Ihrer Verteilung."}</span>
        </div>
      )}
      <div className="evidenceStatusGrid">
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
  const session = await requireTenantSession();
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id, tenantId: session.tenantId },
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
      where: { customerId: profile.id, tenantId: session.tenantId, status: { in: ["REPORT_READY_PREVIEW", "DISTRIBUTION_APPROVED"] } },
    }),
    prisma.invoice.findMany({
      where: { customerId: profile.id, tenantId: session.tenantId },
      select: { id: true, totalGross: true, status: true, invoiceDate: true, invoiceNumber: true, pdfUrl: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportTicket.count({
      where: { customerId: profile.id, tenantId: session.tenantId, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.order.findFirst({
      where: { customerId: profile.id, tenantId: session.tenantId },
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
        manualPriceOverride: true,
        priceRuleSnapshot: true,
        targetAreaGeoJson: true,
        distributionArea: { select: { geoJson: true, geometryGeoJson: true } },
      },
    }),
    prisma.report.findFirst({
      where: { tenantId: session.tenantId, status: "PUBLISHED", order: { customerId: profile.id, tenantId: session.tenantId }, tour: { status: "APPROVED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reportNumber: true,
        status: true,
        pdfUrl: true,
        publishedAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            targetAreaName: true,
            city: true,
            targetAreaGeoJson: true,
            distributionArea: { select: { geoJson: true, geometryGeoJson: true } },
            documents: {
              where: { customerVisible: true, status: "APPROVED" },
              select: { id: true, documentType: true },
            },
          },
        },
        tour: {
          select: {
            photoProofs: { where: { customerVisible: true, reviewStatus: "APPROVED" }, select: { id: true } },
            _count: { select: { gpsPoints: true } },
          },
        },
      },
    }),
    prisma.invoice.findFirst({
      where: { customerId: profile.id, tenantId: session.tenantId },
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
            <Link className="primaryCommand" href="/customer/orders/new?fresh=1">Neue Verteilung starten<ArrowRight aria-hidden="true" /></Link>
            <Link href={currentActionHref}>Aktuelle Kampagne</Link>
            <Link href={primaryReportHref}>Nachweis oder Rechnung</Link>
          </div>
        </div>
        <CampaignEvidencePreview order={lastOrder} report={latestReport} />
      </section>

      <div className="customerMissionGrid">
        <section className="customerMissionPanel currentCampaignPanel">
          <div className="missionPanelHeader">
            <span>Was läuft gerade?</span>
            <h2>{lastOrder ? customerAreaName(lastOrder.targetAreaName) : "Noch keine Kampagne gestartet"}</h2>
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
                <div><dt>Gesamt brutto</dt><dd>{formatCurrency(getOrderGrossPrice(lastOrder))}</dd></div>
              </dl>
              <Link className="customerPanelLink" href={`/customer/orders/${lastOrder.id}`}>Kampagne öffnen<ArrowRight aria-hidden="true" /></Link>
            </>
          ) : (
            <EmptyState
              title="Starten Sie Ihre erste Verteilung."
              description="Der Karten-Flow berechnet Gebiet, Preis und Bedarf live."
              action={{ href: "/customer/orders/new?fresh=1", label: "Jetzt starten" }}
            />
          )}
        </section>

        <section className="customerMissionPanel proofPanel">
          <div className="missionPanelHeader">
            <span>Welche Nachweise liegen vor?</span>
            <h2>{latestReport ? latestReport.reportNumber : "Nachweise erscheinen erst nach der Verteilung"}</h2>
          </div>
          <CampaignEvidencePreview order={lastOrder} report={latestReport} compact />
          {latestReport ? (
            <div className="proofPanelFooter">
              <p>{customerAreaName(latestReport.order.targetAreaName)} / {latestReport.order.city}</p>
              <Link className="customerPanelLink" href={`/customer/reports/${latestReport.id}`}>Bericht ansehen<ArrowRight aria-hidden="true" /></Link>
            </div>
          ) : (
            <p className="proofExampleNote">Noch kein Nachweis verfügbar. Sobald die Verteilung abgeschlossen ist, sehen Sie hier GPS-Spur, Fotos und PDF-Bericht.</p>
          )}
        </section>

        <section className="customerMissionPanel nextActionPanel">
          <div className="missionPanelHeader">
            <span>Direkt erledigen</span>
            <h2>Alles Wichtige in maximal 3 Klicks.</h2>
          </div>
          <div className="customerActionStack">
            <Link href="/customer/orders/new?fresh=1"><MapPinned aria-hidden="true" /><span>Gebiet planen</span><strong>1 Klick</strong></Link>
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
