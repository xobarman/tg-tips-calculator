import test from 'node:test';
import assert from 'node:assert/strict';
import { STAFF_ACCESS_NAMES, legacyAllowedIds, validateTelegramId, saveStaffAccess } from '../src/staff-access.js';
import { EMPLOYEES, calculateDistribution } from '../src/calc.js';

test('legacyAllowedIds trims and de-duplicates IDs', () => {
  assert.deepEqual(legacyAllowedIds(' 111,222,111, ,333 '), ['111', '222', '333']);
});

test('validateTelegramId accepts a positive decimal Telegram ID', () => {
  assert.equal(validateTelegramId('518041233'), '518041233');
});

test('validateTelegramId rejects malformed values', () => {
  assert.throws(() => validateTelegramId('abc'), /Некорректный Telegram ID/);
  assert.throws(() => validateTelegramId('00001'), /Некорректный Telegram ID/);
});

test('legacy IDs remain a low-privilege allowlist', async () => {
  const { resolveStaffAccess } = await import('../src/staff-access.js');
  const DB = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
  const result = await resolveStaffAccess({ DB, ALLOWED_TELEGRAM_USER_IDS: '12345' }, '12345');
  assert.equal(result.allowed, true);
  assert.equal(result.canCorrect, false);
});
test('inactive admin cannot correct historical calculations', async () => {
  const { resolveStaffAccess } = await import('../src/staff-access.js');
  const DB = { prepare: () => ({ bind: () => ({ first: async () => ({telegram_id:'12345', employee_name:'Анна', active:0, can_correct:1}) }) }) };
  const result = await resolveStaffAccess({ DB, ALLOWED_TELEGRAM_USER_IDS:'12345' }, '12345');
  assert.equal(result.allowed, false);
  assert.equal(result.canCorrect, false);
});

test('Inga can receive staff access but can never be selected as a waiter or payout recipient', () => {
  assert.equal(STAFF_ACCESS_NAMES.includes('Инга'), true);
  assert.equal(EMPLOYEES.includes('Инга'), false);
  assert.throws(() => calculateDistribution({
    totalKopecks: 100000,
    morningKopecks: 0,
    eveningKopecks: 0,
    employees: ['Инга', '', ''],
  }), /Неизвестный сотрудник/);
});

test('D1 access can save Inga without assigning financial/admin privileges', async () => {
  let bound = null;
  const env = { DB: { prepare(sql) {
    assert.match(sql, /INSERT INTO staff_access/);
    return {bind(...args) { bound = args; return {async run() {return {success:true}}}; }};
  }}};
  const result = await saveStaffAccess(env, {
    telegramId:'12345',
    employeeName:'Инга',
    active:true,
    canCorrect:false,
  }, '99999');
  assert.equal(result.employeeName, 'Инга');
  assert.equal(result.active, true);
  assert.equal(result.canCorrect, false);
  assert.equal(bound[1], 'Инга');
  assert.equal(bound[3], 0);
});
