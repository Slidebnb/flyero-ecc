import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCustomerNotificationEmail } from '../src/lib/customerEmailTemplate.ts';

test('HTML checkout redirects permit only the Stripe checkout origin in addition to self', () => {
  const caddy = readFileSync('Caddyfile', 'utf8');
  const sources = caddy.match(/form-action ([^;]+)/)[1].split(/\s+/);
  assert.deepEqual(sources, ["'self'", 'https://checkout.stripe.com']);
});

test('creation and acceptance supply durable authenticated order links', () => {
  const creation = readFileSync('src/app/api/customer/orders/route.ts', 'utf8');
  const review = readFileSync('src/lib/orderReviewWorkflow.ts', 'utf8');
  assert.match(creation, /campaignUrl: publicUrl\(`/);
  assert.match(creation, /createCheckoutForOrder\(/, 'Direkte Aufträge müssen den Stripe-Checkout vor der Kundenmail erzeugen.');
  assert.match(creation, /paymentUrl: paymentUrl \?\?/);
  assert.match(creation, /dispatchNotificationImmediately\(customerNotification\.queue\?\.id\)/);
  assert.match(review, /campaignUrl: publicUrl\(`/);
});

test('failed payments provide a fresh retry link and are emailed immediately', () => {
  const payments = readFileSync('src/lib/payments.ts', 'utf8');
  assert.match(payments, /payment\.retry_link_deferred/);
  assert.match(payments, /retryPaymentUrl/);
  assert.match(payments, /type: "PAYMENT_FAILED"[\s\S]{0,900}paymentUrl: retryPaymentUrl/);
  assert.match(payments, /dispatchNotificationImmediately\(customerNotification\.queue\?\.id\)/);
});

test('payment email has a real absolute payment action ahead of the generic dashboard', () => {
  process.env.APP_URL = 'https://flyero.org';
  const email = buildCustomerNotificationEmail({
    type: 'ORDER_ACCEPTED_PAYMENT_REQUIRED', subject: 'Anfrage angenommen',
    body: 'Bitte schließen Sie die Zahlung ab.',
    data: { dashboardUrl: '/customer/dashboard', paymentUrl: '/customer/orders/order-123' },
  });
  assert.match(email.html, /href="https:\/\/flyero.org\/customer\/orders\/order-123"/);
  assert.match(email.html, /Zahlung im Kundenportal starten/);
  assert.match(email.text, /https:\/\/flyero.org\/customer\/orders\/order-123/);
});

test('unsafe email targets do not become actions', () => {
  for (const url of ['javascript:alert(1)', '//evil.invalid/path', '/\\evil.invalid/path']) {
    const email = buildCustomerNotificationEmail({type:'ORDER_SUBMITTED', subject:'Auftrag',body:'Erstellt',data:{campaignUrl:url}});
    assert.doesNotMatch(email.html, /href="(?:javascript:|.*evil\.invalid)/);
  }
});

test('admin shows the saved order geometry before review, never the mutable area template', () => {
  const page = readFileSync('src/app/admin/orders/[id]/page.tsx', 'utf8');
  assert.match(page, /DistributionAreaPreviewMap geoJson=\{order\.targetAreaGeoJson\}/);
  assert.match(page, /DistributionAreaPreviewMap geoJson=\{segment\.geometryGeoJson\}/);
  assert.ok(page.indexOf('title="Gespeichertes Verteilgebiet"') < page.indexOf('Prüfung und Entscheidung'));
});
