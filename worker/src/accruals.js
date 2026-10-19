export function accrualPeriod(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error('Invalid business date');
  const [y,m,d]=dateIso.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==dateIso) throw new Error('Invalid business date');
  const last=new Date(Date.UTC(y,m,0)).getUTCDate(),prefix=dateIso.slice(0,7);
  return {from:prefix+(d<=15?'-01':'-16'),to:prefix+(d<=15?'-15':'-'+String(last).padStart(2,'0')),
    lastClosedDate:d<=15?new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10):prefix+'-15'};
}
export function reconcileAccruals(rows) {
  return rows.map(r=>{
    const closed=Number(r.closed_earned||0),current=Number(r.current_earned||0),paid=Number(r.paid_total||0);
    // Old accruals are paid first; overpayments remain visible as negative current balances.
    const accruedKopecks=Math.max(0,closed-paid);
    const currentKopecks=current-Math.max(0,paid-closed);
    return {employeeName:r.employee_name,accruedKopecks,currentKopecks,
      totalOutstandingKopecks:accruedKopecks+currentKopecks,
      distributedKopecks:closed+current,paidKopecks:paid};
  });
}
