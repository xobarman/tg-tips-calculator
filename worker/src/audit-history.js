import { EMPLOYEES } from './calc.js';

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Некорректная дата.');
  return value;
}

export async function auditHistory(url, env) {
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const employee = url.searchParams.get('employee') || '';
  if (employee && !EMPLOYEES.includes(employee)) throw new Error('Неизвестный сотрудник.');

  const sql = `SELECT c.id, c.business_date, c.total_kopecks, c.morning_kopecks, c.evening_kopecks,
      c.participant_count, c.created_at, c.created_by_name, c.is_active, c.replaced_at,
      p.employee_name, p.position, p.amount_kopecks
    FROM calculations c JOIN payouts p ON p.calculation_id = c.id
    WHERE c.business_date BETWEEN ? AND ? ${employee ? 'AND p.employee_name = ?' : ''}
    ORDER BY c.business_date DESC, datetime(c.created_at) ASC, c.rowid ASC, p.position ASC`;
  const stmt = env.DB.prepare(sql).bind(...(employee ? [from, to, employee] : [from, to]));
  const rows = (await stmt.all()).results || [];

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, {
      id: row.id,
      businessDate: row.business_date,
      totalKopecks: Number(row.total_kopecks),
      morningKopecks: Number(row.morning_kopecks),
      eveningKopecks: Number(row.evening_kopecks),
      participantCount: Number(row.participant_count),
      createdAt: row.created_at,
      createdByName: row.created_by_name || '',
      isActive: Number(row.is_active) === 1,
      replacedAt: row.replaced_at || null,
      payouts: [],
    });
    map.get(row.id).payouts.push({
      employeeName: row.employee_name,
      position: Number(row.position),
      amountKopecks: Number(row.amount_kopecks),
    });
  }
  return [...map.values()];
}
