import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateCalculationForDate } from '../src/day-access.js';

test('owner can fill a missed historical day without an existing calculation', () => {
  assert.equal(canCreateCalculationForDate(false, '2026-10-18', '2026-10-19', true), true);
});
test('ordinary employee and administrator cannot backfill past days', () => {
  assert.equal(canCreateCalculationForDate(false, '2026-10-18', '2026-10-19', false), false);
});
test('any allowed employee can create current day once', () => {
  assert.equal(canCreateCalculationForDate(false, '2026-10-19', '2026-10-19', false), true);
});
test('saved day cannot be created again and future dates are rejected even for owner', () => {
  assert.equal(canCreateCalculationForDate(true, '2026-10-18', '2026-10-19', true), false);
  assert.equal(canCreateCalculationForDate(false, '2026-10-20', '2026-10-19', true), false);
});
