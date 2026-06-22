// ── Lead/CRM unified text search ──────────────────────────────
// Pure, framework-free helpers so the same matching logic can be
// unit-tested and reused by the Leads/Customers list filtering.

/**
 * Normalize a phone number for comparison.
 *
 * Strips every non-digit character (spaces, hyphens, parentheses, plus signs)
 * and collapses Israeli country-prefix formatting so the same subscriber number
 * compares equal regardless of how it was entered or stored.
 *
 *   "052-462-3774"   → "0524623774"
 *   "+972 52-462-3774" → "0524623774"
 *   "00972524623774" → "0524623774"
 *   "(052) 4623774"  → "0524623774"
 */
export const normalizePhone = (raw: string | null | undefined): string => {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00972')) {
    digits = '0' + digits.slice(5);
  } else if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  }
  return digits;
};

/**
 * Minimum number of normalized digits a query must have before we attempt a
 * phone match. Shorter numeric queries (1–2 digits) would match almost every
 * stored number, so for those we fall back to name/city matching only.
 */
export const MIN_PHONE_QUERY_DIGITS = 3;

export interface LeadSearchable {
  name: string | null | undefined;
  city: string | null | undefined;
  /** Names of the primary contact and any additional CRM contacts. */
  contactNames?: (string | null | undefined)[];
  /** Any phone numbers associated with the lead (primary contact + all contacts). */
  phones: (string | null | undefined)[];
}

/**
 * Returns true when `query` matches the lead on ANY of: institution name, city,
 * a contact person's name, or a phone number (OR).
 *
 * - Name / city / contact names: partial, case-insensitive, Hebrew-safe substring.
 * - Phone: both query and stored numbers are normalized (see {@link normalizePhone})
 *   before a partial match, so formatting and country-prefix differences are ignored.
 *   Partial matching means trailing-digit queries (e.g. "4623774") still match.
 *
 * Operates per institution, so a row matches once regardless of how many of its
 * contacts match. An empty / whitespace-only query matches everything.
 */
export const matchesLeadSearch = (lead: LeadSearchable, query: string): boolean => {
  const term = (query ?? '').trim();
  if (!term) return true;

  const lower = term.toLowerCase();

  const nameMatch = (lead.name ?? '').toLowerCase().includes(lower);
  if (nameMatch) return true;

  const cityMatch = (lead.city ?? '').toLowerCase().includes(lower);
  if (cityMatch) return true;

  // Contact person names (primary contact + any additional CRM contacts).
  const contactNameMatch = (lead.contactNames ?? []).some(
    (n) => (n ?? '').toLowerCase().includes(lower),
  );
  if (contactNameMatch) return true;

  // Only attempt phone matching when the query has enough digits to be
  // meaningful. A pure-text query or a 1–2 digit query would match far too
  // broadly, so we skip phone matching and rely on the text matches above.
  const queryPhone = normalizePhone(term);
  if (queryPhone.length >= MIN_PHONE_QUERY_DIGITS) {
    return lead.phones.some((p) => {
      const stored = normalizePhone(p);
      return stored !== '' && stored.includes(queryPhone);
    });
  }

  return false;
};
