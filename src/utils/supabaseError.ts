// Turns a Supabase / Postgres error into a clear, actionable Hebrew message.
//
// Supabase rejects with a PostgrestError — a plain object ({ message, details,
// hint, code }), NOT an `Error` instance. Code that checks `err instanceof
// Error` therefore misses the real reason and falls back to "unknown error".
// Use this helper in catch blocks instead.

interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/**
 * Map a thrown Supabase/Postgres error to a human Hebrew message.
 * Falls back to the raw message so nothing is ever swallowed.
 */
export function supabaseErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;

  const e = (isObject(err) ? err : {}) as PostgrestLikeError;
  const code = e.code;
  const raw = [e.message, e.details].filter(Boolean).join(' — ');

  // unique_violation
  if (code === '23505') {
    const blob = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
    if (blob.includes('phone')) return 'מספר טלפון זה כבר קיים אצל מדריך אחר.';
    if (blob.includes('email')) return 'כתובת אימייל זו כבר קיימת אצל מדריך אחר.';
    return 'הערך כבר קיים במערכת (כפילות).';
  }

  // check_violation
  if (code === '23514') {
    const blob = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
    if (blob.includes('contact_present')) return 'חובה למלא טלפון או אימייל.';
    if (blob.includes('rating_range')) return 'ציון חייב להיות בין 1 ל-5.';
    return 'אחד הערכים אינו עומד בכללי המערכת.';
  }

  // not_null_violation
  if (code === '23502') return 'חסר ערך בשדה חובה.';

  // foreign_key_violation
  if (code === '23503') return 'הפניה לא תקינה (רשומה מקושרת חסרה).';

  // RLS / permission
  if (code === '42501' || code === 'PGRST301') {
    return 'אין לך הרשאה לבצע פעולה זו.';
  }

  if (raw) return raw;
  if (err instanceof Error) return err.message;
  return 'שגיאה לא ידועה';
}
