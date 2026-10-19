import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyAllowedIds, validateTelegramId } from '../src/staff-access.js';

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
