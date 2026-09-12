export const EMPLOYEES = ['Александр', 'Александра', 'Анна', 'Арсик', 'Снежа'];
export const FEE_PERCENT = 8;

export function splitEvenly(totalKopecks, count) {
  if (!Number.isInteger(totalKopecks) || totalKopecks < 0) throw new Error('invalid amount');
  if (!Number.isInteger(count) || count < 1) throw new Error('invalid count');
  const base = Math.floor(totalKopecks / count);
  let remainder = totalKopecks % count;
  return Array.from({ length: count }, () => base + (remainder-- > 0 ? 1 : 0));
}

export function applyFee(grossKopecks) {
  return Math.round(grossKopecks * (100 - FEE_PERCENT) / 100);
}

export function calculateDistribution({ totalKopecks, morningKopecks, eveningKopecks, employees }) {
  const amounts = [totalKopecks, morningKopecks, eveningKopecks];
  if (amounts.some(v => !Number.isInteger(v) || v < 0)) throw new Error('Суммы должны быть целыми копейками и не меньше нуля.');
  if (morningKopecks + eveningKopecks > totalKopecks) throw new Error('Утро + вечер не могут быть больше итога.');
  if (!Array.isArray(employees) || employees.length !== 3) throw new Error('Нужно передать три позиции официантов.');

  const selected = employees.filter(Boolean);
  if (selected.length < 2 || selected.length > 3) throw new Error('В смене должно быть два или три официанта.');
  if (employees[0] === '' || employees[1] === '') throw new Error('Официанты 1 и 2 обязательны.');
  if (selected.some(name => !EMPLOYEES.includes(name))) throw new Error('Неизвестный сотрудник.');
  if (new Set(selected).size !== selected.length) throw new Error('Одного сотрудника нельзя выбрать дважды.');

  const participantCount = selected.length;
  const commonGross = totalKopecks - morningKopecks - eveningKopecks;
  const shiftGross = morningKopecks + eveningKopecks;
  const commonNet = applyFee(commonGross);
  const shiftNet = applyFee(shiftGross);

  const commonShares = splitEvenly(commonNet, participantCount);
  const shiftShares = splitEvenly(shiftNet, 2);

  const payouts = selected.map((employeeName, i) => ({
    employeeName,
    position: i + 1,
    amountKopecks: commonShares[i] + (i < 2 ? shiftShares[i] : 0),
  }));

  return {
    participantCount,
    commonGrossKopecks: commonGross,
    commonNetKopecks: commonNet,
    shiftGrossKopecks: shiftGross,
    shiftNetKopecks: shiftNet,
    distributedKopecks: payouts.reduce((sum, p) => sum + p.amountKopecks, 0),
    payouts,
  };
}
