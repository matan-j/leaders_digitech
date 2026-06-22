import { describe, it, expect } from 'vitest';
import { normalizePhone, matchesLeadSearch, type LeadSearchable } from './leadSearch';

// A small fixture set resembling rows on the Leads page.
const rabin: LeadSearchable = {
  name: 'רבין אזור',
  city: 'אזור',
  contactNames: ['מאור כהן', 'דנה לוי'],
  phones: ['052-462-3774'],
};
const herzl: LeadSearchable = {
  name: 'הרצל תל אביב',
  city: 'תל אביב',
  contactNames: ['ישראל ויני'],
  phones: ['+972 54 123 4567', null],
};
const weizmann: LeadSearchable = {
  name: 'ויצמן רחובות',
  city: 'רחובות',
  contactNames: [],
  phones: [],
};

const leads = [rabin, herzl, weizmann];
const search = (q: string) => leads.filter((l) => matchesLeadSearch(l, q));

describe('normalizePhone', () => {
  it('strips spaces, hyphens and parentheses', () => {
    expect(normalizePhone('(052) 462-3774')).toBe('0524623774');
    expect(normalizePhone('052 462 3774')).toBe('0524623774');
  });

  it('collapses +972 / 00972 country prefix to a leading 0', () => {
    expect(normalizePhone('+972524623774')).toBe('0524623774');
    expect(normalizePhone('00972524623774')).toBe('0524623774');
    expect(normalizePhone('972-52-462-3774')).toBe('0524623774');
  });

  it('handles null/undefined/empty', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});

describe('matchesLeadSearch', () => {
  it('1. matches a partial Hebrew name (case/partial-insensitive)', () => {
    expect(search('רבין')).toEqual([rabin]);
    expect(search('רצל')).toEqual([herzl]); // partial, not anchored at start
  });

  it('2. matches by city', () => {
    expect(search('רחובות')).toEqual([weizmann]);
    expect(search('תל אביב')).toEqual([herzl]);
  });

  it('matches by contact person name (primary or additional), partial Hebrew', () => {
    expect(search('מאור')).toEqual([rabin]);     // primary contact, partial
    expect(search('דנה')).toEqual([rabin]);       // additional contact
    expect(search('ויני')).toEqual([herzl]);      // partial, mid-word
  });

  it('returns the institution once even when multiple of its contacts match', () => {
    // "כהן" + "לוי" share rabin; the query "מאור" only hits one contact but a
    // broad term across two contacts must still yield a single row.
    const broad: LeadSearchable = {
      name: 'מוסד', city: 'חיפה',
      contactNames: ['אבי כהן', 'בני כהן', 'גדי כהן'],
      phones: [],
    };
    expect(matchesLeadSearch(broad, 'כהן')).toBe(true); // single boolean → one row
  });

  it('missing/empty contactNames is safe (backward compatible)', () => {
    expect(matchesLeadSearch({ name: 'בית ספר', city: 'עכו', phones: [] }, 'עכו')).toBe(true);
    expect(matchesLeadSearch({ name: 'בית ספר', city: 'עכו', phones: [] }, 'נדב')).toBe(false);
  });

  it('3. matches a phone entered with hyphens/spaces regardless of stored formatting', () => {
    expect(search('0524623774')).toEqual([rabin]);
    expect(search('052-462-3774')).toEqual([rabin]);
    expect(search('052 462 3774')).toEqual([rabin]);
  });

  it('4. matches a phone entered with +972 formatting', () => {
    expect(search('+972524623774')).toEqual([rabin]);
    expect(search('+972 54 123 4567')).toEqual([herzl]);
  });

  it('matches partial trailing phone digits', () => {
    expect(search('4623774')).toEqual([rabin]);
  });

  it('matches any of several contact phones (OR across phones)', () => {
    const multi: LeadSearchable = {
      name: 'מוסד רב אנשי קשר',
      city: 'חיפה',
      phones: ['03-1112222', '050-9998888'],
    };
    expect(matchesLeadSearch(multi, '0509998888')).toBe(true);
    expect(matchesLeadSearch(multi, '031112222')).toBe(true);
  });

  it('an empty / whitespace query matches everything (no filtering)', () => {
    expect(search('')).toEqual(leads);
    expect(search('   ')).toEqual(leads);
  });

  it('does not phone-match a pure-text query against every row', () => {
    // "אזור" should match rabin by name/city only — never via empty phone normalization.
    expect(search('אזור')).toEqual([rabin]);
  });

  it('does not phone-match a 1–2 digit query (overly-broad guardrail)', () => {
    // "05" normalizes to 2 digits → below threshold → no phone match,
    // and it matches no name/city, so the result is empty rather than "everything".
    expect(search('05')).toEqual([]);
    expect(search('5')).toEqual([]);
    // 3 digits is allowed again
    expect(search('377')).toEqual([rabin]);
  });

  it('is safe when phone values are null / undefined / empty / malformed', () => {
    const messy: LeadSearchable = {
      name: 'מוסד עם טלפונים בעייתיים',
      city: 'נתניה',
      phones: [null, undefined, '', '   ', 'abc', '052-462-3774'],
    };
    expect(() => matchesLeadSearch(messy, '0524623774')).not.toThrow();
    expect(matchesLeadSearch(messy, '0524623774')).toBe(true);
    // a query that matches none of the (valid) phones
    expect(matchesLeadSearch(messy, '0500000000')).toBe(false);
    // text still works despite messy phones
    expect(matchesLeadSearch(messy, 'נתניה')).toBe(true);
  });
});

describe('combined search + dropdown filter (mirrors list filtering)', () => {
  // The list applies dropdown predicates AND matchesLeadSearch together (logical AND).
  type Row = LeadSearchable & { status: string };
  const rows: Row[] = [
    { name: 'רבין אזור', city: 'אזור', phones: ['052-462-3774'], status: 'hot' },
    { name: 'רבין חדרה', city: 'חדרה', phones: ['052-462-3774'], status: 'cold' },
  ];

  it('5. status filter + phone search returns only rows matching both', () => {
    const result = rows.filter(
      (r) => r.status === 'hot' && matchesLeadSearch(r, '052-462-3774'),
    );
    expect(result).toHaveLength(1);
    expect(result[0].city).toBe('אזור');
  });

  it('6. resetting the search restores the full filtered (status) list', () => {
    const statusFiltered = rows.filter((r) => r.status === 'cold');
    const withSearch = statusFiltered.filter((r) => matchesLeadSearch(r, 'אזור'));
    expect(withSearch).toHaveLength(0); // search hides the cold row
    const afterReset = statusFiltered.filter((r) => matchesLeadSearch(r, ''));
    expect(afterReset).toEqual(statusFiltered); // empty query → full status list back
  });
});
