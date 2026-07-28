# FLYERO Cookie Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, non-intrusive first-party cookie consent flow with necessary and optional statistics categories while preserving authentication and order drafts.

**Architecture:** A small client consent provider renders one banner and one settings dialog from the root layout. A typed first-party cookie stores only the versioned preference. Existing application/session cookies remain independent. No new dependency, database table, or third-party script is added.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing `globals.css`, Node smoke tests, Playwright visual QA.

## Global Constraints

- No database migration or PostgreSQL change.
- No non-essential storage or tracking before consent.
- Existing authentication, security, order-draft and payment cookies must continue to work.
- Reject and accept must be equally easy to select.
- Invalid or outdated consent values must be ignored safely.
- Public/customer UI must not expose technical implementation terms.

---

### Task 1: Consent contract regression test

**Files:**
- Create: `tests/cookie-consent-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- The test will assert the central cookie name, categories, equal-choice labels, footer settings entry, rejection behavior, versioning and absence of third-party tracking scripts.

- [ ] **Step 1: Write the failing test**

Assert that the expected consent helper, client component, root layout, footer and privacy copy exist and that `flyero_cookie_consent_v1` is used.

- [ ] **Step 2: Run the test and verify the expected failure**

Run `npm run test:cookie-consent`.

Expected: failure because the consent contract and UI do not exist yet.

- [ ] **Step 3: Add the npm script**

Add `test:cookie-consent` pointing to the smoke test without changing existing scripts.

- [ ] **Step 4: Run the test again**

Confirm it still fails for the missing implementation rather than for a test syntax error.

### Task 2: Central consent state and storage

**Files:**
- Create: `src/lib/cookieConsent.ts`
- Create: `src/app/CookieConsent.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- `COOKIE_CONSENT_NAME = "flyero_cookie_consent_v1"`
- `ConsentPreferences = { statistics: boolean; marketing: boolean; updatedAt: string }`
- `readConsentCookie(value: string | undefined): ConsentPreferences | null`
- `serializeConsent(preferences: ConsentPreferences): string`
- `hasStatisticsConsent(preferences: ConsentPreferences | null): boolean`

- [ ] **Step 1: Write the failing contract assertions**

Cover valid serialization, invalid JSON, unknown version, missing booleans and default-deny behavior.

- [ ] **Step 2: Run the focused test**

Run `npm run test:cookie-consent`; confirm the helper assertions fail before implementation.

- [ ] **Step 3: Implement the minimal typed helper**

Parse only the expected version and booleans, serialize only the allowlisted fields, and return `null` for anything else.

- [ ] **Step 4: Implement the client provider**

Read the cookie on mount, render no banner after a valid choice, write a secure first-party cookie on save, and expose a `CustomEvent`-based `flyero:open-cookie-settings` handler.

- [ ] **Step 5: Mount it once in the root layout**

Render `CookieConsent` inside `<body>` next to the existing service worker registration.

- [ ] **Step 6: Run the focused test**

Run `npm run test:cookie-consent`; it must pass.

### Task 3: Footer access and responsive UI

**Files:**
- Modify: the shared public footer component identified by `rg -n "Datenschutz|Impressum|Footer" src/app src/components`
- Modify: `src/app/globals.css`
- Modify: `tests/cookie-consent-smoke.mjs`

**Interfaces:**
- Footer link dispatches `flyero:open-cookie-settings` and has visible label `Cookie-Einstellungen`.
- Banner exposes buttons `cookie-consent-reject`, `cookie-consent-save`, `cookie-consent-accept`.

- [ ] **Step 1: Extend the regression test**

Assert that the footer link is present and all three primary actions are available without hidden rejection styling.

- [ ] **Step 2: Run the test and confirm red**

Run `npm run test:cookie-consent` and verify the footer/UI assertions fail before the edit.

- [ ] **Step 3: Add the footer trigger and CSS**

Use existing FLYERO colors and spacing; keep the banner narrow, readable and mobile-safe. Do not cover the main planner CTA on small screens.

- [ ] **Step 4: Run the focused test**

Run `npm run test:cookie-consent` and `npm run lint`.

### Task 4: Build and browser verification

**Files:**
- Create during QA only: `.qa-cookie-consent/cookie-desktop.png`, `.qa-cookie-consent/cookie-mobile.png`

- [ ] **Step 1: Run focused and adjacent tests**

Run `npm run test:cookie-consent`, `npm run test:security-headers`, `npm run test:public-link-integrity`, `npm run lint` and `npm run build`.

- [ ] **Step 2: Run a local browser smoke test**

At 1440px and 390px verify: first visit shows banner, reject persists after reload, accept enables statistics state, footer opens settings, and no horizontal overflow occurs.

- [ ] **Step 3: Inspect both screenshots**

Use `view_image` for both QA files and record any visible overlap or clipping.

- [ ] **Step 4: Check git diff and status**

Confirm only the intended implementation/test/docs files are changed; preserve unrelated user files.

### Task 5: Commit, push, deploy and production verification

- [ ] **Step 1: Commit the scoped changes**

Use a focused commit message: `feat: add persistent cookie consent`.

- [ ] **Step 2: Push `main`**

Push the commit to `origin/main` and capture the resulting SHA.

- [ ] **Step 3: Deploy with the existing PowerShell SSH deploy script**

Run `powershell.exe -ExecutionPolicy Bypass -File .\scripts\deploy-production.ps1 -ExpectedSha <sha>` from the repository root.

- [ ] **Step 4: Verify production**

Confirm remote SHA, running image/container, migration status, `healthy` status and `https://flyero.org/api/health` HTTP 200. Verify the public footer link and first-visit banner in a fresh browser context.
