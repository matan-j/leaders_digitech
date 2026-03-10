/**
 * Address Service
 * Contains utility functions for parsing and processing addresses
 */

/**
 * Extracts the city name from a full address string
 * Attempts to parse the city from common address patterns
 * @param address - Full address string
 * @returns City name or 'לא צוין' if not found
 */
export function extractCityFromAddress(address: string): string {
  if (!address) return 'לא צוין';

  // Split by comma and take the last part (usually the city)
  const parts = address.split(',').map(part => part.trim());
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }

  // If no comma, try to extract city from common patterns
  const words = address.split(' ').map(word => word.trim());
  if (words.length > 2) {
    return words[words.length - 1];
  }

  return 'לא צוין';
}
