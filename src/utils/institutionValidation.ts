export interface Contact {
  name: string;
  phone: string;
  email: string;
  role: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function filterValidContacts(contacts: Contact[]): Contact[] {
  return contacts.filter(c => c.name.trim());
}

export function validateInstitution(
  name: string,
  city: string,
  contacts: Contact[]
): ValidationResult {
  if (!name.trim() || !city.trim()) {
    return { valid: false, error: 'נדרש למלא שם מוסד ועיר' };
  }
  if (filterValidContacts(contacts).length === 0) {
    return { valid: false, error: 'נדרש לפחות איש קשר אחד עם שם' };
  }
  return { valid: true };
}
