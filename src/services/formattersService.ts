/**
 * Formatting Service
 * Contains utility functions for formatting dates, times, and other data types
 */

/**
 * Formats an ISO date string to DD.MM.YYYY format
 * @param isoDate - ISO date string
 * @returns Formatted date string (DD.MM.YYYY)
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getDate();
  const month = date.getMonth() + 1; // months are zero-based
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Formats an ISO datetime string to DD.MM.YYYY HH:MM format
 * @param isoDateTime - ISO datetime string
 * @returns Formatted datetime string (DD.MM.YYYY HH:MM) or null if input is null/undefined
 */
export function formatDateTime(isoDateTime: string | null | undefined): string | null {
  if (!isoDateTime) return null;
  const date = new Date(isoDateTime);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Formats a date string to Hebrew locale format
 * @param dateString - Date string or null
 * @returns Formatted date in Hebrew locale or empty string if null
 */
export function formatDateHebrew(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('he-IL');
}
