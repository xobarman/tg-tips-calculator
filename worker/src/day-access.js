// A missing historical day can be backfilled only by the configured owner.
// An administrator may correct existing records but does not acquire this right.
export function canCreateCalculationForDate(hasExisting, businessDate, today, isOwner) {
  if (hasExisting || businessDate > today) return false;
  return businessDate === today || isOwner === true;
}
