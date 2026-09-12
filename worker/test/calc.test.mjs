import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistribution } from '../src/calc.js';

test('three waiters: first two receive shift share, third only common share', () => {
  const result = calculateDistribution({
    totalKopecks: 1590600,
    morningKopecks: 200000,
    eveningKopecks: 300000,
    employees: ['Александр', 'Анна', 'Снежа'],
  });
  assert.equal(result.participantCount, 3);
  assert.equal(result.distributedKopecks, result.commonNetKopecks + result.shiftNetKopecks);
  assert.equal(result.payouts.length, 3);
  assert.ok(result.payouts[0].amountKopecks > result.payouts[2].amountKopecks);
  assert.ok(result.payouts[1].amountKopecks > result.payouts[2].amountKopecks);
});

test('two waiters: common part and shift part are both split between two', () => {
  const result = calculateDistribution({
    totalKopecks: 1000000,
    morningKopecks: 100000,
    eveningKopecks: 100000,
    employees: ['Александр', 'Анна', ''],
  });
  assert.equal(result.participantCount, 2);
  assert.equal(result.payouts.length, 2);
  assert.equal(result.payouts[0].amountKopecks + result.payouts[1].amountKopecks, result.distributedKopecks);
  assert.equal(result.distributedKopecks, result.commonNetKopecks + result.shiftNetKopecks);
});

test('duplicate employees are rejected', () => {
  assert.throws(() => calculateDistribution({
    totalKopecks: 100000,
    morningKopecks: 0,
    eveningKopecks: 0,
    employees: ['Анна', 'Анна', ''],
  }), /нельзя выбрать дважды/);
});
