import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistribution } from '../src/calc.js';
import { formatCalculationReport, notifyCalculationGroup } from '../src/group-report.js';

const detail = (overrides = {}) => {
  const totalKopecks = 540000;
  const morningKopecks = 50000;
  const eveningKopecks = 100000;
  const result = calculateDistribution({
    totalKopecks, morningKopecks, eveningKopecks,
    employees: ['Анна', 'Снежа', ''],
  });
  return {
    businessDate: '2026-10-21', replaced: false,
    createdByName: 'Администратор', totalKopecks, morningKopecks, eveningKopecks, result,
    ...overrides,
  };
};

test('one clear message includes date, 8% fee, coefficients, input parts and net payouts', () => {
  const report = formatCalculationReport(detail());
  assert.match(report, /НОВЫЙ РАСЧЁТ/);
  assert.match(report, /21.10.2026/);
  assert.match(report, /5\s?400,00\s?₽/u);
  assert.match(report, /Утро:/);
  assert.match(report, /Вечер:/);
  assert.match(report, /Общая часть:/);
  assert.match(report, /8%/);
  assert.match(report, /1\/2 на каждого/);
  assert.match(report, /1\/2 первым 2/);
  assert.match(report, /Анна/);
  assert.match(report, /Снежа/);
  assert.match(report, /Всего начислено за смену:/);
});

test('correction is explicitly distinguishable from first save', () => {
  const correction = formatCalculationReport(detail({ replaced: true }));
  assert.match(correction, /ИСПРАВЛЕННЫЙ РАСЧЁТ/);
  assert.doesNotMatch(correction, /НОВЫЙ РАСЧЁТ/);
});

test('single waiter shows both coefficients as one whole share', () => {
  const result = calculateDistribution({
    totalKopecks: 100000, morningKopecks: 20000, eveningKopecks: 30000,
    employees: ['Александр', '', ''],
  });
  const report = formatCalculationReport(detail({ totalKopecks: 100000, morningKopecks: 20000, eveningKopecks: 30000, result }));
  assert.match(report, /1\/1 на каждого/);
  assert.match(report, /1\/1 первым 1/);
  assert.match(report, /920,00\s?₽/u);
});

test('3-person report preserves third waiter common-only coefficient', () => {
  const result = calculateDistribution({
    totalKopecks: 100000, morningKopecks: 20000, eveningKopecks: 30000,
    employees: ['Александр', 'Анна', 'Снежа'],
  });
  const report = formatCalculationReport(detail({ totalKopecks: 100000, morningKopecks: 20000, eveningKopecks: 30000, result }));
  assert.match(report, /1\/3 на каждого/);
  assert.match(report, /1\/2 первым 2/);
});

test('unconfigured bot group sends nothing; no Telegram request', async () => {
  let calls = 0;
  const r = await notifyCalculationGroup({ TELEGRAM_BOT_TOKEN: 'secret' }, detail(), async () => { calls++; throw Error('must not call'); });
  assert.deepEqual(r, { status: 'not_configured' });
  assert.equal(calls, 0);
});

test('sent message uses the configured group once', async () => {
  const calls = [];
  const r = await notifyCalculationGroup({ TELEGRAM_BOT_TOKEN:'secret', TIPS_GROUP_CHAT_ID:'-1001234567890' },
    detail(), async (url, options) => {
      calls.push({url,options});
      return { ok:true, json:async()=>({ok:true, result:{message_id:123}}) };
    });
  assert.deepEqual(r, {status:'sent'});
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /sendMessage$/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.chat_id, '-1001234567890');
  assert.match(body.text, /Анна/);
});

test('Telegram fails: financial save status can still report failure, without leaking token', async () => {
  for (const fail of [
    async () => {throw new Error('secret');},
    async () => ({ok:false,json:async()=>({ok:false,description:'forbidden'})}),
    async () => ({ok:true,json:async()=>({ok:false,description:'group missing'})}),
  ]) {
    const r = await notifyCalculationGroup({ TELEGRAM_BOT_TOKEN:'secret', TIPS_GROUP_CHAT_ID:'-1001234567890' }, detail(), fail);
    assert.deepEqual(r, { status:'failed' });
    assert.doesNotMatch(JSON.stringify(r), /secret/);
  }
});

test('untrusted non-group chat identifiers are rejected before network request', async () => {
  let calls=0;
  const r = await notifyCalculationGroup({TELEGRAM_BOT_TOKEN:'secret',TIPS_GROUP_CHAT_ID:'12345678'}, detail(),
    async()=>{calls++;});
  assert.equal(r.status, 'failed');
  assert.equal(calls,0);
});
