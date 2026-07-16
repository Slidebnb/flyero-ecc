# FLYERO Branchen-SEO Seiten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acht eigenständige, indexierbare Branchen-Seiten unter `/branchen/` in das vorhandene FLYERO-Marketing- und SEO-System integrieren.

**Architecture:** Eine zentrale, typisierte Branchen-Datenquelle versorgt eine dynamische Next.js-Route mit individuellen Texten, FAQs und SEO-Metadaten. Ein gemeinsames `IndustryLandingPage`-Layout hält die Marke konsistent, während die Inhalte pro Branche eigenständig bleiben. Sitemap, Robots und Footer greifen auf dieselbe Routenquelle zu.

**Tech Stack:** Next.js App Router, React, TypeScript, bestehende FLYERO-Marketing-Komponenten, `MetadataRoute.Sitemap`, Lucide Icons, bestehende Marketing-CSS-Datei.

## Global Constraints

- Keine Datenbankänderung.
- Keine neue öffentliche Grundgestaltung.
- Keine Dummy-Daten, erfundenen Reichweiten oder ungeprüften Leistungsversprechen.
- Öffentliche Seiten nutzen die bestehende `mk*`-Designsprache.
- SEO-Routen verwenden `https://flyero.org` über die vorhandene `siteUrl`-Konfiguration.
- Jede sichtbare Aussage zu Gebiet, Preis oder Nachweis bleibt fachlich wahr und verständlich.

---

### Task 1: Branchen-Datenmodell und Regressionstest

**Files:**
- Create: `src/app/branchen/industryData.ts`
- Create: `tests/industry-seo-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `industryPages`, `industryPageBySlug`, `industrySeoRoutes` and `IndustryPageData` for the route, footer, SEO metadata and tests.

- [ ] **Step 1: Write the failing test**

The test must assert all eight slugs, unique titles/descriptions, branch-specific phrases, the shared CTA paths and the absence of hardcoded local-only claims.

- [ ] **Step 2: Run the test and verify it fails**

Run `npm run test:industry-seo`. Expected result: the script is unavailable or reports that `src/app/branchen/industryData.ts` is missing.

- [ ] **Step 3: Add the typed data source**

Define eight records with `slug`, `label`, `title`, `description`, `keywords`, `heroLead`, `intro`, `campaignExamples`, `planningNote`, `proofNote`, `faq`, and `iconKey`. Export the array, a slug lookup, and sitemap route metadata. Keep all text in German and avoid invented numbers.

- [ ] **Step 4: Add the npm script and run the test**

Add `"test:industry-seo": "node tests/industry-seo-smoke.mjs"` and expect `Industry SEO smoke checks passed.`

- [ ] **Step 5: Commit the data contract**

```bash
git add src/app/branchen/industryData.ts tests/industry-seo-smoke.mjs package.json
git commit -m "feat: add industry seo content contract"
```

### Task 2: Branchen-Seite und JSON-LD

**Files:**
- Create: `src/app/branchen/[slug]/page.tsx`
- Create: `src/app/components/marketing/IndustryLandingPage.tsx`
- Modify: `src/app/components/marketing/index.tsx`

**Interfaces:**
- Consumes `industryPageBySlug` and `IndustryPageData` from Task 1.
- Produces `generateStaticParams`, `generateMetadata` and a public page for every valid industry slug.

- [ ] **Step 1: Add the failing route assertions**

Extend `tests/industry-seo-smoke.mjs` to assert that the route uses `notFound`, `generateStaticParams`, `generateMetadata`, `MarketingPage`, `IndustryLandingPage` and `createSeoMetadata`.

- [ ] **Step 2: Implement the shared page**

Render an editorial hero, branch-specific use cases, a short planning explanation, a proof/process section, FAQ details, and two CTAs. Use the existing `MarketingPage`, `MarketingContainer`, `MarketingSection`, `MarketingButton`, `PremiumFlyerField`, `TrustBadge`, `FAQItem`, and `defaultProofIcons`.

- [ ] **Step 3: Add branch-specific structured data**

Emit `Service`, `BreadcrumbList`, and `FAQPage` JSON-LD using `absoluteUrl`. Use the actual branch title, description, canonical URL, FAQ questions and answers. Do not emit reviews, ratings, prices, or fabricated business statistics.

- [ ] **Step 4: Run route and landing tests**

Run `npm run test:industry-seo` and `npm run test:module16-landing`. Both must pass.

### Task 3: Footer, Sitemap and Robots

**Files:**
- Modify: `src/app/components/marketing/index.tsx`
- Modify: `src/app/seo.ts`
- Modify: `src/app/robots.ts`
- Modify: `tests/seo-sitemap-smoke.mjs`

**Interfaces:**
- Consumes `industrySeoRoutes` and `industryPages` from Task 1.
- Produces internal links from the public footer and sitemap entries for all eight routes.

- [ ] **Step 1: Extend the SEO smoke test**

Assert that every `/branchen/<slug>` appears in `src/app/seo.ts`, `src/app/robots.ts`, the public footer source and the rendered sitemap contract.

- [ ] **Step 2: Wire the shared route list**

Append `industrySeoRoutes` to `publicSeoRoutes`, allow `/branchen` in `robots.ts`, and add a `Branchen` footer column whose links are generated from `industryPages`.

- [ ] **Step 3: Run the SEO tests**

Run `npm run test:seo-sitemap` and `npm run test:industry-seo`. Expected result: both pass without changing any private route policy.

### Task 4: Premium Responsive Styling

**Files:**
- Modify: `src/app/styles/marketing.css`
- Modify: `tests/module28-public-playwright.mjs` only if a selector contract is required

**Interfaces:**
- Consumes the `mkIndustry*` classes emitted by `IndustryLandingPage`.
- Produces responsive desktop/mobile layout with open editorial sections, no nested card-grid pattern, no text overlap, and visible focus states.

- [ ] **Step 1: Add desktop styling**

Add styles for the hero, use-case list, planning rail, proof note, FAQ and CTA band using existing color variables, borders and spacing. Keep long text in normal flow and use stable grid tracks only where needed for the layout.

- [ ] **Step 2: Add mobile styling**

At the existing mobile breakpoints, collapse columns to one flow, make buttons full width, preserve readable line lengths and ensure the footer remains scannable.

- [ ] **Step 3: Run visual and static checks**

Run `npm run visual:marketing`, `npm run test:module16-landing`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

### Task 5: Final Verification and Publication

**Files:**
- Verify: `src/app/branchen/[slug]/page.tsx`
- Verify: `src/app/components/marketing/IndustryLandingPage.tsx`
- Verify: `src/app/components/marketing/index.tsx`
- Verify: `src/app/seo.ts`
- Verify: `src/app/robots.ts`
- Verify: `src/app/styles/marketing.css`
- Verify: `tests/industry-seo-smoke.mjs`

- [ ] **Step 1: Run the complete public checks**

```bash
npm run test:industry-seo
npm run test:seo-sitemap
npm run test:module16-landing
npm run visual:marketing
npm run lint
npx tsc --noEmit
npm run build
```

- [ ] **Step 2: Check the diff and working tree**

Run `git diff --check` and `git status --short`; no whitespace errors or unrelated changes may remain.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/branchen src/app/components/marketing src/app/seo.ts src/app/robots.ts src/app/styles/marketing.css tests package.json docs/superpowers
git commit -m "feat: add industry seo landing pages"
git push origin HEAD:main
```
