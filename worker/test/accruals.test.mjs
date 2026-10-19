import test from 'node:test';
import assert from 'node:assert/strict';
import { closedPeriodsBefore, accrualPeriod, FIRST_AUTO_PERIOD_START } from '../src/accruals.js';

test('existing October balance stays open, even after October 15', () => {
  assert.equal(FIRST_AUTO_PERIOD_START, '2026-10-01');
  for (const day of ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-31'])
    assert.deepEqual(closedPeriodsBefore(day), []);
});
test('first close runs on November 1, never in October', () => {
  assert.deepEqual(closedPeriodsBefore('2026-11-01'), ['2026-10-31']);
});
test('subsequent closes occur on November 16 and December 1', () => {
  assert.deepEqual(closedPeriodsBefore('2026-11-15'), ['2026-10-31']);
  assert.deepEqual(closedPeriodsBefore('2026-11-16'), ['2026-10-31', '2026-11-15']);
  assert.deepEqual(closedPeriodsBefore('2026-12-01'), ['2026-10-31','2026-11-15','2026-11-30']);
});
test('28/29/30/31-day month ends and year rollovers', () => {
  const feb = closedPeriodsBefore('2027-03-01');
  assert.ok(feb.includes('2027-02-15'));
  assert.ok(feb.includes('2027-02-28'));
  const leap = closedPeriodsBefore('2028-03-01');
  assert.ok(leap.includes('2028-02-29'));
  assert.ok(closedPeriodsBefore('2027-01-01').includes('2026-12-31'));
  assert.deepEqual(accrualPeriod('2026-11-16'), {from:'2026-11-16',to:'2026-11-30'});
});
test('invalid dates cannot be close checkpoints', () => {
  assert.throws(() => closedPeriodsBefore('2027-02-29'),/Invalid business date/);
});
