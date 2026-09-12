const EMPLOYEES = ['Александр', 'Александра', 'Анна', 'Арсик', 'Снежа'];
const BUSINESS_TIME_ZONE = 'Europe/Moscow';
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const $ = id => document.getElementById(id);

const query = new URLSearchParams(location.search);
if (query.get('api')) localStorage.setItem('tipsApiBase', query.get('api').replace(/\/$/, ''));
const storedApiBase = localStorage.getItem('tipsApiBase') || '';
const cloudflareSameOriginApi = location.hostname.endsWith('.workers.dev') ? location.origin : '';
const API_BASE = storedApiBase || cloudflareSameOriginApi;
let lastCalculation = null;
let currentUser = null;
let currentDayStatus = null;

function moneyKopecks(value) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100) + ' ₽';
}
function parseMoneyToKopecks(value) {
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  if (normalized === '') return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}
function applyFee(value) { return Math.round(value * 92 / 100); }
function splitEvenly(total, count) {
  const base = Math.floor(total / count); let remainder = total % count;
  return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
}
function businessTodayIso() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function isoUtcDate(date) { return date.toISOString().slice(0, 10); }
function monthBounds(offset = 0) {
  const [year, month] = businessTodayIso().split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(year, month + offset, 0));
  const rawLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  return {
    from: isoUtcDate(first),
    to: isoUtcDate(last),
    label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
  };
}
function uniqueSelected() { return [$('employee1').value, $('employee2').value, $('employee3').value].filter(Boolean); }

function populateSelect(select, { allowBlank = false, allLabel = null } = {}) {
  select.innerHTML = '';
  if (allLabel !== null) select.add(new Option(allLabel, ''));
  else if (allowBlank) select.add(new Option('⬜ Нет третьего', ''));
  else select.add(new Option('Выбрать сотрудника', ''));
  EMPLOYEES.forEach(name => select.add(new Option(name, name)));
}

function refreshDisabledOptions() {
  const selects = [$('employee1'), $('employee2'), $('employee3')];
  const values = selects.map(s => s.value);
  selects.forEach((select, index) => {
    [...select.options].forEach(option => {
      if (!option.value) return;
      option.disabled = values.some((value, i) => i !== index && value === option.value);
    });
  });
}

function showError(message) { $('error').textContent = message; $('error').style.display = 'block'; $('results').style.display = 'none'; }
function clearError() { $('error').style.display = 'none'; $('error').textContent = ''; }
function setStatus(el, text, kind = '') { el.textContent = text; el.className = `status ${kind}`; }

function calculate() {
  clearError();
  const total = parseMoneyToKopecks($('total').value);
  const morning = parseMoneyToKopecks($('morning').value);
  const evening = parseMoneyToKopecks($('evening').value);
  const employees = [$('employee1').value, $('employee2').value, $('employee3').value];
  if ([total, morning, evening].some(Number.isNaN)) return showError('Проверь суммы: можно вводить через точку или запятую.');
  if ([total, morning, evening].some(v => v < 0)) return showError('Суммы не могут быть отрицательными.');
  if (morning + evening > total) return showError('Утро + вечер не могут быть больше итога.');
  if (!employees[0] || !employees[1]) return showError('Выбери официантов 1 и 2.');
  const selected = uniqueSelected();
  if (new Set(selected).size !== selected.length) return showError('Одного сотрудника нельзя выбрать дважды.');

  const participantCount = selected.length;
  const commonNet = applyFee(total - morning - evening);
  const shiftNet = applyFee(morning + evening);
  const common = splitEvenly(commonNet, participantCount);
  const shift = splitEvenly(shiftNet, 2);
  const payouts = selected.map((employeeName, i) => ({ employeeName, position: i + 1, amountKopecks: common[i] + (i < 2 ? shift[i] : 0) }));
  const distributed = payouts.reduce((sum, p) => sum + p.amountKopecks, 0);

  lastCalculation = { businessDate: $('businessDate').value || businessTodayIso(), totalKopecks: total, morningKopecks: morning, eveningKopecks: evening, employees, payouts };
  $('resultLines').innerHTML = payouts.map(p => `<div class="result-line"><span class="name">${p.employeeName}</span><span class="amount">${moneyKopecks(p.amountKopecks)}</span></div>`).join('');
  $('commonNet').textContent = moneyKopecks(commonNet);
  $('shiftNet').textContent = moneyKopecks(shiftNet);
  $('distributed').textContent = moneyKopecks(distributed);
  $('results').style.display = 'block';
  updateSaveAvailability();
  tg?.HapticFeedback?.notificationOccurred('success');
}

function reset() {
  ['total', 'morning', 'evening'].forEach(id => $(id).value = '');
  $('employee1').value = ''; $('employee2').value = ''; $('employee3').value = '';
  refreshDisabledOptions(); lastCalculation = null; $('results').style.display = 'none'; clearError();
}

async function api(path, options = {}) {
  if (!API_BASE) throw new Error('Cloudflare Worker ещё не подключён.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': tg?.initData || '', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function confirmAction(message) {
  return new Promise(resolve => {
    if (tg?.showConfirm) tg.showConfirm(message, ok => resolve(Boolean(ok)));
    else resolve(window.confirm(message));
  });
}

function updateSaveAvailability() {
  if (!API_BASE) {
    $('save').disabled = true;
    setStatus($('saveStatus'), 'История пока не подключена.');
    return;
  }
  if (!lastCalculation) {
    $('save').disabled = true;
    return;
  }
  if (!currentDayStatus) {
    $('save').disabled = false;
    $('save').textContent = '💾 Сохранить расчёт';
    return;
  }
  if (!currentDayStatus.hasCalculation) {
    $('save').disabled = !currentDayStatus.canSave;
    $('save').textContent = '💾 Сохранить расчёт';
    return;
  }
  if (currentDayStatus.canReplace) {
    $('save').disabled = false;
    $('save').textContent = '↻ Сохранить исправление';
    return;
  }
  $('save').disabled = true;
  $('save').textContent = '✓ Расчёт за сегодня сохранён';
}

async function loadDayStatus() {
  if (!API_BASE) return;
  const date = $('businessDate').value || businessTodayIso();
  try {
    currentDayStatus = await api(`/api/day-status?date=${encodeURIComponent(date)}`);
    if (!currentDayStatus.hasCalculation) {
      setStatus($('dayStatus'), 'Сегодня ещё нет сохранённого расчёта. Первый сохранённый расчёт станет итоговым за сутки.', 'ok');
    } else if (currentDayStatus.canReplace) {
      const author = currentDayStatus.calculation?.createdByName || 'сотрудником';
      setStatus($('dayStatus'), `Расчёт за сегодня уже сохранён (${author}). До 00:00 по Москве ты можешь заменить его исправленным расчётом.`, 'owner');
    } else {
      const author = currentDayStatus.calculation?.createdByName || 'сотрудником';
      setStatus($('dayStatus'), `Расчёт за сегодня уже сохранён (${author}). Повторное сохранение закрыто до следующего дня.`, 'locked');
    }
  } catch (e) {
    currentDayStatus = null;
    setStatus($('dayStatus'), e.message, 'bad');
  }
  updateSaveAvailability();
}

async function loadMonthlyCounter() {
  if (!API_BASE) return;
  const period = monthBounds(0);
  $('monthlyCard').hidden = false;
  $('monthlyLabel').textContent = period.label;
  $('monthlyPeople').innerHTML = '';

  try {
    const summary = await api(`/api/summary?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`);
    const distributed = summary.items.reduce((sum, item) => sum + item.distributedKopecks, 0);
    const paid = summary.items.reduce((sum, item) => sum + item.paidKopecks, 0);
    const due = summary.items.reduce((sum, item) => sum + item.dueKopecks, 0);
    $('monthlyTotal').textContent = moneyKopecks(due);
    $('monthlyCaption').textContent = summary.items.length
      ? `Распределено ${moneyKopecks(distributed)} · выплачено ${moneyKopecks(paid)}`
      : 'Новый месяц начался — сохранённых расчётов пока нет.';

    $('monthlyPeople').innerHTML = summary.items.map(item =>
      `<div class="monthly-person"><span>${item.employeeName}<small>Распределено ${moneyKopecks(item.distributedKopecks)} · выплачено ${moneyKopecks(item.paidKopecks)}</small></span><b>${moneyKopecks(item.dueKopecks)}</b></div>`
    ).join('');
  } catch (e) {
    $('monthlyTotal').textContent = '—';
    $('monthlyCaption').textContent = e.message;
  }
}

async function saveCalculation() {
  if (!lastCalculation) return;
  const replacing = Boolean(currentDayStatus?.hasCalculation);
  if (replacing && !currentDayStatus?.canReplace) {
    return setStatus($('saveStatus'), 'Расчёт за сегодня уже сохранён другим сотрудником.', 'bad');
  }
  if (replacing) {
    const ok = await confirmAction('Заменить сегодняшний сохранённый расчёт? Старый вариант останется только в техническом журнале и перестанет влиять на суммы.');
    if (!ok) return;
  }

  $('save').disabled = true;
  setStatus($('saveStatus'), replacing ? 'Сохраняю исправление…' : 'Сохраняю…');
  try {
    await api('/api/calculations', { method: 'POST', body: JSON.stringify({ ...lastCalculation, replace: replacing }) });
    setStatus($('saveStatus'), replacing ? 'Исправленный расчёт сохранён.' : 'Сохранено в историю.', 'ok');
    tg?.HapticFeedback?.notificationOccurred('success');
    await Promise.all([loadDayStatus(), loadMonthlyCounter()]);
  } catch (e) {
    setStatus($('saveStatus'), e.message, 'bad');
    await loadDayStatus().catch(() => {});
  }
}

function setPeriod(kind) {
  if (kind === 'month' || kind === 'prev-month') {
    const period = monthBounds(kind === 'prev-month' ? -1 : 0);
    $('fromDate').value = period.from;
    $('toDate').value = period.to;
    return;
  }

  const [year, month, day] = businessTodayIso().split('-').map(Number);
  const start = day <= 15 ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, month - 1, 16));
  const end = day <= 15 ? new Date(Date.UTC(year, month - 1, 15)) : new Date(Date.UTC(year, month, 0));
  $('fromDate').value = isoUtcDate(start);
  $('toDate').value = isoUtcDate(end);
}

function renderSummary(items) {
  $('summaryLines').innerHTML = items.length ? items.map(i =>
    `<div class="summary-line balance-line"><span>${i.employeeName}<small>Распределено ${moneyKopecks(i.distributedKopecks)} · выплачено ${moneyKopecks(i.paidKopecks)}</small></span><b>${moneyKopecks(i.dueKopecks)}</b></div>`
  ).join('') : '<div class="status">Нет данных.</div>';
  $('summaryCard').hidden = false;
}

function renderPaymentHistory(items) {
  $('paymentHistoryCard').hidden = !items.length;
  $('paymentHistoryList').innerHTML = items.map(item =>
    `<div class="payment-row"><span><b>${item.employeeName}</b><small>${item.businessDate} · ${item.createdByName || 'Telegram'}</small></span><strong>−${moneyKopecks(item.amountKopecks)}</strong></div>`
  ).join('');
}

async function loadHistory() {
  if (!API_BASE) return setStatus($('historyStatus'), 'История появится после подключения Cloudflare Worker.', 'bad');
  const from = $('fromDate').value, to = $('toDate').value, employee = $('employeeFilter').value;
  setStatus($('historyStatus'), 'Загружаю…');
  try {
    const [history, summary, paymentHistory] = await Promise.all([
      api(`/api/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${employee ? `&employee=${encodeURIComponent(employee)}` : ''}`),
      api(`/api/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      api(`/api/payments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ]);
    renderSummary(summary.items);
    renderPaymentHistory(paymentHistory.items);
    $('historyList').innerHTML = history.items.length ? history.items.map(item => `<article class="card history-card"><h3>${item.businessDate}</h3><div class="history-meta">Итог ${moneyKopecks(item.totalKopecks)} · сохранил ${item.createdByName || 'Telegram'}</div>${item.payouts.map(p => `<div class="result-line"><span>${p.employeeName}</span><b>${moneyKopecks(p.amountKopecks)}</b></div>`).join('')}</article>`).join('') : '<section class="card"><div class="status">За этот период записей нет.</div></section>';
    setStatus($('historyStatus'), '');
  } catch (e) { setStatus($('historyStatus'), e.message, 'bad'); }
}

async function savePayment() {
  const employeeName = $('paymentEmployee').value;
  const amountKopecks = parseMoneyToKopecks($('paymentAmount').value);
  const businessDate = $('paymentDate').value;
  if (!employeeName) return setStatus($('paymentStatus'), 'Выбери сотрудника.', 'bad');
  if (!businessDate) return setStatus($('paymentStatus'), 'Выбери дату выплаты.', 'bad');
  if (!Number.isInteger(amountKopecks) || amountKopecks <= 0) return setStatus($('paymentStatus'), 'Укажи сумму выплаты больше нуля.', 'bad');

  $('savePayment').disabled = true;
  setStatus($('paymentStatus'), 'Сохраняю выплату…');
  try {
    await api('/api/payments', { method: 'POST', body: JSON.stringify({ businessDate, employeeName, amountKopecks }) });
    $('paymentAmount').value = '';
    setStatus($('paymentStatus'), 'Выплата записана и вычтена из остатка.', 'ok');
    tg?.HapticFeedback?.notificationOccurred('success');
    await Promise.all([loadMonthlyCounter(), loadHistory()]);
  } catch (e) {
    setStatus($('paymentStatus'), e.message, 'bad');
  } finally {
    $('savePayment').disabled = false;
  }
}

async function loadIdentity() {
  if (!API_BASE || !tg?.initData) return null;
  try {
    currentUser = await api('/api/whoami');
    const today = currentUser.currentBusinessDate || businessTodayIso();
    $('businessDate').value = today;
    $('businessDate').min = today;
    $('businessDate').max = today;
    $('paymentDate').value = today;
    $('paymentDate').max = today;
    $('ownerPaymentCard').hidden = !currentUser.isOwner;
    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}

async function showDevIdentity() {
  if (!location.hostname.endsWith('.workers.dev')) return;
  $('devNotice').hidden = false;
  $('devNoticeText').textContent = 'Изолированная тестовая версия Cloudflare. Рабочий бот и main не затронуты.';
  if (!tg?.initData) {
    $('devIdentity').textContent = 'Для проверки истории эту версию нужно открыть как Telegram Mini App.';
    return;
  }
  const user = currentUser || await loadIdentity();
  if (!user) return;
  const label = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Telegram пользователь';
  $('devIdentity').textContent = `${label}${user.isOwner ? ' · владелец' : ''} · Telegram ID: ${user.id}`;
}

function openTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $('calcTab').hidden = name !== 'calc'; $('historyTab').hidden = name !== 'history';
  if (name === 'history' && API_BASE) loadHistory();
  if (name === 'calc' && API_BASE) loadMonthlyCounter();
}

populateSelect($('employee1'));
populateSelect($('employee2'));
populateSelect($('employee3'), { allowBlank: true });
populateSelect($('employeeFilter'), { allLabel: 'Все сотрудники' });
populateSelect($('paymentEmployee'));
[$('employee1'), $('employee2'), $('employee3')].forEach(s => s.addEventListener('change', refreshDisabledOptions));
const initialToday = businessTodayIso();
$('businessDate').value = initialToday;
$('businessDate').min = initialToday;
$('businessDate').max = initialToday;
$('paymentDate').value = initialToday;
$('paymentDate').max = initialToday;
setPeriod('half');
$('save').disabled = true;
$('calc').addEventListener('click', calculate);
$('reset').addEventListener('click', reset);
$('save').addEventListener('click', saveCalculation);
$('savePayment').addEventListener('click', savePayment);
$('loadHistory').addEventListener('click', loadHistory);
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
document.querySelectorAll('.period').forEach(b => b.addEventListener('click', () => setPeriod(b.dataset.period)));
['total', 'morning', 'evening'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); }));
if (!API_BASE) $('devNotice').hidden = false;

(async () => {
  await loadIdentity();
  await Promise.allSettled([showDevIdentity(), loadDayStatus(), loadMonthlyCounter()]);
})();
