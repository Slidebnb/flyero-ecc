import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { mockPaymentsEnabled } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MockStripeCheckoutPage({ params }: PageProps) {
  if (!mockPaymentsEnabled()) {
    return (
      <main className="appShell">
        <section className="panel stack">
          <h1>Mock Checkout deaktiviert</h1>
          <Link href="/customer/orders">Zurueck zu den Auftraegen</Link>
        </section>
      </main>
    );
  }
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const payment = await prisma.payment.findFirst({
    where: { id, order: { customer: { userId: session.id } } },
    include: { order: true },
  });

  if (!payment) {
    return (
      <main className="appShell">
        <section className="panel stack">
          <h1>Testzahlung nicht gefunden</h1>
          <Link href="/customer/orders">Zurück zu den Aufträgen</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <section className="panel stack" style={{ maxWidth: 720, margin: "48px auto" }}>
        <p className="eyebrow">Stripe Testmodus</p>
        <h1>Mock Checkout</h1>
        <p className="lead">
          Lokaler Test-Checkout für Auftrag {payment.order.orderNumber}. Es werden keine echten Kartendaten verarbeitet.
        </p>
        <div className="gridCards">
          <article className="card"><strong>{formatCurrency(payment.amount)}</strong><span>Betrag</span></article>
          <article className="card"><strong>{payment.status}</strong><span>Status</span></article>
        </div>
        <form action={`/api/payments/mock-complete/${payment.id}`} method="post">
          <button type="submit">Testzahlung erfolgreich abschliessen</button>
        </form>
        <Link className="textLink" href={`/customer/orders/${payment.orderId}`}>Zurueck zum Auftrag</Link>
      </section>
    </main>
  );
}
