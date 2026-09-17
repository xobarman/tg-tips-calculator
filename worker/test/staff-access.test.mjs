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
