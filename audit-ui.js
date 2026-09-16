const tgAudit = window.Telegram?.WebApp;
const auditQuery = new URLSearchParams(location.search);
const auditStoredApiBase = localStorage.getItem('tipsApiBase') || '';
const auditSameOriginApi = location.hostname.endsWith('.workers.dev') ? location.origin : '';
const AUDIT_API_BASE = auditQuery.get('api')?.replace(/\/$/, '') || auditStoredApiBase || auditSameOriginApi;

function auditMoney(value) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0) / 100) + ' ₽';
}

function auditEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function auditTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function auditChanges(current, previous) {
  if (!previous) {
    return `Итог ${auditMoney(current.totalKopecks)} · Утро ${auditMoney(current.morningKopecks)} · Вечер ${auditMoney(current.eveningKopecks)}`;
  }

  const changes = [];
  if (current.totalKopecks !== previous.totalKopecks) changes.push(`Итог ${auditMoney(previous.totalKopecks)} → ${auditMoney(current.totalKopecks)}`);
  if (current.morningKopecks !== previous.morningKopecks) changes.push(`Утро ${auditMoney(previous.morningKopecks)} → ${auditMoney(current.morningKopecks)}`);
  if (current.eveningKopecks !== previous.eveningKopecks) changes.push(`Вечер ${auditMoney(previous.eveningKopecks)} → ${auditMoney(current.eveningKopecks)}`);
  if (current.participantCount !== previous.participantCount) changes.push(`Сотрудников ${previous.participantCount} → ${current.participantCount}`);
  return changes.length ? changes.join(' · ') : 'Суммы не изменились; сохранена новая версия расчёта.';
}

async function auditApi(path) {
  if (!AUDIT_API_BASE || !tgAudit?.initData) throw new Error('Откройте приложение внутри Telegram.');
  const response = await fetch(`${AUDIT_API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': tgAudit.initData,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function ensureAuditSection() {
  let section = document.getElementById('auditTrail');
  if (section) return section;
  const historyList = document.getElementById('historyList');
  if (!historyList) return null;
  section = document.createElement('section');
  section.id = 'auditTrail';
  historyList.before(section);
  return section;
}

function renderAudit(items) {
  const section = ensureAuditSection();
  const historyList = document.getElementById('historyList');
  if (!section || !historyList) return;

  if (!items.length) {
    section.innerHTML = '<section class="card"><div class="section-title">Журнал действий</div><div class="status">За этот период записей нет.</div></section>';
    historyList.hidden = true;
    return;
  }

  const days = new Map();
  for (const item of items) {
    if (!days.has(item.businessDate)) days.set(item.businessDate, []);
    days.get(item.businessDate).push(item);
  }

  section.innerHTML = [...days.entries()].map(([businessDate, versions]) => {
    versions.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const entries = versions.map((item, index) => {
      const previous = index > 0 ? versions[index - 1] : null;
      const action = index === 0 ? 'Внёс расчёт' : 'Исправил расчёт';
      const version = index === 0 ? 'Первичный расчёт' : `Исправление ${index}`;
      const badge = item.isActive ? '<span style="color:var(--ok);font-weight:800">Текущий</span>' : '<span style="color:var(--muted)">Предыдущая версия</span>';
      const payouts = (item.payouts || []).map(p =>
        `<div class="result-line"><span>${auditEscape(p.employeeName)}</span><b>${auditMoney(p.amountKopecks)}</b></div>`
      ).join('');
      return `<div style="padding:14px 0;${index ? 'border-top:1px solid var(--border);' : ''}">
        <div class="history-meta" style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <span>${auditEscape(version)}</span>${badge}
        </div>
        <div style="font-weight:850;margin:4px 0 3px">${auditEscape(action)}: ${auditEscape(item.createdByName || 'Telegram')}</div>
        <div class="history-meta">${auditEscape(auditTime(item.createdAt))} · ${auditEscape(auditChanges(item, previous))}</div>
        <div style="margin-top:6px">${payouts}</div>
      </div>`;
    }).join('');

    return `<article class="card history-card">
      <h3>${auditEscape(businessDate)}</h3>
      <div class="history-meta">Все сохранения и исправления за день</div>
      ${entries}
    </article>`;
  }).join('');

  historyList.hidden = true;
}

async function loadAuditHistory() {
  const historyTab = document.getElementById('historyTab');
  if (!historyTab || historyTab.hidden) return;
  const from = document.getElementById('fromDate')?.value || '';
  const to = document.getElementById('toDate')?.value || '';
  const employee = document.getElementById('employeeFilter')?.value || '';
  if (!from || !to) return;

  const section = ensureAuditSection();
  if (section) section.innerHTML = '<section class="card"><div class="section-title">Журнал действий</div><div class="status">Загружаю журнал…</div></section>';

  try {
    const data = await auditApi(`/api/audit-history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${employee ? `&employee=${encodeURIComponent(employee)}` : ''}`);
    renderAudit(data.items || []);
  } catch (error) {
    const historyList = document.getElementById('historyList');
    if (historyList) historyList.hidden = false;
    if (section) section.innerHTML = `<section class="card"><div class="section-title">Журнал действий</div><div class="status bad">${auditEscape(error.message)}</div></section>`;
  }
}

const historyTabButton = document.querySelector('.tab[data-tab="history"]');
historyTabButton?.addEventListener('click', () => setTimeout(loadAuditHistory, 120));
document.getElementById('loadHistory')?.addEventListener('click', () => setTimeout(loadAuditHistory, 120));
document.querySelectorAll('.period').forEach(button => button.addEventListener('click', () => {
  if (!document.getElementById('historyTab')?.hidden) setTimeout(loadAuditHistory, 120);
}));
