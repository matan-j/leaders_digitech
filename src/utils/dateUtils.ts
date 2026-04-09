/**
 * Formats a Date to YYYY-MM-DD using local calendar getters (timezone-safe).
 * Avoids the off-by-one day bug that occurs when using toISOString() on dates
 * near midnight in UTC+ timezones.
 */
export const formatDateLocal = (date: Date): string =>
  date.getFullYear() +
  '-' +
  String(date.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(date.getDate()).padStart(2, '0');
