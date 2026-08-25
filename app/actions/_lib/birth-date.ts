const DD_MM_YYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Parses a `dd/mm/aaaa` string into an ISO `YYYY-MM-DD` date.
 * Returns `null` when the format is wrong or the date is not real
 * (e.g. `31/02/2024` rolls over and gets rejected).
 */
export const parseDdMmYyyy = (value: string): string | null => {
  const match = DD_MM_YYYY_REGEX.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  const parsed = new Date(year, month - 1, day);
  const isRealDate =
    parsed.getDate() === day &&
    parsed.getMonth() === month - 1 &&
    parsed.getFullYear() === year;

  if (!isRealDate) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
};

/** Checks whether an ISO `YYYY-MM-DD` date is after today (local time). */
export const isDateInFuture = (isoDate: string): boolean => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return parsed.getTime() > today.getTime();
};
