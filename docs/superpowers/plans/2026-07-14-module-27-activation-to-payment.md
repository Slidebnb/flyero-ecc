# FLYERO Modul 27: Activation-to-Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden öffentlichen Planner sicher von der Preisvorschau über progressive Registrierung und E-Mail-Bestätigung bis zu einem wiederaufnehmbaren Stripe-Checkout führen, ohne einen zweiten Planner, eine zweite Preisberechnung oder ein zweites Zahlungssystem zu bauen.

**Architecture:** Der bestehende `SmartOrderWizard` bleibt Orchestrator. Ein zentraler Redirect-Helper validiert interne Fortsetzungspfade; `EmailVerificationToken.redirectPath` hält diesen Pfad serverseitig. Eine gemeinsame Profilvollständigkeitsfunktion wird von Checkout, Profilvervollständigung und Auftragsansicht verwendet. Der Checkout verwendet weiterhin `createCheckoutForOrder`, wird bei unvollständigem Profil strukturiert mit HTTP 422 blockiert und nach Profilergänzung mit derselben Order fortgesetzt.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, PostgreSQL, Stripe Checkout, bestehende FLYERO-APIs und Smoke-Tests.

## Global Constraints

- Bestehenden öffentlichen Planner, `SmartOrderWizard`, Draft-Handoff, Auth, Tenant-Scope, Stripe Checkout und Webhook wiederverwenden.
- Keine zweite Planner-, Registration-, Payment-, Preis- oder Rechnungslogik erstellen.
- Preisstaffeln, Mindestauftrag, MwSt., Preispropagation und Snapshots in diesem Modul nicht verändern.
- Keine Franchise-, MFA-, SSO-, Stripe-Elements-, CRM-, Karten- oder Website-Neuentwicklung.
- Ausschließlich relative interne Redirects erlauben; externe, `javascript:`- und `data:`-Ziele verwerfen.
- Rechnungs- und Lieferdaten gehören nicht in das erste Kundenregistrierungsformular.
- Unvollständige Kundenprofile dürfen planen, registrieren, verifizieren, einloggen und Anfragen speichern, aber keinen Checkout starten.
- Keine Tokens, Passwörter, vollständigen Adressen, E-Mail-Adressen oder Telefonnummern in Funnel-Events speichern.
- Keine Migration löschen, keinen PostgreSQL-Port ändern und keine Produktionsannahmen als extern verifiziert ausgeben.

## Bestandsmatrix

| Bereich | Status vor Modul 27 | Quelle | Modul-27-Aktion |
|---|---|---|---|
| Öffentlicher Planner und Quote | vorhanden und korrekt | `src/app/verteilung-planen/page.tsx`, `SmartOrderWizard.tsx` | wiederverwenden, Handoff korrigieren |
| Browser-Draft v2 und Mehrgebiete | vorhanden und korrekt | `SmartOrderWizard.tsx` | Draft nur nach Order-Erstellung löschen |
| Kundenregistrierung und Tenant-Erstellung | vorhanden, aber unvollständig | `register-customer/route.ts`, `validators.ts` | progressive UI, optionale API-Felder behalten |
| E-Mail-Verifizierung | vorhanden, aber unvollständig | `EmailVerificationToken`, Auth-Routen | `redirectPath` serverseitig speichern und zurückgeben |
| Redirect-Sicherheit | fehlerhaft/irreführend | lokale `safeNext()`-Funktionen | einen zentralen Helper verwenden |
| Checkout | vorhanden, aber unvollständig | `payments.ts`, Checkout-Route | strukturierter Profilfehler, gleiche Order/Session wiederaufnehmen |
| Profilseite | vorhanden | `customer/profile/page.tsx`, Profil-API | fokussierte Ergänzungsroute ergänzen |
| Funnel-Events | vorhanden, aber fachlich unvollständig | Planner- und Experience-APIs | `CHECKOUT_STARTED` erst mit echter Order und Checkout-Aufruf erfassen |
| Stripe-Webhooks, Preis und Rechnungen | nicht Teil dieses Moduls | bestehende Services | unverändert lassen |
| Franchise-/Enterprise-Funktionen | nicht Teil dieses Moduls | Projektscope | nicht vorziehen |

---

### Task 1: Failing contract tests and safe redirect foundation

**Files:**
- Create: `tests/registration-progressive-smoke.mjs`
- Create: `tests/verification-continuation-smoke.mjs`
- Create: `tests/activation-handoff-smoke.mjs`
- Modify: `package.json`
- Create: `src/lib/redirects.ts`
- Create: `docs/superpowers/plans/2026-07-14-module-27-activation-to-payment.md`

**Interfaces:**
- Produces `safeInternalRedirectPath(value: unknown, fallback: string): string`.
- `safeInternalRedirectPath` accepts only paths beginning with `/customer/`, `/register/`, or `/login`; it rejects `//`, absolute URLs, `javascript:`, `data:`, encoded control characters, and malformed values.

- [x] Write the static tests for one short progressive form, server-side continuation storage, no public `CHECKOUT_STARTED`, and centralized redirect validation.
- [x] Run `npm run test:registration-progressive` and `npm run test:verification-continuation`; expected initial result is red until the source contracts exist.
- [ ] Implement `src/lib/redirects.ts` and wire the scripts without changing business behavior.
- [ ] Run the two tests again and require green output.

### Task 2: Server-side verification continuation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260714100000_add_email_verification_redirect_path/migration.sql`
- Modify: `src/lib/verificationEmail.ts`
- Modify: `src/app/api/auth/register-customer/route.ts`
- Modify: `src/app/api/auth/resend-verification/route.ts`
- Modify: `src/app/api/auth/verify-email/route.ts`
- Modify: `src/app/register/customer/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/verify-email/VerifyEmailForm.tsx`

**Interfaces:**
- `createEmailVerificationToken(userId: string, redirectPath?: string)` stores only the validated relative path.
- Verification JSON returns `{ ok: true, data: { userId, role, status, redirectTo } }`.
- `redirectTo` is `/login?next=<stored path>` for valid continuation paths and the role home otherwise.

- [ ] Add nullable `EmailVerificationToken.redirectPath` and the additive SQL migration.
- [ ] Refactor registration and resend to pass the central helper result and preserve the latest valid continuation.
- [ ] Make verification use the stored continuation for JSON and HTML redirects, with role fallback for legacy tokens.
- [ ] Make the verification UI automatically continue to the returned login URL and state honestly that browser drafts stay on the original device.
- [ ] Run `npx prisma generate`, `npx prisma migrate deploy`, and `npm run test:verification-continuation`.

### Task 3: Progressive registration and shared profile completeness

**Files:**
- Modify: `src/app/register/customer/CustomerRegisterForm.tsx`
- Create: `src/lib/customerProfileCompleteness.ts`
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/payments.ts`
- Create: `tests/profile-completion-checkout-smoke.mjs`

**Interfaces:**
- `BillingProfileField` is exactly `companyName | contactName | phone | billingStreet | billingPostalCode | billingCity`.
- `getCustomerProfileCompleteness(customer: CustomerProfileLike): { complete: boolean; missingFields: BillingProfileField[] }` is the only required-field source.
- `CustomerProfileIncompleteError` exposes `code`, `missingFields`, and `orderId`.

- [ ] Add a failing test that asserts the first registration form contains only company, contact, email, optional phone, and password while the API schema still accepts legacy optional fields.
- [ ] Add shared completeness logic and make `createCheckoutForOrder` use it.
- [ ] Add structured error fields without changing the existing required-field rule.
- [ ] Run the focused tests and verify that incomplete profiles produce no payment record or failed payment status.

### Task 4: Focused profile completion and checkout continuation

**Files:**
- Create: `src/app/customer/profile/complete/page.tsx`
- Create: `src/app/customer/profile/complete/ProfileCompletionForm.tsx`
- Create: `src/app/api/customer/profile/complete/route.ts`
- Modify: `src/app/api/customer/profile/route.ts`
- Modify: `src/app/api/payments/checkout/route.ts`
- Modify: `src/app/customer/orders/[id]/page.tsx`
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify: `src/app/customer/profile/page.tsx`

**Interfaces:**
- `POST /api/customer/profile/complete` requires tenant session and an owned `orderId`; it updates only the required profile fields, calls `createCheckoutForOrder` once, and returns `{ checkoutUrl, orderId, redirectTo }`.
- Foreign or unknown order IDs return 404 without revealing order data.
- Checkout profile errors return HTTP 422 with `code`, `missingFields`, and `/customer/profile/complete?orderId=...`.

- [x] Add a failing smoke assertion for structured HTTP 422 and the focused profile route.
- [x] Implement the tenant-scoped completion page/form and server endpoint.
- [x] Route wizard and order-detail checkout to the same completion URL instead of a generic payment error.
- [x] Reuse existing open Checkout sessions/payments where valid; do not create a second order or second open session.
- [x] Verify genuine Stripe/configuration failures remain genuine payment errors.

### Task 5: Funnel events and draft handoff correctness

**Files:**
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify: `src/app/api/public/planner/experience/route.ts`
- Modify: `src/app/api/maps/experience/route.ts`
- Create: `tests/planner-funnel-events-smoke.mjs`
- Create: `tests/activation-handoff-smoke.mjs`

**Interfaces:**
- Public planner emits `AUTH_GATE_VIEWED`, never `CHECKOUT_STARTED`.
- Authenticated planner sends `CHECKOUT_STARTED` only after an order ID exists and immediately before calling `/api/payments/checkout`.
- Draft migration preserves `flyero:order-planner:public-draft:v2` to `flyero:order-planner:draft:v2`; it is removed only after order creation succeeds.

- [x] Add failing event-contract assertions for public/authenticated event ordering and no duplicate render event.
- [x] Move the authenticated checkout event to the real checkout branch with order linkage.
- [x] Keep inquiry flow payment-free and keep its draft behavior explicit.
- [x] Limit public event types so public callers cannot claim authenticated checkout.
- [x] Run `npm run test:planner-funnel-events` and `npm run test:activation-handoff`.

### Task 6: Regression suite, documentation, browser QA, and delivery

**Files:**
- Modify: `README.md`
- Modify: `TECHNICAL_DUE_DILIGENCE_AUDIT_2026-07-12.md`
- Modify: `BETA_RELEASE_CHECKLIST.md`
- Modify: `KNOWN_ISSUES.md`
- Modify: `package.json`

- [x] Add `test:registration-progressive`, `test:verification-continuation`, `test:activation-handoff`, `test:profile-completion-checkout`, `test:planner-funnel-events`, and aggregate `test:module27` without removing existing scripts.
- [ ] Run Prisma generate, all required Module 26 and security regressions, Module 27 tests, lint, TypeScript, and build.
- [ ] Browser-check desktop and mobile planner/auth/profile completion states at 375x812 and 390x844, including no horizontal overflow.
- [x] Document start commit, branch, matrix, closed issues, reused systems, migration, API changes, redirect model, profile model, checkout resume, events, checks, and honest remaining risks.
- [ ] Run `git diff --check`, inspect `git status`, commit intentionally, and push `codex/module-27-activation-to-payment`.

## Verification commands

```text
npm run prisma:generate
npm run test:module26
npm run test:auth-ux
npm run test:customer-order-area
npm run test:customer-order-checkout
npm run test:customer-portal-ux
npm run test:permissions
npm run test:tenant-foundation
npm run test:tenant-policy
npm run test:tenant-ab-idor
npm run test:public-abuse
npm run test:auth-abuse
npm run test:payment-production-guard
npm run test:module27
npm run lint
npx tsc --noEmit
npm run build
```
