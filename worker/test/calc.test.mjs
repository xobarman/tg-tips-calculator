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

test('one waiter gets the entire net amount after 8% commission', () => {
  const result = calculateDistribution({
    totalKopecks: 540000,
    morningKopecks: 150000,
    eveningKopecks: 50000,
    employees: ['Анна', '', ''],
  });
  assert.equal(result.participantCount, 1);
  assert.equal(result.payouts.length, 1);
  assert.equal(result.payouts[0].employeeName, 'Анна');
  assert.equal(result.payouts[0].position, 1);
  assert.equal(result.payouts[0].amountKopecks, 496800);
  assert.equal(result.distributedKopecks, result.commonNetKopecks + result.shiftNetKopecks);
});

test('one waiter without morning or evening still receives the whole net', () => {
  const result = calculateDistribution({
    totalKopecks: 540000,
    morningKopecks: 0,
    eveningKopecks: 0,
    employees: ['Александр', '', ''],
  });
  assert.deepEqual(result.payouts, [
    { employeeName: 'Александр', position: 1, amountKopecks: 496800 },
  ]);
});

test('first waiter is required; third position cannot skip the second', () => {
  const base = { totalKopecks: 100000, morningKopecks: 0, eveningKopecks: 0 };
  assert.throws(() => calculateDistribution({ ...base, employees: ['', '', ''] }), /хотя бы одного/);
  assert.throws(() => calculateDistribution({ ...base, employees: ['', 'Анна', ''] }), /Первый официант/);
  assert.throws(() => calculateDistribution({ ...base, employees: ['Анна', '', 'Снежа'] }), /второго официанта/);
});
