# FLYERO Public Website Humanization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public FLYERO website understandable and trustworthy for normal business customers by removing internal/technical wording, clarifying the primary action on each public page, and keeping the existing premium visual direction and planner behavior intact.

**Architecture:** Centralize public customer wording in the existing marketing components/data where possible. Keep maps, pricing, checkout, lead APIs, database models, authentication, and server-side calculations unchanged. Reuse the existing footer/navigation and existing page templates instead of creating parallel public systems.

**Tech Stack:** Next.js App Router, React, TypeScript, existing `src/app/components/marketing` primitives, existing marketing CSS, Node smoke tests, Playwright screenshots.

## Global Constraints

- No changes to Maps, pricing, Stripe, checkout, database, roles, APIs, or server services.
- Do not introduce visible Demo, Mock, Seed, Fallback, Quote, Fingerprint, internal IDs, raw JSON, or technical customer-facing status wording.
- Keep the existing editorial/open FLYERO design; no new card-grid or visual system.
- Preserve the own-printed-flyer workflow: customers provide already-printed material and send it to the assigned FLYERO warehouse.
- Keep `hallo@flyero.org` visible as plain text where requested; do not force a mail client for the public inquiry contact.
- Every changed customer-facing contract receives a regression assertion.

## 1. Baseline and Regression Contract

- [ ] Inspect all public route sources, shared marketing components, industry/occasion data, legal pages, sitemap, and current public smoke tests.
- [ ] Add `tests/public-humanization-smoke.mjs` covering all scoped routes and shared public sources.
- [ ] Assert forbidden internal wording is absent from public customer copy.
- [ ] Assert the own-printed-flyer/warehouse wording and visible `hallo@flyero.org`/PDF contract remain present.
- [ ] Run the new test before production edits and record the expected failure.

## 2. Shared Public Copy and Navigation

- [ ] Replace technical shared labels such as `Dispatch` with customer language such as `Verteilung und Nachweis`.
- [ ] Keep evidence language honest: GPS, photos, and PDF are described as documents that appear after the completed distribution and review.
- [ ] Keep the footer discoverable: inquiry, PDF download, contact, legal pages, industry pages, and occasion pages.
- [ ] Keep the public navigation focused on Leistungen, Ablauf, Zielgruppen, Preise, Kontakt, Login, and Anfrage.

## 3. Route-Level Humanization

- [ ] Update public page copy only where it contains internal process terms, unclear technical labels, or competing CTA hierarchy.
- [ ] Keep one dominant customer action per page and at most one supporting action.
- [ ] Improve inquiry-page labels so the customer understands booking, inquiry, PDF download, and the visible email address without technical instructions.
- [ ] Update shared industry/occasion wording where it exposes internal operations while preserving SEO intent and page-specific content.
- [ ] Audit legal pages without changing legal meaning or inventing legal claims.

## 4. Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run the new humanization smoke test.
- [ ] Run `npm run test:inquiry-form-contact`.
- [ ] Run `npm run test:seo-sitemap`.
- [ ] Run `npm run test:public-link-integrity` against a local server.
- [ ] Run `npm run test:module28` against a local server where environment allows.
- [ ] Produce fresh 1440px desktop and 390px mobile screenshots for `/`, `/verteilung-anfragen`, `/preise`, and one industry page.
- [ ] Inspect screenshots with image inspection and record any failed browser/API evidence honestly.

## 5. Delivery Evidence

- [ ] Review `git diff`, `git status`, and changed-file scope.
- [ ] Commit only the scoped implementation and test/doc changes.
- [ ] Push only after local verification passes.
- [ ] Deploy through the existing approved production path only after CI/deploy gates pass.
- [ ] Verify remote SHA, image/container health, migrations, `https://flyero.org/api/health`, and the changed public routes before calling the change live.

## Files Expected To Change

- `tests/public-humanization-smoke.mjs`
- `src/app/components/marketing/index.tsx`
- `src/app/components/marketing/IndustryLandingPage.tsx`
- `src/app/components/marketing/FlyerDistributionPillarPage.tsx`
- `src/app/page.tsx`
- `src/app/so-funktionierts/page.tsx`
- `src/app/verteilung-anfragen/page.tsx`
- `src/app/fuer-unternehmen/page.tsx`
- `src/app/fuer-verteiler/page.tsx`
- `src/app/kontakt/page.tsx`
- `src/app/preise/page.tsx`
- `src/app/branchen/industryData.ts`
- `src/app/anlaesse/occasionData.ts`

Only files with confirmed public-copy findings will be changed. Legal, planner, checkout, API, database, pricing, and infrastructure files remain unchanged unless the baseline proves a public-copy issue in one of them.
