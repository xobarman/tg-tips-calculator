import test from 'node:test';
import assert from 'node:assert/strict';
import {accrualPeriod,reconcileAccruals} from '../src/accruals.js';
test('15th included; 16th starts a fresh balance',()=>{
 assert.deepEqual(accrualPeriod('2026-10-15'),{from:'2026-10-01',to:'2026-10-15',lastClosedDate:'2026-09-30'});
 assert.deepEqual(accrualPeriod('2026-10-16'),{from:'2026-10-16',to:'2026-10-31',lastClosedDate:'2026-10-15'});
});
test('rollover on last day and next month',()=>{
 assert.deepEqual(accrualPeriod('2026-10-31'),{from:'2026-10-16',to:'2026-10-31',lastClosedDate:'2026-10-15'});
 assert.deepEqual(accrualPeriod('2026-11-01'),{from:'2026-11-01',to:'2026-11-15',lastClosedDate:'2026-10-31'});
});
test('short and leap months',()=>{
 assert.equal(accrualPeriod('2027-02-16').to,'2027-02-28');
 assert.equal(accrualPeriod('2028-02-16').to,'2028-02-29');
 assert.throws(()=>accrualPeriod('2027-02-29'));
});
test('old balance rolls into accrued without affecting fresh balance',()=>{
 const [a]=reconcileAccruals([{employee_name:'Анна',closed_earned:100000,current_earned:0,paid_total:10000}]);
 assert.equal(a.accruedKopecks,90000);assert.equal(a.currentKopecks,0);
});
test('payments consume accrued before current, historical corrections reflow',()=>{
 const base={employee_name:'Анна',closed_earned:100000,current_earned:50000,paid_total:120000};
 const [a]=reconcileAccruals([base]);assert.equal(a.accruedKopecks,0);assert.equal(a.currentKopecks,30000);
 const [b]=reconcileAccruals([{...base,closed_earned:70000}]);assert.equal(b.currentKopecks,0);
});
test('overpayments from retroactive corrections remain visible',()=>{
 const [a]=reconcileAccruals([{employee_name:'Анна',closed_earned:10000,current_earned:5000,paid_total:20000}]);
 assert.equal(a.accruedKopecks,0);assert.equal(a.currentKopecks,-5000);assert.equal(a.totalOutstandingKopecks,-5000);
});
