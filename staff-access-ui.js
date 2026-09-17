const tg = window.Telegram?.WebApp;
const EMPLOYEES = ['Александр', 'Александра', 'Анна', 'Арсик', 'Снежа'];

const card = document.getElementById('staffAccessCard');
const list = document.getElementById('staffAccessList');
const statusEl = document.getElementById('staffAccessStatus');
const idInput = document.getElementById('staffAccessTelegramId');
const employeeSelect = document.getElementById('staffAccessEmployee');
const saveButton = document.getElementById('saveStaffAccess');

function apiHeaders(extra = {}) {
  return {
    'X-Telegram-Init-Data': tg?.initData || '',
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message = '', type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status${type ? ` ${type}` : ''}`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: apiHeaders(options.headers || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Ошибка запроса.');
  return payload;
}

function populateEmployees() {
  if (!employeeSelect || employeeSelect.options.length) return;
  employeeSelect.innerHTML = '<option value="">Выберите сотрудника</option>' +
    EMPLOYEES.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

function render(items) {
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="hint">Список пока пуст.</div>';
    return;
  }

  list.innerHTML = items.map(item => {
    const name = item.employeeName || 'Имя не назначено';
    const sourceLabel = item.source === 'legacy' ? 'старый список' : 'D1';
    const actionLabel = item.active ? 'Отключить' : 'Включить';
    const action = item.active ? 'disable' : 'enable';
    const needsSetup = !item.employeeName && !item.active;
    return `
      <div class="staff-access-item">
        <div class="staff-access-item__main">
          <b>${escapeHtml(name)}</b>
          <div class="hint">Telegram ID: ${escapeHtml(item.telegramId)}</div>
          <div class="staff-access-meta">
            <span class="staff-access-badge ${item.active ? 'is-active' : 'is-off'}">${item.active ? 'Доступ есть' : 'Отключён'}</span>
            <span class="hint">${escapeHtml(sourceLabel)}</span>
          </div>
        </div>
        <button class="secondary staff-access-action" type="button"
          data-id="${escapeHtml(item.telegramId)}"
          data-name="${escapeHtml(item.employeeName || '')}"
          data-action="${needsSetup ? 'setup' : action}">${needsSetup ? 'Настроить' : actionLabel}</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.staff-access-action').forEach(button => {
    button.addEventListener('click', async () => {
      const telegramId = button.dataset.id || '';
      const employeeName = button.dataset.name || '';
      const action = button.dataset.action || '';

      if (action === 'setup' || (action === 'enable' && !employeeName)) {
        if (idInput) idInput.value = telegramId;
        if (employeeSelect) employeeSelect.value = employeeName;
        idInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setStatus('Выберите имя сотрудника и нажмите «Добавить / обновить».');
        return;
      }

      button.disabled = true;
      try {
        await request('/api/staff-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId,
            employeeName,
            active: action === 'enable',
          }),
        });
        await loadAccess();
        setStatus(action === 'enable' ? 'Доступ включён.' : 'Доступ отключён.', 'success');
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadAccess() {
  const data = await request('/api/staff-access');
  render(data.items || []);
}

async function init() {
  if (!tg?.initData || !card) return;
  populateEmployees();
  try {
    const whoami = await request('/api/whoami');
    if (!whoami.isOwner) return;
    card.hidden = false;
    await loadAccess();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

saveButton?.addEventListener('click', async () => {
  const telegramId = idInput?.value.trim() || '';
  const employeeName = employeeSelect?.value || '';
  if (!telegramId || !employeeName) {
    setStatus('Укажи Telegram ID и выбери сотрудника.', 'error');
    return;
  }

  saveButton.disabled = true;
  try {
    await request('/api/staff-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, employeeName, active: true }),
    });
    if (idInput) idInput.value = '';
    if (employeeSelect) employeeSelect.value = '';
    await loadAccess();
    setStatus('Доступ сохранён. Деплой не нужен.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
});

init();
