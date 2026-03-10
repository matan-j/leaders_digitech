/**
 * Utility functions for handling school type display and translation
 */

export type SchoolType = 'elementary' | 'middle' | 'high' | string;

/**
 * Translates school type to Hebrew
 * @param schoolType - The school type in English
 * @returns Hebrew translation of the school type
 */
export const getSchoolTypeDisplayName = (schoolType: SchoolType | null | undefined): string => {
  if (!schoolType) return 'לא צוין';
  
  switch (schoolType) {
    case 'elementary':
      return 'יסודי';
    case 'middle':
      return 'חטיבה';
    case 'high':
      return 'תיכון';
    default:
      return 'לא צוין';
  }
};

/**
 * Gets the color scheme for a school type
 * @param schoolType - The school type
 * @returns Object with background and text color classes
 */
export const getSchoolTypeColors = (schoolType: SchoolType | null | undefined) => {
  switch (schoolType) {
    case 'elementary':
      return {
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-200'
      };
    case 'middle':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200'
      };
    case 'high':
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-200'
      };
    default:
      return {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200'
      };
  }
};