# Stripe Promotion Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable customer-entered Stripe promotion codes in the existing hosted Checkout flow without changing FLYERO pricing rules or adding a new redemption table.

**Architecture:** Set Stripe Checkout's `allow_promotion_codes` flag in the single central session factory. Keep the existing base pricing snapshot immutable as the original quote. After Stripe confirms payment, normalize the actually charged gross amount and discount into existing `Payment.metadata`, update the existing Order totals to the charged amount, and let existing invoice/portal readers use those final Order totals. Preserve the raw Stripe event in `PaymentEvent`.

**Tech Stack:** Next.js, TypeScript, Stripe Checkout, Prisma/PostgreSQL, existing payment and integrity services.

## Global Constraints

- No new database table or migration unless the current `Payment.metadata` and `PaymentEvent.payload` are proven insufficient.
- No client-side price authority and no change to the existing base pricing formula.
- Existing orders and payments without a promotion remain behaviorally unchanged.
- A confirmed Stripe amount of zero is valid and must not be replaced by the pre-discount amount.
- Checkout remains idempotent through the existing payment claim flow.

## Tasks

- [ ] Add a focused regression smoke test for the central Checkout flag and post-payment discount normalization.
- [ ] Add the minimal Stripe Checkout option in `src/lib/payments.ts`.
- [ ] Normalize confirmed Stripe totals into existing payment metadata and Order totals after webhook confirmation.
- [ ] Keep order integrity checks strict for both discounted and non-discounted payments.
- [ ] Run focused payment/order tests, lint, typecheck, Prisma generation, and production build.
- [ ] Report deployment/live verification separately from local verification.
