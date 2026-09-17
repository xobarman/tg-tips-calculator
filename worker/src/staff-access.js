export function legacyAllowedIds(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean))];
}

export function validateTelegramId(value) {
  const id = String(value || '').trim();
  if (!/^[1-9]\d{4,19}$/.test(id)) throw new Error('Некорректный Telegram ID.');
  return id;
}

export async function resolveStaffAccess(env, telegramId) {
  const id = String(telegramId || '').trim();
  const row = await env.DB.prepare(`SELECT telegram_id, employee_name, active
    FROM staff_access WHERE telegram_id = ? LIMIT 1`).bind(id).first();

  if (row) {
    return {
      telegramId: String(row.telegram_id),
      employeeName: row.employee_name || '',
      allowed: Number(row.active) === 1,
      source: 'db',
    };
  }

  return {
    telegramId: id,
    employeeName: '',
    allowed: legacyAllowedIds(env.ALLOWED_TELEGRAM_USER_IDS).includes(id),
    source: 'legacy',
  };
}

export async function listStaffAccess(env) {
  const rows = (await env.DB.prepare(`SELECT telegram_id, employee_name, active, created_at, updated_at
    FROM staff_access ORDER BY active DESC, employee_name COLLATE NOCASE, telegram_id`).all()).results || [];

  const items = rows.map(row => ({
    telegramId: String(row.telegram_id),
    employeeName: row.employee_name || '',
    active: Number(row.active) === 1,
    source: 'db',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));

  const known = new Set(items.map(item => item.telegramId));
  for (const id of legacyAllowedIds(env.ALLOWED_TELEGRAM_USER_IDS)) {
    if (known.has(id)) continue;
    items.push({
      telegramId: id,
      employeeName: '',
      active: true,
      source: 'legacy',
      createdAt: null,
      updatedAt: null,
    });
  }

  return items;
}

export async function saveStaffAccess(env, { telegramId, employeeName, active }, updatedByTelegramId) {
  const id = validateTelegramId(telegramId);
  const name = String(employeeName || '').trim();
  const isActive = active !== false;

  await env.DB.prepare(`INSERT INTO staff_access
    (telegram_id, employee_name, active, updated_by_telegram_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      employee_name = excluded.employee_name,
      active = excluded.active,
      updated_at = CURRENT_TIMESTAMP,
      updated_by_telegram_id = excluded.updated_by_telegram_id`)
    .bind(id, name, isActive ? 1 : 0, String(updatedByTelegramId)).run();

  return {
    telegramId: id,
    employeeName: name,
    active: isActive,
    source: 'db',
  };
}
