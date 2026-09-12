const EMPLOYEES = ['Александр', 'Александра', 'Анна', 'Арсик', 'Снежа'];
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const $ = id => document.getElementById(id);

const query = new URLSearchParams(location.search);
if (query.get('api')) localStorage.setItem('tipsApiBase', query.get('api').replace(/\/$/, ''));
const API_BASE = localStorage.getItem('tipsApiBase') || '';
let lastCalculation = null;

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
function todayIso() { return new Date().toLocaleDateString('sv-SE'); }
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

  lastCalculation = { businessDate: $('businessDate').value || todayIso(), totalKopecks: total, morningKopecks: morning, eveningKopecks: evening, employees, payouts };
  $('resultLines').innerHTML = payouts.map(p => `<div class="result-line"><span class="name">${p.employeeName}</span><span class="amount">${moneyKopecks(p.amountKopecks)}</span></div>`).join('');
  $('commonNet').textContent = moneyKopecks(commonNet);
  $('shiftNet').textContent = moneyKopecks(shiftNet);
  $('distributed').textContent = moneyKopecks(distributed);
  $('results').style.display = 'block';
  setStatus($('saveStatus'), API_BASE ? '' : 'История пока не подключена: расчёт можно проверять, сохранение включим после Worker.');
  $('save').disabled = !API_BASE;
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

async function saveCalculation() {
  if (!lastCalculation) return;
  $('save').disabled = true; setStatus($('saveStatus'), 'Сохраняю…');
  try {
    await api('/api/calculations', { method: 'POST', body: JSON.stringify(lastCalculation) });
    setStatus($('saveStatus'), 'Сохранено в историю.', 'ok');
    tg?.HapticFeedback?.notificationOccurred('success');
  } catch (e) { setStatus($('saveStatus'), e.message, 'bad'); $('save').disabled = false; }
}

function setPeriod(kind) {
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth();
  const start = kind === 'month' || d.getDate() <= 15 ? new Date(y, m, 1) : new Date(y, m, 16);
  const end = kind === 'month' ? new Date(y, m + 1, 0) : (d.getDate() <= 15 ? new Date(y, m, 15) : new Date(y, m + 1, 0));
  const iso = x => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('fromDate').value = iso(start); $('toDate').value = iso(end);
}

async function loadHistory() {
  if (!API_BASE) return setStatus($('historyStatus'), 'История появится после подключения Cloudflare Worker.', 'bad');
  const from = $('fromDate').value, to = $('toDate').value, employee = $('employeeFilter').value;
  setStatus($('historyStatus'), 'Загружаю…');
  try {
    const [history, summary] = await Promise.all([
      api(`/api/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${employee ? `&employee=${encodeURIComponent(employee)}` : ''}`),
      api(`/api/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ]);
    $('summaryLines').innerHTML = summary.items.length ? summary.items.map(i => `<div class="summary-line"><span>${i.employeeName}</span><b>${moneyKopecks(i.totalKopecks)}</b></div>`).join('') : '<div class="status">Нет данных.</div>';
    $('summaryCard').hidden = false;
    $('historyList').innerHTML = history.items.length ? history.items.map(item => `<article class="card history-card"><h3>${item.businessDate}</h3><div class="history-meta">Итог ${moneyKopecks(item.totalKopecks)} · сохранил ${item.createdByName || 'Telegram'}</div>${item.payouts.map(p => `<div class="result-line"><span>${p.employeeName}</span><b>${moneyKopecks(p.amountKopecks)}</b></div>`).join('')}</article>`).join('') : '<section class="card"><div class="status">За этот период записей нет.</div></section>';
    setStatus($('historyStatus'), '');
  } catch (e) { setStatus($('historyStatus'), e.message, 'bad'); }
}

function openTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $('calcTab').hidden = name !== 'calc'; $('historyTab').hidden = name !== 'history';
  if (name === 'history' && API_BASE) loadHistory();
}

populateSelect($('employee1')); populateSelect($('employee2')); populateSelect($('employee3'), { allowBlank: true }); populateSelect($('employeeFilter'), { allLabel: 'Все сотрудники' });
[$('employee1'), $('employee2'), $('employee3')].forEach(s => s.addEventListener('change', refreshDisabledOptions));
$('businessDate').value = todayIso(); setPeriod('half');
$('calc').addEventListener('click', calculate); $('reset').addEventListener('click', reset); $('save').addEventListener('click', saveCalculation); $('loadHistory').addEventListener('click', loadHistory);
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
document.querySelectorAll('.period').forEach(b => b.addEventListener('click', () => setPeriod(b.dataset.period)));
['total', 'morning', 'evening'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); }));
if (!API_BASE) $('devNotice').hidden = false;
