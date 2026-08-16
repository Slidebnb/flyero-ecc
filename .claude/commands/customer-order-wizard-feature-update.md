---
name: customer-order-wizard-feature-update
description: Workflow command scaffold for customer-order-wizard-feature-update in flyero-ecc.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /customer-order-wizard-feature-update

Use this workflow when working on **customer-order-wizard-feature-update** in `flyero-ecc`.

## Goal

Implements or updates features in the customer order wizard, including its steps, hooks, and related logic, and ensures coverage with corresponding smoke and flow tests.

## Common Files

- `src/app/customer/orders/new/SmartOrderWizard.tsx`
- `src/app/customer/orders/new/OrderAreaStep.tsx`
- `src/app/customer/orders/new/OrderFinishStep.tsx`
- `src/app/customer/orders/new/OrderMaterialStep.tsx`
- `src/app/customer/orders/new/OrderScheduleStep.tsx`
- `src/app/customer/orders/new/OrderSummaryStep.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Modify or add files in src/app/customer/orders/new/ (such as SmartOrderWizard.tsx, step components, or hooks)
- Update or create supporting files (e.g., orderWizardTypes.ts, hooks/)
- Update or add related test files (tests/customer-order-area-smoke.mjs, tests/customer-order-new-flow-smoke.mjs, tests/customer-planner-integrity-smoke.mjs, etc.)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.