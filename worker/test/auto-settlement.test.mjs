import test from 'node:test';
import assert from 'node:assert/strict';
import { settleClosedPeriods } from '../src/index.js';

function fakeDb() {
  const closures = new Set();
  const earned = new Map([
    ['Александр', 100000],
    ['Александра', 75000],
    ['Анна', 10000],
    ['Арсик', 0],
    ['Снежа', 14000],
  ]);
  const payments = [
    {id:'old-1', date:'2026-10-10', name:'Александр', amount:50000},
    {id:'old-2', date:'2026-10-12', name:'Анна', amount:10000},
    {id:'old-3', date:'2026-10-17', name:'Снежа', amount:3000},
  ];
  function prepare(sql) {
    return { bind(...args) {
      return {
        first: async () => {
          assert.match(sql, /SELECT close_date FROM automatic_period_closures/);
          return closures.has(args[0]) ? {close_date:args[0]} : null;
        },
        async run() {
          if (sql.includes('INSERT OR IGNORE INTO payments')) {
            assert.match(sql,/WHERE unpaid > 0/);
            const [id, date, name, actor, label, from, end, earnedName, paidFrom, paidEnd, paidName] = args;
            assert.equal(date, end);
            assert.equal(from, '2026-10-01');
            assert.equal(paidFrom, from);
            assert.equal(paidEnd, end);
            assert.equal(earnedName, name);
            assert.equal(paidName, name);
            assert.equal(actor, 'AUTO_BANK_SCHEDULE');
            assert.ok(label.includes('без подтверждения'));
            const existing = payments.filter(p=>p.name===name && p.date>=from && p.date<=end).reduce((a,p)=>a+p.amount,0);
            const due=(earned.get(name)||0)-existing;
            if(due>0 && !payments.some(p=>p.id===id)){
              payments.push({id,date,name,amount:due});
            }
            return;
          }
          if (sql.includes('INSERT OR IGNORE INTO automatic_period_closures')) {
            closures.add(args[0]);
            return;
          }
          throw new Error('unexpected SQL');
        }
      };
    }};
  }
  return {
    closures, earned, payments,
    DB:{prepare,async batch(statements){for (const s of statements) await s.run();}}
  };
}

test('October is never closed on 15/16 or 31 and all existing paid amounts are respected', async () => {
  const f=fakeDb();
  const env={DB:f.DB};
  await settleClosedPeriods(env,'2026-10-31');
  assert.equal(f.payments.length,3);
  assert.equal(f.closures.size,0);
  await settleClosedPeriods(env,'2026-11-01');
  const auto=f.payments.filter(p=>p.id.startsWith('auto-2026-10-31-'));
  assert.equal(auto.length,3);
  assert.equal(auto.find(x=>x.name==='Александр').amount,50000);
  assert.equal(auto.find(x=>x.name==='Александра').amount,75000);
  assert.equal(auto.find(x=>x.name==='Снежа').amount,11000);
  assert.equal(f.closures.has('2026-10-31'),true);
  await settleClosedPeriods(env,'2026-11-01');
  assert.equal(f.payments.filter(p=>p.id.startsWith('auto-')).length,3);
});

test('past correction after October payout settles as delta at next close, not duplicate', async()=>{
  const f=fakeDb(), env={DB:f.DB};
  await settleClosedPeriods(env,'2026-11-01');
  const oct= f.payments.filter(p=>p.id.startsWith('auto-2026-10-31-')).length;
  f.earned.set('Александр', 160000);
  await settleClosedPeriods(env,'2026-11-16');
  const november=f.payments.filter(p=>p.id.startsWith('auto-2026-11-15-'));
  assert.equal(november.length,1);
  assert.equal(november[0].name,'Александр');
  assert.equal(november[0].amount,60000);
  assert.equal(f.payments.filter(p=>p.id.startsWith('auto-2026-10-31-')).length,oct);
  await settleClosedPeriods(env,'2026-11-16');
  assert.equal(f.payments.filter(p=>p.id.startsWith('auto-')).length,oct+1);
});
