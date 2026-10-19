export const FIRST_AUTO_CLOSE_DATE = '2026-10-31';
export const FIRST_AUTO_PERIOD_START = '2026-10-01';

export function accrualPeriod(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error('Invalid business date');
  const [year, month, day] = dateIso.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateIso) throw new Error('Invalid business date');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = dateIso.slice(0, 7);
  return {
    from: prefix + (day <= 15 ? '-01' : '-16'),
    to: prefix + (day <= 15 ? '-15' : '-' + String(last).padStart(2, '0')),
  };
}

// A period is closed only from the next Moscow business day onwards.
// Existing October balances intentionally remain untouched on Oct 15/16, 2026.
export function closedPeriodsBefore(todayIso) {
  accrualPeriod(todayIso); // validate date
  if (todayIso <= FIRST_AUTO_CLOSE_DATE) return [];
  const dates = [];
  const current = new Date(todayIso + 'T00:00:00Z');
  for (let date = new Date(Date.UTC(2026, 9, 1)); date <= current; date.setUTCMonth(date.getUTCMonth() + 1)) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const prefix = String(year) + '-' + String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (const closeDate of [prefix + '-15', prefix + '-' + String(lastDay).padStart(2, '0')]) {
      if (closeDate >= FIRST_AUTO_CLOSE_DATE && closeDate < todayIso) dates.push(closeDate);
    }
  }
  return dates;
}
