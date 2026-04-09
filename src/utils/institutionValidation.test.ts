import { describe, it, expect } from 'vitest';
import { validateInstitution, filterValidContacts, type Contact } from './institutionValidation';

const contact = (name: string): Contact => ({ name, phone: '', email: '', role: '' });

describe('validateInstitution', () => {
  it('empty name fails validation', () => {
    const r = validateInstitution('', 'תל אביב', [contact('ישראל')]);
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('empty city fails validation', () => {
    const r = validateInstitution('בית ספר', '', [contact('ישראל')]);
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('whitespace-only name fails validation', () => {
    const r = validateInstitution('   ', 'תל אביב', [contact('ישראל')]);
    expect(r.valid).toBe(false);
  });

  it('valid name + city + one contact passes', () => {
    const r = validateInstitution('בית ספר', 'תל אביב', [contact('ישראל')]);
    expect(r.valid).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('all contacts with empty names fails — needs at least one valid contact', () => {
    const r = validateInstitution('בית ספר', 'תל אביב', [contact(''), contact('')]);
    expect(r.valid).toBe(false);
  });
});

describe('filterValidContacts', () => {
  it('filters out contacts with empty name', () => {
    const result = filterValidContacts([contact('ישראל'), contact(''), contact('שרה')]);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.name)).toEqual(['ישראל', 'שרה']);
  });

  it('filters out contacts with whitespace-only name', () => {
    const result = filterValidContacts([contact('   '), contact('ישראל')]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ישראל');
  });

  it('returns all contacts when all have valid names', () => {
    const result = filterValidContacts([contact('א'), contact('ב')]);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when all contacts have empty names', () => {
    expect(filterValidContacts([contact(''), contact('')])).toHaveLength(0);
  });
});
