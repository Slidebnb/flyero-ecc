# FLYERO Public Website Humanization Audit

## Scope

This change reviewed the public marketing and inquiry surfaces listed in the
humanization plan. The public planner's map, pricing, API, database, checkout,
authentication, role, and server-calculation behavior were deliberately left
unchanged.

## Root Cause

Public pages reused operational vocabulary from internal workflows. Terms such
as dispatch, internal review, tracking system, and technical status labels made
the customer experience read like an operations console. The shared footer also
used a mail link where the requested public contact presentation is a visible
email address, and the inquiry PDF was not surfaced consistently in the shared
footer.

## Implemented

- Replaced internal workflow language with customer-facing descriptions.
- Clarified that online booking is for the customer's own already-printed
  flyers; printing by FLYERO remains a separate contact discussion.
- Described the assigned FLYERO warehouse in customer language.
- Presented `hallo@flyero.org` directly on the public footer and inquiry page.
- Added the current inquiry PDF to the shared public footer.
- Kept the existing public navigation, premium visual system, Google Maps,
  pricing, booking, and authentication behavior intact.
- Added a source-level regression smoke test for forbidden public vocabulary,
  contact visibility, PDF discoverability, and SEO route coverage.

## Verification Evidence

Passed locally:

- `npm run lint`
- `npm run build`
- `npm run test:public-humanization`
- `npm run test:public-link-integrity` against `http://localhost:3025`
- `npm run test:inquiry-form-contact`
- `npm run test:seo-sitemap`
- `npm run test:industry-seo`
- `npm run test:occasion-seo`
- `npm run test:service-catalog`

The production build generated all 195 routes successfully. Real browser
screenshots were created and inspected at 1440x900 and 390x844 for the home,
inquiry, and pricing pages, plus the bakery industry page at desktop width.

## Remaining Verification

This document is written before the production commit and deployment. The
following must be verified after push: remote commit SHA, built and running
container image identity, production health endpoint, and the live public
pages. No production success is claimed until those checks pass.
