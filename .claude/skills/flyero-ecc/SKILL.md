```markdown
# flyero-ecc Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill introduces the core development patterns, coding conventions, and workflows used in the `flyero-ecc` codebase—a Next.js application written in TypeScript. You'll learn how to structure new features, update APIs, maintain code style, and ensure robust testing using the repository's established practices.

---

## Coding Conventions

### File Naming

- Use **camelCase** for file and directory names.
  - Example: `orderWizardTypes.ts`, `smartOrderWizard.tsx`

### Imports

- Use **alias-based imports** for internal modules.
  - Example:
    ```typescript
    import { calculatePrice } from '@/lib/pricing';
    import { OrderAreaStep } from '@/app/customer/orders/new/OrderAreaStep';
    ```

### Exports

- Prefer **named exports** over default exports.
  - Example:
    ```typescript
    // src/lib/pricing.ts
    export function calculatePrice(order) { ... }
    export const DEFAULT_TAX_RATE = 0.2;
    ```

### Commit Messages

- Freeform style, often prefixed but not strictly enforced.
- Average length: ~36 characters.
  - Example: `fix: handle edge case in order wizard`

---

## Workflows

### Customer Order Wizard Feature Update

**Trigger:** When adding, refactoring, or fixing functionality in the customer order wizard flow.  
**Command:** `/update-customer-order-wizard`

1. Modify or add files in `src/app/customer/orders/new/` (e.g., `SmartOrderWizard.tsx`, step components, hooks).
2. Update or create supporting files such as `orderWizardTypes.ts` or files in `hooks/`.
3. Update or add related test files:
    - `tests/customer-order-area-smoke.mjs`
    - `tests/customer-order-new-flow-smoke.mjs`
    - `tests/customer-planner-integrity-smoke.mjs`
    - `tests/module27-1-playwright.mjs`
    - `tests/public-order-planner-smoke.mjs`
4. Ensure all steps and logic are covered by corresponding smoke and flow tests.

**Example:**
```typescript
// src/app/customer/orders/new/OrderMaterialStep.tsx
export function OrderMaterialStep(props) {
  // step logic here
}
```

---

### API Feature or Integrity Update with Tests

**Trigger:** When adding, fixing, or enhancing API endpoints or backend logic related to orders, pricing, or maps.  
**Command:** `/update-api-feature`

1. Modify or add API route files, e.g.:
    - `src/app/api/customer/orders/route.ts`
    - `src/app/api/maps/autocomplete/route.ts`
2. Update supporting libraries:
    - `src/lib/pricing.ts`
    - `src/lib/validators.ts`
    - `src/lib/orderAreaSnapshot.ts`
3. Update or add related test files:
    - `tests/pricing-admin-propagation-smoke.mjs`
    - `tests/maps-abuse-smoke.mjs`
    - `tests/customer-order-area-smoke.mjs`
    - `tests/service-format-options-smoke.mjs`
4. Ensure integrity with targeted smoke tests.

**Example:**
```typescript
// src/app/api/customer/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateOrder } from '@/lib/validators';

export async function POST(req: NextRequest) {
  const data = await req.json();
  if (!validateOrder(data)) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }
  // ...handle order creation
}
```

---

### Feature or Bugfix with Smoke Test Update

**Trigger:** When implementing a new feature or bugfix and ensuring it is covered by automated smoke tests.  
**Command:** `/feature-with-tests`

1. Modify or add implementation files (could be in `src/app/`, `src/lib/`).
2. Update or add one or more test files in `tests/*-smoke.mjs`.
3. Run the smoke tests to verify the change.

**Example:**
```typescript
// src/lib/serviceCatalog.ts
export function getServiceOptions() {
  // implementation
}
```
```javascript
// tests/service-format-options-smoke.mjs
import { test, expect } from '@playwright/test';

test('service format options are correct', async () => {
  // smoke test logic
});
```

---

## Testing Patterns

- **Test files** are named with the pattern `*.test.ts` for unit tests and `*-smoke.mjs` for smoke/end-to-end tests.
- The primary test framework is **unknown**, but Playwright is likely used for smoke tests.
- Place smoke and flow tests in the `tests/` directory.
- Always update or add smoke tests when implementing or modifying features or APIs.

**Example:**
```typescript
// src/lib/pricing.test.ts
import { calculatePrice } from './pricing';

test('calculates price with default tax', () => {
  expect(calculatePrice({ amount: 100 })).toBe(120);
});
```

---

## Commands

| Command                        | Purpose                                                         |
|--------------------------------|-----------------------------------------------------------------|
| /update-customer-order-wizard  | Update or add features to the customer order wizard flow         |
| /update-api-feature            | Add or update API endpoints and ensure integrity with tests      |
| /feature-with-tests            | Implement a feature or bugfix and update corresponding smoke tests |

---
```