import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let baseUrl = process.env.BETA_BASE_URL || `http://localhost:${process.env.BETA_PORT || "3024"}`;
const PASSWORD = "DemoPasswort123!";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOk(path, options = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return response;
}

async function ensureServer() {
  const candidates = [
    baseUrl,
    "http://localhost:3025",
    "http://localhost:3024",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ];

  for (const candidate of candidates) {
    try {
      baseUrl = candidate;
      const response = await fetchOk("/api/health");
      if (response.status < 500) return null;
    } catch {
      // Try the next candidate.
    }
  }

  baseUrl = process.env.BETA_BASE_URL || `http://localhost:${process.env.BETA_PORT || "3024"}`;
  const env = { ...process.env, PORT: new URL(baseUrl).port || "3024" };
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchOk("/api/health");
      if (response.status < 500) return child;
    } catch {
      // Server is still booting.
    }
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Beta-Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response, previous = "") {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return previous;
  const next = setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
  return [previous, next].filter(Boolean).join("; ");
}

async function jsonRequest(path, { method = "GET", cookie = "", body, expected = [200] } = {}) {
  const response = await fetchOk(path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!expected.includes(response.status)) {
    throw new Error(`${method} ${path} erwartete ${expected.join("/")} bekam ${response.status}: ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login(email, ip) {
  const response = await fetchOk("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(response.status === 200, `Login fehlgeschlagen fuer ${email}: ${response.status} ${await response.text()}`);
  return cookieHeaderFrom(response);
}

async function pageStatus(path, cookie = "") {
  const response = await fetchOk(path, { headers: cookie ? { cookie } : {} });
  return response.status;
}

async function pageOk(path, cookie, label) {
  const status = await pageStatus(path, cookie);
  assert(status === 200, `${label} (${path}) lieferte ${status}`);
}

async function main() {
  const server = await ensureServer();
  try {
    if (process.env.BETA_RESET_RATE_LIMITS !== "false") {
      await prisma.authRateLimitBucket.deleteMany({});
    }
    const unique = Date.now();
    const email = `beta.customer.${unique}@example.com`;

    const register = await jsonRequest("/api/auth/register-customer", {
      method: "POST",
      expected: [201],
      body: {
        companyName: "Beta Audit GmbH",
        contactName: "Berta Beta",
        email,
        phone: "+49 261 555000",
        billingStreet: "Betaweg",
        billingHouseNumber: "15",
        billingPostalCode: "56068",
        billingCity: "Koblenz",
        password: PASSWORD,
      },
    });
    assert(register.data.verificationToken, "Registrierung lieferte keinen Test-Verifizierungstoken.");

    await jsonRequest("/api/auth/verify-email", {
      method: "POST",
      body: { token: register.data.verificationToken },
    });

    const customerCookie = await login(email, "198.51.100.201");
    const adminCookie = await login("admin@example.com", "198.51.100.202");
    const warehouseCookie = await login("warehouse@example.com", "198.51.100.203");
    const distributorCookie = await login("verteiler.approved1@example.com", "198.51.100.204");
    const pendingDistributorCookie = await login("verteiler.pending1@example.com", "198.51.100.205");

    await pageOk("/login", "", "Login-Seite");
    await pageOk("/customer/dashboard", customerCookie, "Customer Dashboard");
    await pageOk("/customer/orders", customerCookie, "Customer Orders");
    await pageOk("/customer/payments", customerCookie, "Customer Payments");
    await pageOk("/customer/invoices", customerCookie, "Customer Invoices");
    await pageOk("/customer/reports", customerCookie, "Customer Reports");
    await pageOk("/distributor/dashboard", distributorCookie, "Distributor Dashboard");
    await pageOk("/warehouse/dashboard", warehouseCookie, "Warehouse Dashboard");
    await pageOk("/admin/dashboard", adminCookie, "Admin Dashboard");
    await pageOk("/admin/dispatch", adminCookie, "Admin Dispatch");
    await pageOk("/admin/reports", adminCookie, "Admin Reports");
    await pageOk("/admin/payments", adminCookie, "Admin Payments");
    await pageOk("/admin/settings", adminCookie, "Admin Settings");
    await pageOk("/admin/accounting", adminCookie, "Admin Accounting");
    await pageOk("/admin/notifications", adminCookie, "Admin Notifications");

    assert((await pageStatus("/admin/dashboard", customerCookie)) === 307, "Kunde wurde nicht von Adminseite weggeleitet.");
    assert((await pageStatus("/customer/dashboard", distributorCookie)) === 307, "Verteiler wurde nicht von Kundenseite weggeleitet.");
    assert((await pageStatus("/customer/dashboard", warehouseCookie)) === 307, "Lager wurde nicht von Kundenseite weggeleitet.");
    assert((await pageStatus("/admin/dashboard")) === 307, "Nicht eingeloggter Nutzer wurde nicht zum Login umgeleitet.");
    assert((await pageStatus("/distributor/dashboard", pendingDistributorCookie)) === 200, "Pending-Verteiler-Demo-Login funktioniert nicht.");

    const startDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString();
    const endDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString();
    const planningQuote = await jsonRequest("/api/public/planner/quote", {
      method: "POST",
      expected: [200],
      body: {
        city: "Koblenz",
        postalCode: "56068",
        street: "Betaallee",
        houseNumber: "7",
        flyerQuantity: 1400,
        coverageAreaSqm: 640000,
        flyerSource: "CUSTOMER_OWN",
        printDataStatus: "UPLOAD_LATER",
        preferredStartDate: startDate,
        preferredEndDate: endDate,
      },
    });
    assert(planningQuote.data.metrics.fingerprint, "Beta-Planungsquote lieferte keinen Quote-Fingerprint.");
    const orderResponse = await jsonRequest("/api/customer/orders", {
      method: "POST",
      cookie: customerCookie,
      expected: [201],
      body: {
        serviceType: "FLYER_DISTRIBUTION",
        city: "Koblenz",
        postalCode: "56068",
        street: "Betaallee",
        houseNumber: "7",
        targetAreaName: "Beta Zentrum",
        areaType: "CITY",
        estimatedHouseholds: 1200,
        estimatedFlyers: 1300,
        flyerQuantity: 1400,
        coverageAreaSqm: 640000,
        flyerSource: "CUSTOMER_OWN",
        preferredStartDate: startDate,
        preferredEndDate: endDate,
        flexibleScheduling: true,
        contactPerson: "Berta Beta",
        contactPhone: "+49 261 555000",
        notes: "Beta E2E Smoke Auftrag",
        quoteFingerprint: planningQuote.data.metrics.fingerprint,
      },
    });
    const orderId = orderResponse.data.id;

    const invalidTransition = await fetchOk(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { cookie: adminCookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "READY_FOR_PICKUP" }),
    });
    assert(invalidTransition.status === 409, `Ungueltiger Order-Statuswechsel wurde nicht blockiert (${invalidTransition.status}): ${await invalidTransition.text()}`);

    const checkout = await jsonRequest("/api/payments/checkout", {
      method: "POST",
      cookie: customerCookie,
      body: { orderId },
    });
    assert(checkout.data.checkoutUrl?.includes("/mock-stripe/checkout/"), "Checkout nutzt keinen lokalen Mock/Test-Pfad.");
    await pageOk(new URL(checkout.data.checkoutUrl).pathname, customerCookie, "Mock Stripe Checkout");
    await jsonRequest(`/api/payments/mock-complete/${checkout.data.id}`, {
      method: "POST",
      cookie: customerCookie,
    });

    await jsonRequest(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "APPROVED", note: "Beta-Smoke genehmigt" },
    });
    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    assert(invoice, "Rechnung wurde nach Admin-Genehmigung nicht erzeugt.");
    const pricedOrder = await prisma.order.findUnique({ where: { id: orderId } });
    assert(pricedOrder, "Bestellung fuer Rechnungspruefung fehlt.");
    const expectedNet = pricedOrder.manualPriceOverride ?? pricedOrder.calculatedNetPrice;
    assert(invoice.subtotalNet.equals(expectedNet), "Rechnung verwendet nicht den gleichen Nettopreis wie der Auftrag.");
    assert(pricedOrder.manualPriceOverride !== null || invoice.totalGross.equals(pricedOrder.calculatedGrossPrice), "Rechnung und gespeicherter Auftragspreis laufen auseinander.");

    const warehouseUser = await prisma.user.findUnique({
      where: { email: "warehouse@example.com" },
      include: { warehouse: { include: { locations: true } } },
    });
    const warehouse = warehouseUser?.warehouse;
    assert(warehouse?.locations[0], "Warehouse Seed-Daten fuer Demo-Lager fehlen.");
    const checkin = await jsonRequest("/api/warehouse/checkin", {
      method: "POST",
      cookie: warehouseCookie,
      body: {
        orderId,
        warehouseId: warehouse.id,
        warehouseLocationId: warehouse.locations[0].id,
        cartonCount: 2,
        receivedFlyers: 1400,
        damagedFlyers: 0,
        notes: "Beta-Smoke Checkin",
      },
    });
    const inventoryId = checkin.data.id;
    await jsonRequest("/api/warehouse/qrcode", {
      method: "POST",
      cookie: warehouseCookie,
      body: { inventoryId },
    });
    const readyInventory = await jsonRequest("/api/warehouse/status", {
      method: "PATCH",
      cookie: warehouseCookie,
      body: { inventoryId, status: "READY_FOR_PICKUP", remainingFlyers: 1400 },
    });

    const distributor = await prisma.distributorProfile.findFirst({
      where: { user: { email: "verteiler.approved1@example.com" } },
      include: { user: true },
    });
    assert(distributor, "Approved-Verteiler fehlt.");
    await jsonRequest(`/api/admin/orders/${orderId}/assign`, {
      method: "POST",
      cookie: adminCookie,
      body: { distributorId: distributor.id },
    });
    await jsonRequest(`/api/distributor/orders/${orderId}/accept`, {
      method: "POST",
      cookie: distributorCookie,
    });
    const assignedTour = await prisma.distributionTour.findFirst({ where: { orderId, distributorId: distributor.id }, orderBy: { createdAt: "desc" } });
    assert(assignedTour, "Tour wurde nach Dispatch-Annahme nicht erzeugt.");

    await jsonRequest(`/api/distributor/tours/${assignedTour.id}/pickup`, {
      method: "POST",
      cookie: distributorCookie,
      body: { qrCode: readyInventory.data.qrCode },
    });
    await jsonRequest(`/api/distributor/tours/${assignedTour.id}/start`, {
      method: "POST",
      cookie: distributorCookie,
      body: { lat: 50.3569, lng: 7.589, accuracy: 15, recordedAt: new Date().toISOString() },
    });
    await jsonRequest(`/api/distributor/tours/${assignedTour.id}/gps`, {
      method: "POST",
      cookie: distributorCookie,
      body: {
        points: [
          { lat: 50.357, lng: 7.5891, accuracy: 18, recordedAt: new Date().toISOString() },
          { lat: 50.358, lng: 7.5901, accuracy: 20, recordedAt: new Date(Date.now() + 60000).toISOString() },
        ],
      },
    });
    await jsonRequest(`/api/distributor/tours/${assignedTour.id}/photo`, {
      method: "POST",
      cookie: distributorCookie,
      body: {
        imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        lat: 50.358,
        lng: 7.5901,
        accuracy: 20,
      },
    });
    await jsonRequest(`/api/distributor/tours/${assignedTour.id}/complete`, {
      method: "POST",
      cookie: distributorCookie,
      body: { remainingFlyers: 0, notes: "Beta-Smoke abgeschlossen" },
    });
    await pageOk(`/distributor/tours/${assignedTour.id}`, distributorCookie, "Distributor Tour Detail");

    await jsonRequest(`/api/admin/tours/${assignedTour.id}/approve`, {
      method: "POST",
      cookie: adminCookie,
      body: { note: "Beta-Smoke freigegeben", customerMessage: "Tour geprueft." },
    });
    const reportResponse = await jsonRequest(`/api/admin/tours/${assignedTour.id}/generate-report`, {
      method: "POST",
      cookie: adminCookie,
    });
    const reportId = reportResponse.data.id;
    await jsonRequest(`/api/admin/reports/${reportId}/approve`, {
      method: "POST",
      cookie: adminCookie,
    });
    await jsonRequest(`/api/admin/reports/${reportId}/publish`, {
      method: "POST",
      cookie: adminCookie,
    });
    await pageOk("/customer/reports", customerCookie, "Customer Reports nach Bericht");
    await pageOk("/customer/invoices", customerCookie, "Customer Invoices nach Rechnung");

    const reportDownload = await fetchOk(`/api/customer/reports/${reportId}/download`, { headers: { cookie: customerCookie } });
    assert(reportDownload.status === 200, `Kundenbericht-PDF Download fehlgeschlagen: ${reportDownload.status}`);
    const invoiceDownload = await fetchOk(`/api/customer/invoices/${invoice.id}/download`, { headers: { cookie: customerCookie } });
    assert(invoiceDownload.status === 200, `Kundenrechnung-PDF Download fehlgeschlagen: ${invoiceDownload.status}`);
    const foreignInvoiceDownload = await fetchOk(`/api/customer/invoices/${invoice.id}/download`, { headers: { cookie: distributorCookie } });
    assert([401, 403, 307].includes(foreignInvoiceDownload.status), "Verteiler konnte Kundenrechnung abrufen.");

    const customerReports = await jsonRequest("/api/customer/reports", { cookie: customerCookie });
    const reportJson = JSON.stringify(customerReports);
    assert(!reportJson.includes("birthDate") && !reportJson.includes("taxNumber") && !reportJson.includes("bankAccount"), "Kundenbericht enthaelt Verteiler-Privatdaten.");

    const notifications = await prisma.notificationQueue.groupBy({ by: ["status"], _count: { status: true } });
    assert(notifications.length >= 1, "Notification Queue wurde im Hauptflow nicht genutzt.");

    const finalOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true, invoice: true, warehouseInventory: true, reports: true } });
    assert(finalOrder?.status === "REPORT_READY_PREVIEW", `Finaler Order-Status unerwartet: ${finalOrder?.status}`);
    assert(finalOrder.payments.some((payment) => payment.status === "PAID"), "Payment wurde nicht PAID.");
    assert(finalOrder.invoice?.status === "PAID", "Invoice wurde nicht PAID erstellt.");
    assert(finalOrder.warehouseInventory?.status === "PICKED_UP" || finalOrder.warehouseInventory?.status === "READY_FOR_PICKUP", "Warehouse-Statuskette unerwartet.");
    assert(finalOrder.reports.length >= 1, "Report fehlt am Auftrag.");

    console.log("Beta E2E smoke checks passed.");
  } finally {
    await prisma.$disconnect();
    if (server) server.kill();
  }
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error(error);
  process.exit(1);
});
