import { EMPLOYEES, FEE_PERCENT, calculateDistribution } from './calc.js';
import { auditHistory } from './audit-history.js';

const encoder = new TextEncoder();
const BUSINESS_TIME_ZONE = 'Europe/Moscow';

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin',
    };
  }
  return {};
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, encoder.encode(data));
}

async function validateTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || !botToken) throw new ApiError(403, 'Telegram initData или bot token отсутствует.');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new ApiError(403, 'Telegram hash отсутствует.');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmac(encoder.encode('WebAppData'), botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));
  if (!timingSafeEqualHex(calculatedHash, receivedHash.toLowerCase())) throw new ApiError(403, 'Некорректная Telegram подпись.');

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate > maxAgeSeconds || authDate - now > 60) {
    throw new ApiError(403, 'Telegram-сессия устарела. Переоткрой приложение.');
  }

  let user;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { user = null; }
  if (!user?.id) throw new ApiError(403, 'Telegram пользователь отсутствует.');
  return user;
}

function allowedIds(env) {
  return String(env.ALLOWED_TELEGRAM_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function isOwner(user, env) {
  const ownerId = String(env.OWNER_TELEGRAM_USER_ID || '').trim();
  return Boolean(ownerId) && ownerId === String(user.id);
}

function ensureAllowedUser(user, env) {
  const ids = allowedIds(env);
  if (!ids.length) throw new ApiError(403, 'Список разрешённых Telegram ID ещё не настроен.');
  if (!ids.includes(String(user.id))) throw new ApiError(403, 'У вас пока нет доступа к истории чаевых.');
}

function ensureOwner(user, env) {
  if (!isOwner(user, env)) throw new ApiError(403, 'Это действие доступно только владельцу.');
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new ApiError(400, 'Некорректная дата.');
  return value;
}

function parseKopecks(value, field, { positive = false } = {}) {
  if (!Number.isInteger(value) || value < 0 || (positive && value === 0)) {
    throw new ApiError(400, `${field}: некорректная сумма.`);
  }
  return value;
}

function businessDateNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function monthBounds(dateString) {
  const date = parseDate(dateString);
  const [year, month] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

async function authenticate(request, env, { requireAllowlist = true } = {}) {
  const initData = request.headers.get('X-Telegram-Init-Data') || '';
  const user = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (requireAllowlist) ensureAllowedUser(user, env);
  return user;
}

async function activeCalculationForDate(env, businessDate) {
  return env.DB.prepare(`SELECT id, business_date, total_kopecks, morning_kopecks, evening_kopecks,
      participant_count, created_by_telegram_id, created_by_name, created_at, day_submitter_telegram_id
    FROM calculations
    WHERE business_date = ? AND is_active = 1
    LIMIT 1`).bind(businessDate).first();
}

function replacementAccess(existing, businessDate, user, env) {
  const owner = isOwner(user, env);
  if (!existing) return { owner, daySubmitter: false, canReplace: false };
  const submitterId = String(existing.day_submitter_telegram_id || existing.created_by_telegram_id || '');
  const daySubmitter = submitterId === String(user.id);
  const sameBusinessDay = businessDate === businessDateNow();
  return {
    owner,
    daySubmitter,
    canReplace: owner || (daySubmitter && sameBusinessDay),
  };
}

async function dayStatus(url, env, user) {
  const businessDate = parseDate(url.searchParams.get('date'));
  const existing = await activeCalculationForDate(env, businessDate);
  const today = businessDateNow();
  const access = replacementAccess(existing, businessDate, user, env);
  return {
    businessDate,
    currentBusinessDate: today,
    hasCalculation: Boolean(existing),
    canSave: !existing && businessDate === today,
    canReplace: access.canReplace,
    isOwner: access.owner,
    isDaySubmitter: access.daySubmitter,
    calculation: existing ? {
      id: existing.id,
      totalKopecks: Number(existing.total_kopecks),
      morningKopecks: Number(existing.morning_kopecks),
      eveningKopecks: Number(existing.evening_kopecks),
      participantCount: Number(existing.participant_count),
      createdByName: existing.created_by_name || '',
      createdAt: existing.created_at,
    } : null,
  };
}

async function saveCalculation(request, env, user) {
  const body = await request.json();
  const businessDate = parseDate(body.businessDate);
  const today = businessDateNow();

  const totalKopecks = parseKopecks(body.totalKopecks, 'Итог');
  const morningKopecks = parseKopecks(body.morningKopecks, 'Утро');
  const eveningKopecks = parseKopecks(body.eveningKopecks, 'Вечер');
  const employees = Array.isArray(body.employees) ? body.employees.map(v => String(v || '')) : [];
  const replace = body.replace === true;
  const existing = await activeCalculationForDate(env, businessDate);

  if (!existing && businessDate !== today) {
    throw new ApiError(400, 'Новый расчёт можно сохранять только за текущий день по Москве.');
  }
  if (existing && !replace) {
    throw new ApiError(409, 'Расчёт за этот день уже сохранён. Используй исправление, если у тебя есть право на него.');
  }
  if (!existing && replace) {
    throw new ApiError(409, 'Сохранённого расчёта за этот день уже нет. Обнови приложение.');
  }

  if (existing && replace) {
    const access = replacementAccess(existing, businessDate, user, env);
    if (!access.canReplace) {
      if (businessDate !== today) {
        throw new ApiError(403, 'После 00:00 исправлять прошлые дни может только владелец.');
      }
      throw new ApiError(403, 'До 00:00 исправить расчёт может только сотрудник, который сохранил его первым, или владелец.');
    }
  }

  const result = calculateDistribution({ totalKopecks, morningKopecks, eveningKopecks, employees });
  const id = crypto.randomUUID();
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id);
  const daySubmitterId = existing
    ? String(existing.day_submitter_telegram_id || existing.created_by_telegram_id || user.id)
    : String(user.id);

  const statements = [];
  if (existing) {
    statements.push(env.DB.prepare(`UPDATE calculations
      SET is_active = 0, replaced_at = CURRENT_TIMESTAMP, replaced_by_telegram_id = ?
      WHERE id = ? AND is_active = 1`).bind(String(user.id), existing.id));
  }

  statements.push(env.DB.prepare(`INSERT INTO calculations
    (id, business_date, total_kopecks, morning_kopecks, evening_kopecks, fee_percent, participant_count,
     created_by_telegram_id, created_by_name, is_active, day_submitter_telegram_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .bind(id, businessDate, totalKopecks, morningKopecks, eveningKopecks, FEE_PERCENT, result.participantCount,
      String(user.id), displayName, daySubmitterId));

  statements.push(...result.payouts.map(p => env.DB.prepare(`INSERT INTO payouts
    (calculation_id, employee_name, position, amount_kopecks) VALUES (?, ?, ?, ?)`)
    .bind(id, p.employeeName, p.position, p.amountKopecks)));

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/UNIQUE|idx_calculations_one_active_day/i.test(message)) {
      throw new ApiError(409, 'Расчёт за этот день уже успел изменить другой сотрудник. Обнови приложение.');
    }
    throw error;
  }

  return { id, businessDate, replaced: Boolean(existing), ...result };
}

async function history(url, env) {
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const employee = url.searchParams.get('employee') || '';
  if (employee && !EMPLOYEES.includes(employee)) throw new ApiError(400, 'Неизвестный сотрудник.');

  const sql = `SELECT c.id, c.business_date, c.total_kopecks, c.morning_kopecks, c.evening_kopecks,
      c.participant_count, c.created_at, c.created_by_name,
      p.employee_name, p.position, p.amount_kopecks
    FROM calculations c JOIN payouts p ON p.calculation_id = c.id
    WHERE c.is_active = 1 AND c.business_date BETWEEN ? AND ? ${employee ? 'AND p.employee_name = ?' : ''}
    ORDER BY c.business_date DESC, c.created_at DESC, p.position ASC`;
  const stmt = env.DB.prepare(sql).bind(...(employee ? [from, to, employee] : [from, to]));
  const rows = (await stmt.all()).results || [];

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, {
      id: row.id,
      businessDate: row.business_date,
      totalKopecks: row.total_kopecks,
      morningKopecks: row.morning_kopecks,
      eveningKopecks: row.evening_kopecks,
      participantCount: row.participant_count,
      createdAt: row.created_at,
      createdByName: row.created_by_name,
      payouts: [],
    });
    map.get(row.id).payouts.push({ employeeName: row.employee_name, position: row.position, amountKopecks: row.amount_kopecks });
  }
  return [...map.values()];
}

async function summary(url, env) {
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const rows = (await env.DB.prepare(`WITH ledger AS (
      SELECT p.employee_name AS employee_name, p.amount_kopecks AS distributed_kopecks, 0 AS paid_kopecks, 1 AS entries
      FROM payouts p JOIN calculations c ON c.id = p.calculation_id
      WHERE c.is_active = 1 AND c.business_date BETWEEN ? AND ?
      UNION ALL
      SELECT employee_name, 0 AS distributed_kopecks, amount_kopecks AS paid_kopecks, 0 AS entries
      FROM payments
      WHERE business_date BETWEEN ? AND ?
    )
    SELECT employee_name,
           SUM(distributed_kopecks) AS distributed_kopecks,
           SUM(paid_kopecks) AS paid_kopecks,
           SUM(entries) AS entries
    FROM ledger
    GROUP BY employee_name
    ORDER BY employee_name`).bind(from, to, from, to).all()).results || [];

  return rows.map(r => {
    const distributedKopecks = Number(r.distributed_kopecks || 0);
    const paidKopecks = Number(r.paid_kopecks || 0);
    const dueKopecks = distributedKopecks - paidKopecks;
    return {
      employeeName: r.employee_name,
      distributedKopecks,
      paidKopecks,
      dueKopecks,
      totalKopecks: dueKopecks,
      entries: Number(r.entries || 0),
    };
  });
}

async function employeeDueForMonth(env, employeeName, businessDate) {
  const { from, to } = monthBounds(businessDate);
  const row = await env.DB.prepare(`SELECT
      COALESCE((SELECT SUM(p.amount_kopecks)
        FROM payouts p JOIN calculations c ON c.id = p.calculation_id
        WHERE c.is_active = 1 AND c.business_date BETWEEN ? AND ? AND p.employee_name = ?), 0) AS distributed_kopecks,
      COALESCE((SELECT SUM(amount_kopecks)
        FROM payments
        WHERE business_date BETWEEN ? AND ? AND employee_name = ?), 0) AS paid_kopecks`)
    .bind(from, to, employeeName, from, to, employeeName).first();
  const distributed = Number(row?.distributed_kopecks || 0);
  const paid = Number(row?.paid_kopecks || 0);
  return distributed - paid;
}

async function savePayment(request, env, user) {
  ensureOwner(user, env);
  const body = await request.json();
  const businessDate = parseDate(body.businessDate);
  if (businessDate > businessDateNow()) throw new ApiError(400, 'Нельзя записать выплату будущей датой.');
  const employeeName = String(body.employeeName || '');
  if (!EMPLOYEES.includes(employeeName)) throw new ApiError(400, 'Неизвестный сотрудник.');
  const amountKopecks = parseKopecks(body.amountKopecks, 'Выплата', { positive: true });
  const dueKopecks = await employeeDueForMonth(env, employeeName, businessDate);
  if (amountKopecks > dueKopecks) {
    throw new ApiError(400, `Сумма выплаты больше остатка сотрудника за этот месяц (${dueKopecks} коп.).`);
  }

  const id = crypto.randomUUID();
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id);
  await env.DB.prepare(`INSERT INTO payments
    (id, business_date, employee_name, amount_kopecks, created_by_telegram_id, created_by_name)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, businessDate, employeeName, amountKopecks, String(user.id), displayName).run();
  return { id, businessDate, employeeName, amountKopecks };
}

async function payments(url, env) {
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const rows = (await env.DB.prepare(`SELECT id, business_date, employee_name, amount_kopecks, created_by_name, created_at
    FROM payments
    WHERE business_date BETWEEN ? AND ?
    ORDER BY business_date DESC, created_at DESC`).bind(from, to).all()).results || [];
  return rows.map(row => ({
    id: row.id,
    businessDate: row.business_date,
    employeeName: row.employee_name,
    amountKopecks: Number(row.amount_kopecks),
    createdByName: row.created_by_name || '',
    createdAt: row.created_at,
  }));
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true }, 200, cors);
      if (url.pathname === '/api/whoami' && request.method === 'GET') {
        const user = await authenticate(request, env, { requireAllowlist: false });
        return json({
          id: String(user.id),
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          username: user.username || '',
          isOwner: isOwner(user, env),
          currentBusinessDate: businessDateNow(),
        }, 200, cors);
      }

      const user = await authenticate(request, env);
      if (url.pathname === '/api/day-status' && request.method === 'GET') return json(await dayStatus(url, env, user), 200, cors);
      if (url.pathname === '/api/calculations' && request.method === 'POST') return json(await saveCalculation(request, env, user), 201, cors);
      if (url.pathname === '/api/history' && request.method === 'GET') return json({ items: await history(url, env) }, 200, cors);
      if (url.pathname === '/api/audit-history' && request.method === 'GET') return json({ items: await auditHistory(url, env) }, 200, cors);
      if (url.pathname === '/api/summary' && request.method === 'GET') return json({ items: await summary(url, env) }, 200, cors);
      if (url.pathname === '/api/payments' && request.method === 'GET') return json({ items: await payments(url, env) }, 200, cors);
      if (url.pathname === '/api/payments' && request.method === 'POST') return json(await savePayment(request, env, user), 201, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 400;
      const message = error instanceof Error ? error.message : 'Ошибка сервера';
      return json({ error: message }, status, cors);
    }
  },
};
