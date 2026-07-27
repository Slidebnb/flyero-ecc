import Link from "next/link";
import { ArrowRight, Camera, FileText, Navigation, ShieldCheck } from "lucide-react";
import { OrderStatus, type ReportStatus } from "@prisma/client";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CustomerLiveRefresh } from "@/app/customer/CustomerLiveRefresh";
import { CUSTOMER_ORDER_STATUS_LABELS, customerAreaName, customerOrderPlainNextStep, customerOrderTone } from "@/app/customer/customerUx";
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

function reportBelongsToOrder(order: DashboardOrder | null, report: DashboardReport | null) {
  return Boolean(report && (!order || report.order.orderNumber === order.orderNumber));
}

function evidenceGeoJson(order: DashboardOrder | null, report: DashboardReport | null) {
  return order?.targetAreaGeoJson
    ?? order?.distributionArea?.geoJson
    ?? order?.distributionArea?.geometryGeoJson
    ?? report?.order.targetAreaGeoJson
    ?? report?.order.distributionArea?.geoJson
    ?? report?.order.distributionArea?.geometryGeoJson
    ?? null;
}

function CampaignEvidencePreview({ order, report, compact = false }: { order: DashboardOrder | null; report: DashboardReport | null; compact?: boolean }) {
  const currentReport = reportBelongsToOrder(order, report) ? report : null;
  const state = evidenceState(order, currentReport);
  const geoJson = evidenceGeoJson(order, currentReport);
  const gpsPoints = currentReport?.tour._count.gpsPoints ?? 0;
  const photoCount = currentReport?.tour.photoProofs.length ?? 0;
  const hasExternalGpsDocument = Boolean(currentReport?.order.documents.some((document) => document.documentType === "REPORT"));
  const hasGpsEvidence = Boolean(currentReport && (gpsPoints > 0 || hasExternalGpsDocument || currentReport.pdfUrl));
  const hasPdf = Boolean(currentReport?.pdfUrl);
  const hasPublishedReport = currentReport?.status === "PUBLISHED";
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
  const visibleProofItems = proofItems.map((item, index) => (
    index === 2 && hasPublishedReport ? { ...item, value: "freigegeben" } : item
  ));

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
        {visibleProofItems.map((item) => {
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
    lastOrder,
    latestReport,
    latestInvoice,
  ] = await Promise.all([
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

  const currentReport = reportBelongsToOrder(lastOrder, latestReport) ? latestReport : null;
  const dashboardOrderStatus = currentReport ? OrderStatus.REPORT_READY_PREVIEW : lastOrder?.status ?? OrderStatus.DRAFT;
  const primaryReportHref = currentReport ? `/customer/reports/${currentReport.id}` : latestInvoice ? `/customer/invoices/${latestInvoice.id}` : "/customer/reports";
  const currentActionHref = lastOrder ? `/customer/orders/${lastOrder.id}` : "/customer/orders";

  return (
    <CustomerPortalShell
      active="/customer/dashboard"
      title={`Hallo${profile.contactName ? `, ${profile.contactName}` : ""}`}
      description={profile.companyName ? `${profile.companyName} - Kampagnen starten, Nachweise prüfen und Rechnungen finden.` : "Kampagnen starten, Nachweise prüfen und Rechnungen finden."}
    >
      <CustomerLiveRefresh />
      <section className="customerCommandHero" aria-label="Letzte Buchung">
        <div className="customerCommandCopy">
          <span>Ihre letzte Buchung</span>
          <h2>{lastOrder ? customerAreaName(lastOrder.targetAreaName) : "Ihre nächste Verteilung"}</h2>
          <p>{lastOrder ? `${lastOrder.postalCode} ${lastOrder.city} · ${formatNumber(lastOrder.flyerQuantity)} Flyer` : "Starten Sie Ihre erste Verteilung direkt über die Gebietsauswahl."}</p>
          <div className="customerCommandActions">
            <Link className="primaryCommand" href="/customer/orders/new?fresh=1">Neue Verteilung starten<ArrowRight aria-hidden="true" /></Link>
            <Link href={currentActionHref}>{lastOrder ? "Kampagne öffnen" : "Meine Kampagnen"}</Link>
            <Link href={primaryReportHref}>{currentReport ? "Nachweis ansehen" : "Rechnung ansehen"}</Link>
          </div>
        </div>
        <CampaignEvidencePreview order={lastOrder} report={currentReport} />
      </section>

      <div className="customerMissionGrid">
        <section className="customerMissionPanel currentCampaignPanel">
          <div className="missionPanelHeader">
            <span>Letzte Buchung</span>
            <h2>{lastOrder ? customerAreaName(lastOrder.targetAreaName) : "Noch keine Kampagne gestartet"}</h2>
          </div>
          {lastOrder ? (
            <>
              <div className="currentCampaignStatus">
                <StatusBadge tone={customerOrderTone(dashboardOrderStatus)}>{currentReport ? "Freigegeben" : CUSTOMER_ORDER_STATUS_LABELS[dashboardOrderStatus]}</StatusBadge>
                <strong>{lastOrder.postalCode} {lastOrder.city}</strong>
              </div>
              <div className="customerPlainNextStep">
                <strong>Nächster Schritt</strong>
                <span>{currentReport ? "Der geprüfte Verteilbericht ist im Kundenportal verfügbar." : customerOrderPlainNextStep(dashboardOrderStatus)}</span>
              </div>
              <dl className="customerFactList">
                <div><dt>Buchung</dt><dd>Ihre aktuelle Verteilung</dd></div>
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
            <h2>{currentReport ? currentReport.reportNumber : "Nachweise erscheinen erst nach der Verteilung"}</h2>
          </div>
          <CampaignEvidencePreview order={lastOrder} report={currentReport} compact />
          {currentReport ? (
            <div className="proofPanelFooter">
              <p>{customerAreaName(currentReport.order.targetAreaName)} / {currentReport.order.city}</p>
              <Link className="customerPanelLink" href={`/customer/reports/${currentReport.id}`}>Bericht ansehen<ArrowRight aria-hidden="true" /></Link>
            </div>
          ) : (
            <p className="proofExampleNote">Noch kein Nachweis verfügbar. Sobald die Verteilung abgeschlossen ist, sehen Sie hier GPS-Spur, Fotos und PDF-Bericht.</p>
          )}
        </section>

      </div>
    </CustomerPortalShell>
  );
}
