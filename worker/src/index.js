import { EMPLOYEES, FEE_PERCENT, calculateDistribution } from './calc.js';

const encoder = new TextEncoder();

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
  if (!initData || !botToken) throw new Error('Telegram initData или bot token отсутствует.');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Telegram hash отсутствует.');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmac(encoder.encode('WebAppData'), botToken);
  const calculatedHash = hex(await hmac(secretKey, dataCheckString));
  if (!timingSafeEqualHex(calculatedHash, receivedHash.toLowerCase())) throw new Error('Некорректная Telegram подпись.');

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate > maxAgeSeconds || authDate - now > 60) {
    throw new Error('Telegram-сессия устарела. Переоткрой приложение.');
  }

  let user;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { user = null; }
  if (!user?.id) throw new Error('Telegram пользователь отсутствует.');
  return user;
}

function ensureAllowedUser(user, env) {
  const ids = String(env.ALLOWED_TELEGRAM_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('Список разрешённых Telegram ID ещё не настроен.');
  if (!ids.includes(String(user.id))) throw new Error('У вас пока нет доступа к истории чаевых.');
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Некорректная дата.');
  return value;
}

function parseKopecks(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field}: некорректная сумма.`);
  return value;
}

async function authenticate(request, env, { requireAllowlist = true } = {}) {
  const initData = request.headers.get('X-Telegram-Init-Data') || '';
  const user = await validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (requireAllowlist) ensureAllowedUser(user, env);
  return user;
}

async function saveCalculation(request, env, user) {
  const body = await request.json();
  const businessDate = parseDate(body.businessDate);
  const totalKopecks = parseKopecks(body.totalKopecks, 'Итог');
  const morningKopecks = parseKopecks(body.morningKopecks, 'Утро');
  const eveningKopecks = parseKopecks(body.eveningKopecks, 'Вечер');
  const employees = Array.isArray(body.employees) ? body.employees.map(v => String(v || '')) : [];

  const result = calculateDistribution({ totalKopecks, morningKopecks, eveningKopecks, employees });
  const id = crypto.randomUUID();
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id);

  const statements = [
    env.DB.prepare(`INSERT INTO calculations
      (id, business_date, total_kopecks, morning_kopecks, evening_kopecks, fee_percent, participant_count, created_by_telegram_id, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, businessDate, totalKopecks, morningKopecks, eveningKopecks, FEE_PERCENT, result.participantCount, String(user.id), displayName),
    ...result.payouts.map(p => env.DB.prepare(`INSERT INTO payouts
      (calculation_id, employee_name, position, amount_kopecks) VALUES (?, ?, ?, ?)`)
      .bind(id, p.employeeName, p.position, p.amountKopecks)),
  ];

  await env.DB.batch(statements);
  return { id, businessDate, ...result };
}

async function history(url, env) {
  const from = parseDate(url.searchParams.get('from'));
  const to = parseDate(url.searchParams.get('to'));
  const employee = url.searchParams.get('employee') || '';
  if (employee && !EMPLOYEES.includes(employee)) throw new Error('Неизвестный сотрудник.');

  const sql = `SELECT c.id, c.business_date, c.total_kopecks, c.morning_kopecks, c.evening_kopecks,
      c.participant_count, c.created_at, c.created_by_name,
      p.employee_name, p.position, p.amount_kopecks
    FROM calculations c JOIN payouts p ON p.calculation_id = c.id
    WHERE c.business_date BETWEEN ? AND ? ${employee ? 'AND p.employee_name = ?' : ''}
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
  const rows = (await env.DB.prepare(`SELECT p.employee_name, SUM(p.amount_kopecks) AS total_kopecks, COUNT(*) AS entries
    FROM payouts p JOIN calculations c ON c.id = p.calculation_id
    WHERE c.business_date BETWEEN ? AND ?
    GROUP BY p.employee_name ORDER BY p.employee_name`).bind(from, to).all()).results || [];
  return rows.map(r => ({ employeeName: r.employee_name, totalKopecks: Number(r.total_kopecks || 0), entries: Number(r.entries || 0) }));
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
        return json({ id: String(user.id), firstName: user.first_name || '', lastName: user.last_name || '', username: user.username || '' }, 200, cors);
      }

      const user = await authenticate(request, env);
      if (url.pathname === '/api/calculations' && request.method === 'POST') return json(await saveCalculation(request, env, user), 201, cors);
      if (url.pathname === '/api/history' && request.method === 'GET') return json({ items: await history(url, env) }, 200, cors);
      if (url.pathname === '/api/summary' && request.method === 'GET') return json({ items: await summary(url, env) }, 200, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка сервера';
      const authLike = /Telegram|доступ|разреш/.test(message);
      return json({ error: message }, authLike ? 403 : 400, cors);
    }
  },
};
