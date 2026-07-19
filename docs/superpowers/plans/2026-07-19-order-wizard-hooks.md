# Customer Order Wizard Hook Extraction

## Goal

Keep the proven `/customer/orders/new` behavior intact while separating the
server calculation, draft persistence, location search, map interaction, and
submission boundaries into focused hooks.

## Guardrails

- No schema or database-port changes.
- Server-calculated price and area data remain authoritative.
- A Google boundary `placeId` without reusable geometry must use the drawing
  path, never an unavailable click instruction.
- Each extraction is verified with the existing smoke tests, lint, build, and
  the real Playwright flow.

## Order

1. Extract and integrate `useOrderIntelligence` with stale-request cancellation
   and confirmed-request validation.
2. Extract draft persistence without changing public-planner restore rules.
3. Extract autocomplete and explicit location search without geocoding on blur.
4. Extract submission locking and map lifecycle only after the smaller hooks are
   green and the browser flow remains stable.

## Verification

Run the customer-order smoke tests after each extraction. Before completion run
the full required test list from `AGENTS.md` and generate desktop/mobile
Playwright screenshots for the order wizard.
