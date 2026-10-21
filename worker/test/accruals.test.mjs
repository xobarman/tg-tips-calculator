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

import { periodOutstandingKopecks } from '../src/accruals.js';

test('paying an older debt within the selected dates does not create negative current-period debt', () => {
  // Previous 1–15 earnings 28,010.95 ₽; on 16th, 22,532.50 ₽ paid for older tips;
  // newly earned in 16–31 period: 19,182.32 ₽.
  assert.equal(periodOutstandingKopecks(2801095, 1918232, 2253250), 1918232);
});
test('payments exceeding older debts only reduce selected period earnings, not below zero', () => {
  assert.equal(periodOutstandingKopecks(10000, 6000, 12000), 4000);
  assert.equal(periodOutstandingKopecks(10000, 6000, 22000), 0);
});
test('paid later still reduces selected older tip debt, older obligations first', () => {
  assert.equal(periodOutstandingKopecks(10000, 20000, 25000), 5000);
  assert.equal(periodOutstandingKopecks(10000, 20000, 0), 20000);
});
test('invalid financial values never become an apparent debt', () => {
  assert.throws(()=>periodOutstandingKopecks(0,-1,0),/Invalid/);
  assert.throws(()=>periodOutstandingKopecks(0,1,1.5),/Invalid/);
});
