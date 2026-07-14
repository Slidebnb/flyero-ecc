import {
  DispatchAssignmentStatus,
  DistributorReviewStatus,
  LeadStatus,
  OrderStatus,
  PaymentStatus,
  ReportStatus,
  TourStatus,
  UserStatus,
  WarehouseInventoryStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupportAnalytics } from "@/lib/support";
import { getDocumentAnalytics } from "@/lib/documents";
import { productionCustomerWhere, productionLeadWhere, productionOrderWhere, productionPaymentWhere, productionUserWhere } from "@/lib/productionData";

export type AnalyticsFilters = {
  from: Date;
  to: Date;
  city?: string;
  customerId?: string;
  distributorId?: string;
  status?: string;
};

export type AnalyticsScope = {
  tenantId?: string | null;
};

export type AnalyticsFilterInput = {
  from?: string | Date | null;
  to?: string | Date | null;
  city?: string | null;
  customerId?: string | null;
  distributorId?: string | null;
  status?: string | null;
};

type SeriesPoint = {
  key: string;
  label: string;
  value: number;
};

const PAID_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.SUBMITTED,
  OrderStatus.UNDER_REVIEW,
  OrderStatus.PAID_WAITING_FOR_ADMIN_REVIEW,
  OrderStatus.WAITING_FOR_CUSTOMER,
  OrderStatus.APPROVED,
  OrderStatus.READY_FOR_FLYERS,
  OrderStatus.FLYERS_EXPECTED,
  OrderStatus.FLYERS_RECEIVED,
  OrderStatus.STORED,
  OrderStatus.READY_FOR_PICKUP,
];

const COMPLETED_TOUR_STATUSES: TourStatus[] = [
  TourStatus.COMPLETED,
  TourStatus.UNDER_REVIEW,
  TourStatus.APPROVED,
];

const OPEN_TOUR_STATUSES: TourStatus[] = [
  TourStatus.ASSIGNED,
  TourStatus.READY,
  TourStatus.PICKED_UP,
  TourStatus.STARTED,
  TourStatus.PAUSED,
  TourStatus.RESUMED,
];

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function toDate(value: string | Date | null | undefined, fallback: Date, end = false) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return end ? endOfDay(date) : startOfDay(date);
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function parseAnalyticsFilters(input: AnalyticsFilterInput = {}): AnalyticsFilters {
  const defaultTo = endOfDay(new Date());
  const defaultFrom = startOfDay(new Date(defaultTo.getTime() - 29 * 24 * 60 * 60 * 1000));
  return {
    from: toDate(input.from, defaultFrom),
    to: toDate(input.to, defaultTo, true),
    city: clean(input.city),
    customerId: clean(input.customerId),
    distributorId: clean(input.distributorId),
    status: clean(input.status),
  };
}

function dateRange(field: string, filters: AnalyticsFilters) {
  return { [field]: { gte: filters.from, lte: filters.to } };
}

function directTenantWhere(scope: AnalyticsScope) {
  return scope.tenantId ? { tenantId: scope.tenantId } : {};
}

function leadTenantWhere(scope: AnalyticsScope) {
  return scope.tenantId ? { wonCustomer: { tenantId: scope.tenantId } } : {};
}

function orderWhere(filters: AnalyticsFilters, dateField = "createdAt", scope: AnalyticsScope = {}) {
  return {
    ...productionOrderWhere(),
    ...dateRange(dateField, filters),
    ...directTenantWhere(scope),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.distributorId ? { assignedDistributorId: filters.distributorId } : {}),
    ...(filters.status && Object.values(OrderStatus).includes(filters.status as OrderStatus)
      ? { status: filters.status as OrderStatus }
      : {}),
  };
}

function paymentWhere(filters: AnalyticsFilters, dateField = "createdAt", scope: AnalyticsScope = {}) {
  const order = {
    ...productionOrderWhere(),
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.distributorId ? { assignedDistributorId: filters.distributorId } : {}),
  };
  return {
    ...dateRange(dateField, filters),
    ...directTenantWhere(scope),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    order,
    ...(filters.status && Object.values(PaymentStatus).includes(filters.status as PaymentStatus)
      ? { status: filters.status as PaymentStatus }
      : {}),
  };
}

function tourWhere(filters: AnalyticsFilters, dateField = "createdAt", scope: AnalyticsScope = {}) {
  const order = {
    ...productionOrderWhere(),
    ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
  return {
    ...dateRange(dateField, filters),
    ...(filters.distributorId ? { distributorId: filters.distributorId } : {}),
    order,
    ...(filters.status && Object.values(TourStatus).includes(filters.status as TourStatus)
      ? { status: filters.status as TourStatus }
      : {}),
  };
}

function leadWhere(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  return {
    ...productionLeadWhere(),
    ...dateRange("createdAt", filters),
    ...leadTenantWhere(scope),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.status && Object.values(LeadStatus).includes(filters.status as LeadStatus)
      ? { status: filters.status as LeadStatus }
      : {}),
  };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${month}.${year}`;
}

function buildMonthKeys(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function weekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function countByWeek(rows: Array<{ createdAt?: Date | null }>) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.createdAt) continue;
    const key = weekKey(row.createdAt);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, label: key, value }));
}

function countByMonth(rows: Array<{ createdAt?: Date | null; paidAt?: Date | null; amount?: unknown }>, filters: AnalyticsFilters, value = false): SeriesPoint[] {
  const totals = new Map(buildMonthKeys(filters.from, filters.to).map((key) => [key, 0]));
  for (const row of rows) {
    const date = row.paidAt ?? row.createdAt;
    if (!date) continue;
    const key = monthKey(date);
    totals.set(key, (totals.get(key) ?? 0) + (value ? toNumber(row.amount) : 1));
  }
  return [...totals.entries()].map(([key, total]) => ({ key, label: monthLabel(key), value: round(total) }));
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) return Number(value.toString());
  return 0;
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function diffHours(start?: Date | null, end?: Date | null) {
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

function diffDays(start?: Date | null, end?: Date | null) {
  if (!start || !end) return null;
  return Math.max(0, (end.getTime() - start.getTime()) / 86_400_000);
}

function gpsScore(tour: { gpsPoints?: Array<{ accuracy: unknown }>; durationSeconds?: number | null; totalDurationSeconds?: number | null }) {
  const points = tour.gpsPoints ?? [];
  if (!points.length) return 0;
  const avgAccuracy = average(points.map((point) => toNumber(point.accuracy)));
  const duration = tour.durationSeconds ?? tour.totalDurationSeconds ?? 0;
  const densityBonus = Math.min(25, points.length * 2);
  const accuracyScore = Math.max(0, 75 - avgAccuracy);
  const durationBonus = duration > 0 ? 10 : 0;
  return Math.min(100, round(accuracyScore + densityBonus + durationBonus));
}

function statusSeries<T extends string>(values: readonly T[], counts: Array<{ status: T; _count: { status: number } }>) {
  return values.map((status) => ({
    key: status,
    label: status,
    value: counts.find((entry) => entry.status === status)?._count.status ?? 0,
  }));
}

export async function getRevenueMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [allPaid, periodPaid, currentMonthPaid, refunds] = await Promise.all([
    prisma.payment.findMany({ where: { ...productionPaymentWhere(), ...directTenantWhere(scope), status: { in: PAID_PAYMENT_STATUSES } }, select: { amount: true, paidAt: true, createdAt: true } }),
    prisma.payment.findMany({ where: { ...paymentWhere(filters, "createdAt", scope), status: { in: PAID_PAYMENT_STATUSES } }, select: { amount: true, paidAt: true, createdAt: true } }),
    prisma.payment.findMany({
      where: {
        ...productionPaymentWhere(),
        ...directTenantWhere(scope),
        status: { in: PAID_PAYMENT_STATUSES },
        createdAt: { gte: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), lte: endOfDay(new Date()) },
      },
      select: { amount: true },
    }),
    prisma.refund.findMany({
      where: {
        createdAt: { gte: filters.from, lte: filters.to },
        ...directTenantWhere(scope),
        payment: {
          ...productionPaymentWhere(),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...((filters.city || filters.distributorId)
            ? { order: { ...productionOrderWhere(), ...(filters.city ? { city: filters.city } : {}), ...(filters.distributorId ? { assignedDistributorId: filters.distributorId } : {}) } }
            : {}),
        },
      },
      select: { amount: true, status: true },
    }),
  ]);

  return {
    totalRevenue: round(allPaid.reduce((sum, payment) => sum + toNumber(payment.amount), 0)),
    periodRevenue: round(periodPaid.reduce((sum, payment) => sum + toNumber(payment.amount), 0)),
    currentMonthRevenue: round(currentMonthPaid.reduce((sum, payment) => sum + toNumber(payment.amount), 0)),
    refundCount: refunds.length,
    refundAmount: round(refunds.reduce((sum, refund) => sum + toNumber(refund.amount), 0)),
    revenueByMonth: countByMonth(periodPaid, filters, true),
  };
}

export async function getOrderMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [paidOrders, openOrders, orders, statusCounts] = await Promise.all([
    prisma.order.count({ where: { ...orderWhere(filters, "createdAt", scope), payments: { some: { status: { in: PAID_PAYMENT_STATUSES } } } } }),
    prisma.order.count({ where: { ...orderWhere(filters, "createdAt", scope), status: { in: OPEN_ORDER_STATUSES } } }),
    prisma.order.findMany({ where: orderWhere(filters, "createdAt", scope), select: { createdAt: true } }),
    prisma.order.groupBy({ by: ["status"], where: orderWhere(filters, "createdAt", scope), _count: { status: true } }),
  ]);

  return {
    paidOrders,
    openOrders,
    totalOrders: orders.length,
    ordersByMonth: countByMonth(orders, filters),
    ordersByStatus: statusSeries(Object.values(OrderStatus), statusCounts),
  };
}

export async function getCustomerMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [activeCustomers, customers] = await Promise.all([
    prisma.user.count({ where: { ...directTenantWhere(scope), ...productionUserWhere(), role: "CUSTOMER", status: UserStatus.ACTIVE } }),
    prisma.customerProfile.findMany({
      where: { ...directTenantWhere(scope), ...productionCustomerWhere() },
      include: {
        orders: { where: productionOrderWhere(), include: { payments: true } },
        user: { select: { status: true } },
      },
    }),
  ]);

  const ranked = customers.map((customer) => {
    const filteredOrders = customer.orders.filter((order) =>
      order.createdAt >= filters.from &&
      order.createdAt <= filters.to &&
      (!filters.city || order.city === filters.city) &&
      (!filters.customerId || order.customerId === filters.customerId) &&
      (!filters.status || order.status === filters.status),
    );
    const revenue = filteredOrders.reduce((sum, order) => (
      sum + order.payments
        .filter((payment) => PAID_PAYMENT_STATUSES.includes(payment.status))
        .reduce((paymentSum, payment) => paymentSum + toNumber(payment.amount), 0)
    ), 0);
    return {
      customerId: customer.id,
      companyName: customer.companyName,
      orderCount: filteredOrders.length,
      revenue: round(revenue),
      lastOrderAt: customer.orders.reduce<Date | null>((latest, order) => (!latest || order.createdAt > latest ? order.createdAt : latest), null),
    };
  });

  return {
    activeCustomers,
    topCustomersByRevenue: [...ranked].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    topCustomersByOrders: [...ranked].sort((a, b) => b.orderCount - a.orderCount).slice(0, 8),
    recurringCustomers: ranked.filter((customer) => customer.orderCount >= 2).length,
    inactiveCustomers: ranked.filter((customer) => !customer.lastOrderAt || customer.lastOrderAt < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length,
  };
}

export async function getDistributorMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [activeDistributors, distributors, tourStatusCounts] = await Promise.all([
    prisma.distributorProfile.count({ where: { reviewStatus: DistributorReviewStatus.APPROVED, user: { ...productionUserWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) } } }),
    prisma.distributorProfile.findMany({
      where: { user: { ...productionUserWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) } },
      include: {
        dispatchAssignments: { where: { assignedAt: { gte: filters.from, lte: filters.to }, order: productionOrderWhere() } },
        tours: {
          where: tourWhere(filters, "createdAt", scope),
          include: { gpsPoints: { select: { accuracy: true } } },
        },
      },
    }),
    prisma.distributionTour.groupBy({ by: ["status"], where: tourWhere(filters, "createdAt", scope), _count: { status: true } }),
  ]);

  const distributorPerformance = distributors
    .filter((distributor) => !filters.distributorId || distributor.id === filters.distributorId)
    .map((distributor) => {
      const completed = distributor.tours.filter((tour) => COMPLETED_TOUR_STATUSES.includes(tour.status));
      const rejected = distributor.dispatchAssignments.filter((assignment) => assignment.status === DispatchAssignmentStatus.REJECTED).length;
      const totalAssignments = distributor.dispatchAssignments.length;
      return {
        distributorId: distributor.id,
        name: `${distributor.firstName} ${distributor.lastName}`,
        completedTours: completed.length,
        openTours: distributor.tours.filter((tour) => OPEN_TOUR_STATUSES.includes(tour.status)).length,
        rejectionRate: totalAssignments ? round((rejected / totalAssignments) * 100) : 0,
        averageGpsScore: average(distributor.tours.map(gpsScore)),
        punctualityPrepared: "vorbereitet",
        warnings: distributor.dispatchAssignments.filter((assignment) => assignment.capacityWarning).length,
      };
    })
    .sort((a, b) => b.completedTours - a.completedTours);

  return {
    activeDistributors,
    distributorPerformance,
    toursByStatus: statusSeries(Object.values(TourStatus), tourStatusCounts),
  };
}

export async function getWarehouseMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const inventories = await prisma.warehouseInventory.findMany({
    where: {
      createdAt: { lte: filters.to },
      order: { ...productionOrderWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) },
      ...(filters.distributorId ? { reservedDistributorId: filters.distributorId } : {}),
    },
    select: { status: true, receivedAt: true, pickedUpAt: true, preparedAt: true, createdAt: true },
  });

  return {
    inventoryByStatus: statusSeries(Object.values(WarehouseInventoryStatus), Object.values(WarehouseInventoryStatus).map((status) => ({
      status,
      _count: { status: inventories.filter((item) => item.status === status).length },
    }))),
    averageWarehouseDays: average(inventories.map((item) => diffDays(item.receivedAt ?? item.createdAt, item.pickedUpAt ?? item.preparedAt)).filter((value): value is number => value !== null)),
  };
}

export async function getPaymentMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [openPayments, statusCounts] = await Promise.all([
    prisma.payment.count({ where: { ...paymentWhere(filters, "createdAt", scope), status: { in: [PaymentStatus.CREATED, PaymentStatus.CHECKOUT_CREATED, PaymentStatus.PENDING, PaymentStatus.FAILED] } } }),
    prisma.payment.groupBy({ by: ["status"], where: paymentWhere(filters, "createdAt", scope), _count: { status: true } }),
  ]);

  return {
    openPayments,
    paymentsByStatus: statusSeries(Object.values(PaymentStatus), statusCounts),
  };
}

export async function getReportMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [publishedReports, reports] = await Promise.all([
    prisma.report.count({
      where: {
        ...directTenantWhere(scope),
        status: { in: [ReportStatus.PUBLISHED, ReportStatus.RELEASED_TO_CUSTOMER, ReportStatus.APPROVED] },
        createdAt: { gte: filters.from, lte: filters.to },
        order: { ...productionOrderWhere(), ...(filters.city ? { city: filters.city } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) },
        ...(filters.distributorId ? { tour: { distributorId: filters.distributorId } } : {}),
      },
    }),
    prisma.report.findMany({
      where: {
        ...directTenantWhere(scope),
        createdAt: { gte: filters.from, lte: filters.to },
        order: { ...productionOrderWhere(), ...(filters.city ? { city: filters.city } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) },
        ...(filters.distributorId ? { tour: { distributorId: filters.distributorId } } : {}),
      },
      include: { tour: true },
    }),
  ]);

  return {
    publishedReports,
    averageTourToReportHours: average(reports.map((report) => diffHours(report.tour.completedAt, report.generatedAt ?? report.approvedAt)).filter((value): value is number => value !== null)),
  };
}

export async function getLeadMetrics(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [leads, statusCounts, openFollowUps] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere(filters, scope),
      select: { createdAt: true, status: true },
    }),
    prisma.lead.groupBy({ by: ["status"], where: leadWhere(filters, scope), _count: { status: true } }),
    prisma.lead.count({
      where: {
        ...leadTenantWhere(scope),
        archivedAt: null,
        status: { notIn: [LeadStatus.WON, LeadStatus.LOST, LeadStatus.ARCHIVED] },
        nextFollowUpAt: { not: null },
      },
    }),
  ]);
  const wonLeads = leads.filter((lead) => lead.status === LeadStatus.WON).length;
  const lostLeads = leads.filter((lead) => lead.status === LeadStatus.LOST).length;
  const closed = wonLeads + lostLeads;

  return {
    newLeads: leads.filter((lead) => lead.status === LeadStatus.NEW).length,
    totalLeads: leads.length,
    leadsByMonth: countByMonth(leads, filters),
    leadsByStatus: statusSeries(Object.values(LeadStatus), statusCounts),
    conversionRate: closed ? round((wonLeads / closed) * 100) : 0,
    newLeadsByWeek: countByWeek(leads),
    wonLeads,
    lostLeads,
    openFollowUps,
  };
}

export async function getOperationalKpis(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [tours, payments, inventories, dispatchAssignments, reports] = await Promise.all([
    prisma.distributionTour.findMany({ where: tourWhere(filters, "createdAt", scope), include: { gpsPoints: { select: { accuracy: true } } } }),
    prisma.payment.findMany({ where: paymentWhere(filters, "createdAt", scope), include: { order: true } }),
    prisma.warehouseInventory.findMany({ where: { order: { ...productionOrderWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) } } }),
    prisma.dispatchAssignment.findMany({ where: { assignedAt: { gte: filters.from, lte: filters.to }, ...(filters.distributorId ? { distributorId: filters.distributorId } : {}), order: { ...productionOrderWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}) } } }),
    prisma.report.findMany({ where: { ...directTenantWhere(scope), createdAt: { gte: filters.from, lte: filters.to }, order: productionOrderWhere() }, include: { tour: true } }),
  ]);

  return {
    averageTourDurationHours: average(tours.map((tour) => (tour.durationSeconds ?? tour.totalDurationSeconds ?? 0) / 3600)),
    averageDistanceKm: average(tours.map((tour) => (tour.distanceMeters ?? tour.totalDistanceMeters ?? 0) / 1000)),
    averageGpsScore: average(tours.map(gpsScore)),
    averageOrderToPaymentHours: average(payments.map((payment) => diffHours(payment.order.createdAt, payment.paidAt ?? payment.createdAt)).filter((value): value is number => value !== null)),
    averagePaymentToAdminApprovalHours: average(payments.map((payment) => diffHours(payment.paidAt ?? payment.createdAt, payment.order.updatedAt)).filter((value): value is number => value !== null)),
    averageWarehouseDays: average(inventories.map((inventory) => diffDays(inventory.receivedAt ?? inventory.createdAt, inventory.pickedUpAt ?? inventory.preparedAt)).filter((value): value is number => value !== null)),
    averageDispatchHours: average(dispatchAssignments.map((assignment) => diffHours(assignment.assignedAt, assignment.acceptedAt ?? assignment.rejectedAt ?? assignment.cancelledAt)).filter((value): value is number => value !== null)),
    averageTourToReportHours: average(reports.map((report) => diffHours(report.tour.completedAt, report.generatedAt ?? report.approvedAt)).filter((value): value is number => value !== null)),
  };
}

export async function getBusinessOverview(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const [
    revenue,
    orders,
    customers,
    distributors,
    warehouse,
    payments,
    reports,
    leads,
    support,
    documents,
    operational,
  ] = await Promise.all([
    getRevenueMetrics(filters, scope),
    getOrderMetrics(filters, scope),
    getCustomerMetrics(filters, scope),
    getDistributorMetrics(filters, scope),
    getWarehouseMetrics(filters, scope),
    getPaymentMetrics(filters, scope),
    getReportMetrics(filters, scope),
    getLeadMetrics(filters, scope),
    getSupportAnalytics(scope),
    getDocumentAnalytics(scope),
    getOperationalKpis(filters, scope),
  ]);

  return {
    filters,
    summary: {
      totalRevenue: revenue.totalRevenue,
      currentMonthRevenue: revenue.currentMonthRevenue,
      paidOrders: orders.paidOrders,
      openOrders: orders.openOrders,
      completedTours: distributors.distributorPerformance.reduce((sum, distributor) => sum + distributor.completedTours, 0),
      newLeads: leads.newLeads,
      wonLeads: leads.wonLeads,
      lostLeads: leads.lostLeads,
      openFollowUps: leads.openFollowUps,
      activeCustomers: customers.activeCustomers,
      activeDistributors: distributors.activeDistributors,
      openPayments: payments.openPayments,
      refunds: revenue.refundCount,
      publishedReports: reports.publishedReports,
      openSupportTickets: support.openTickets,
      urgentSupportTickets: support.urgentTickets,
      complaintsThisMonth: support.complaintsThisMonth,
      documents: documents.documents,
      printOrders: documents.printOrders,
    },
    revenue,
    orders,
    customers,
    distributors,
    warehouse,
    payments,
    reports,
    leads,
    support,
    documents,
    operational,
  };
}

export async function getAnalyticsFilterOptions(scope: AnalyticsScope = {}) {
  const [cities, customers, distributors] = await Promise.all([
    prisma.order.findMany({ where: { ...directTenantWhere(scope), ...productionOrderWhere() }, select: { city: true }, distinct: ["city"], orderBy: { city: "asc" } }),
    prisma.customerProfile.findMany({ where: { ...directTenantWhere(scope), ...productionCustomerWhere() }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
    prisma.distributorProfile.findMany({ where: { user: { ...productionUserWhere(), ...(scope.tenantId ? { tenantId: scope.tenantId } : {}) } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);

  return {
    cities: cities.map((item) => item.city),
    customers,
    distributors: distributors.map((item) => ({ id: item.id, name: `${item.firstName} ${item.lastName}` })),
    statuses: [...Object.values(OrderStatus), ...Object.values(PaymentStatus), ...Object.values(TourStatus)],
  };
}

export async function getAnalyticsExportRows(filters: AnalyticsFilters, scope: AnalyticsScope = {}) {
  const orders = await prisma.order.findMany({
    where: orderWhere(filters, "createdAt", scope),
    include: {
      customer: { select: { companyName: true } },
      payments: { select: { status: true, amount: true, paidAt: true } },
      assignedDistributor: { select: { firstName: true, lastName: true } },
      tours: { select: { status: true, completedAt: true, distanceMeters: true, durationSeconds: true } },
      reports: { select: { status: true, reportNumber: true, generatedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((order) => {
    const paidAmount = order.payments
      .filter((payment) => PAID_PAYMENT_STATUSES.includes(payment.status))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    const latestTour = order.tours[0];
    const latestReport = order.reports[0];
    return {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      city: order.city,
      customer: order.customer.companyName,
      distributor: order.assignedDistributor ? `${order.assignedDistributor.firstName} ${order.assignedDistributor.lastName}` : "",
      status: order.status,
      flyerQuantity: order.flyerQuantity,
      paidAmount: round(paidAmount),
      paymentStatus: order.payments[0]?.status ?? "",
      tourStatus: latestTour?.status ?? "",
      reportStatus: latestReport?.status ?? "",
      reportNumber: latestReport?.reportNumber ?? "",
      tourDistanceKm: latestTour?.distanceMeters ? round(latestTour.distanceMeters / 1000) : 0,
      tourDurationHours: latestTour?.durationSeconds ? round(latestTour.durationSeconds / 3600) : 0,
    };
  });
}

export function analyticsRowsToCsv(rows: Array<Record<string, string | number>>) {
  const headers = [
    "orderNumber",
    "createdAt",
    "city",
    "customer",
    "distributor",
    "status",
    "flyerQuantity",
    "paidAmount",
    "paymentStatus",
    "tourStatus",
    "reportStatus",
    "reportNumber",
    "tourDistanceKm",
    "tourDurationHours",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";")),
  ].join("\n");
}
