---
name: api-feature-or-integrity-update-with-tests
description: Workflow command scaffold for api-feature-or-integrity-update-with-tests in flyero-ecc.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /api-feature-or-integrity-update-with-tests

Use this workflow when working on **api-feature-or-integrity-update-with-tests** in `flyero-ecc`.

## Goal

Implements or fixes API endpoints (especially for customer orders, maps, pricing), updates related libraries, and ensures integrity with targeted smoke tests.

## Common Files

- `src/app/api/customer/orders/route.ts`
- `src/app/api/maps/autocomplete/route.ts`
- `src/app/api/maps/geocode/route.ts`
- `src/app/api/maps/order-intelligence/route.ts`
- `src/app/api/admin/settings/pricing/route.ts`
- `src/lib/pricing.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Modify or add API route files (e.g., src/app/api/customer/orders/route.ts, src/app/api/maps/*.ts)
- Update supporting libraries (e.g., src/lib/pricing.ts, src/lib/validators.ts, src/lib/orderAreaSnapshot.ts, etc.)
- Update or add related test files (tests/pricing-admin-propagation-smoke.mjs, tests/maps-abuse-smoke.mjs, tests/customer-order-area-smoke.mjs, etc.)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.