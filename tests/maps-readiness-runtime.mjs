import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForMapReadiness } from '../src/lib/mapsReadiness.ts';

test('waits beyond the early empty namespace instead of exhausting synchronous retries', async () => {
  let attempts = 0;
  const library = { Map() {}, Polygon() {}, LatLngBounds() {} };
  const result = await waitForMapReadiness(async () => ++attempts > 5 ? library : null, 500, 5);
  assert.equal(result, library);
  assert.equal(attempts, 6);
});
test('missing or stalled libraries fail after a bounded wait', async () => {
  await assert.rejects(waitForMapReadiness(async () => null, 25, 5), /Karte/);
  await assert.rejects(waitForMapReadiness(() => new Promise(() => {}), 25, 5), /Karte/);
});
