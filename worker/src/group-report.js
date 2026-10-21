import { FEE_PERCENT } from './calc.js';

const formatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = kopecks => formatter.format(kopecks / 100) + ' ₽';

function displayDate(iso) {
  const [year, month, day] = iso.split('-');
  return [day, month, year].join('.');
}

export function formatCalculationReport({
  businessDate, replaced, createdByName, totalKopecks, morningKopecks, eveningKopecks, result,
}) {
  const commonCount = result.participantCount;
  const shiftCount = Math.min(2, commonCount);
  const commonGross = totalKopecks - morningKopecks - eveningKopecks;
  const shiftGross = morningKopecks + eveningKopecks;
  const editor = String(createdByName || 'Сотрудник').replace(/[\r\n\t]+/g, ' ').slice(0, 90);
  const lines = [
    replaced ? '✏️ ЧАЕВЫЕ · ИСПРАВЛЕННЫЙ РАСЧЁТ' : '🧾 ЧАЕВЫЕ · НОВЫЙ РАСЧЁТ',
    'Дата смены: ' + displayDate(businessDate),
    'Сохранил: ' + editor,
    '',
    'Итого за день: ' + money(totalKopecks),
    'Утро: ' + money(morningKopecks),
    'Вечер: ' + money(eveningKopecks),
    'Общая часть: ' + money(commonGross),
    '',
    'Комиссия: ' + FEE_PERCENT + '% (коэффициент ×0,92)',
    'Общая часть после комиссии: ' + money(result.commonNetKopecks),
    'Утро + вечер после комиссии: ' + money(result.shiftNetKopecks),
    'Коэффициент общей части: 1/' + commonCount + ' на каждого',
    'Коэффициент утра/вечера: 1/' + shiftCount + ' первым ' + shiftCount,
    '',
    'Распределение:',
    ...result.payouts.map(p => '• ' + p.employeeName + ' — ' + money(p.amountKopecks)),
    '',
    'Всего начислено за смену: ' + money(result.distributedKopecks),
    'Комиссия в рублях: ' + money(totalKopecks - result.distributedKopecks),
  ];
  return lines.join('\n');
}

/**
 * Best-effort notification AFTER D1 commit. The absence/failure of Telegram
 * delivery must NEVER roll back tips or make the owner re-save the day.
 * The group ID is a Worker secret, intentionally isolated between DEV/PROD.
 */
export async function notifyCalculationGroup(env, details, send = fetch) {
  const groupId = String(env.TIPS_GROUP_CHAT_ID || '').trim();
  if (!groupId) return { status: 'not_configured' };
  if (!/^-\d{5,20}$/.test(groupId) || !env.TELEGRAM_BOT_TOKEN) {
    return { status: 'failed' };
  }

  try {
    const response = await send('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupId,
        text: formatCalculationReport(details),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    return { status: response.ok && payload?.ok === true ? 'sent' : 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
