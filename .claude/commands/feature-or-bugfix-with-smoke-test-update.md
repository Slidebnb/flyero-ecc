---
name: feature-or-bugfix-with-smoke-test-update
description: Workflow command scaffold for feature-or-bugfix-with-smoke-test-update in flyero-ecc.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-or-bugfix-with-smoke-test-update

Use this workflow when working on **feature-or-bugfix-with-smoke-test-update** in `flyero-ecc`.

## Goal

Implements a new feature or bugfix and immediately updates or adds corresponding smoke tests to verify the change.

## Common Files

- `src/app/customer/orders/new/SmartOrderWizard.tsx`
- `src/app/lib/*.ts`
- `tests/*-smoke.mjs`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Modify or add implementation files (could be in src/app/, src/lib/)
- Update or add one or more test files in tests/*-smoke.mjs

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.