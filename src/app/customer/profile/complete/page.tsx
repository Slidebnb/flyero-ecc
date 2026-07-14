import { notFound } from "next/navigation";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection } from "@/app/PortalComponents";
import { ProfileCompletionForm } from "@/app/customer/profile/complete/ProfileCompletionForm";
import { asObject, formatCurrency } from "@/lib/format";
import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOrderGrossPrice } from "@/lib/pricing";

type PageProps = { searchParams?: Promise<{ orderId?: string }> };

export default async function CustomerProfileCompletionPage({ searchParams }: PageProps) {
  const session = await requireTenantSession();
  const params = searchParams ? await searchParams : {};
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  if (!orderId) notFound();

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenantId: session.tenantId,
      customer: { userId: session.id, tenantId: session.tenantId },
    },
    include: { customer: true },
  });
  if (!order) notFound();

  const billing = asObject(order.customer.billingAddress);
  return (
    <CustomerPortalShell active="/customer/profile" eyebrow="Sichere Zahlung" title="Rechnungsdaten ergänzen" description="Nur die Angaben, die FLYERO für diesen Auftrag und die Rechnung benötigt.">
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Kampagne {order.orderNumber}</span>
          <h2>Fast geschafft.</h2>
          <p>Nach dem Speichern wirst du direkt zur Zahlung weitergeleitet. Es wird kein neuer Auftrag angelegt.</p>
        </div>
        <strong>{formatCurrency(getOrderGrossPrice(order))} brutto</strong>
      </section>
      <DataSection title="Rechnungsdaten" description="Diese Angaben werden für Rückfragen und die Rechnung verwendet.">
        <ProfileCompletionForm
          orderId={order.id}
          defaults={{
            companyName: order.customer.companyName,
            contactName: order.customer.contactName,
            phone: order.customer.phone,
            billingStreet: String(billing.street || ""),
            billingHouseNumber: String(billing.houseNumber || ""),
            billingPostalCode: String(billing.postalCode || ""),
            billingCity: String(billing.city || ""),
            vatId: order.customer.vatId || "",
          }}
        />
      </DataSection>
    </CustomerPortalShell>
  );
}
