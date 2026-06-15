import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { splitList } from '@/lib/instructors/validation';

// Modular inline-edit cell for table rows. One component drives every editable
// column in the Instructors CRM table. Field type decides the editor:
//   text   → free-text input
//   number → numeric input (empty → null)
//   select → dropdown from a fixed option list (e.g. region)
//   tags   → free-text, split on ; or , into a string[]
//
// The cell owns its own edit/save lifecycle, stops click propagation so the
// row's navigate() never fires while editing, and rolls the view back to
// display mode if onSave throws (the parent restores the value).

export type InlineFieldType = 'text' | 'number' | 'select' | 'tags';

export interface InlineSelectOption {
  value: string;
  label: string;
}

type InlineValue = string | number | string[] | null;

interface Props {
  type: InlineFieldType;
  value: InlineValue;
  /** Options for type='select'. First entry may be the "— ללא —" clear option. */
  options?: InlineSelectOption[];
  placeholder?: string;
  /** Custom read-only renderer (region badge, chips, stars…). Falls back to plain text. */
  renderDisplay?: (value: InlineValue) => ReactNode;
  /** Persist the parsed value. Throw to signal failure → cell returns to display mode. */
  onSave: (value: InlineValue) => Promise<void> | void;
}

const toEditString = (type: InlineFieldType, value: InlineValue): string => {
  if (value === null || value === undefined) return '';
  if (type === 'tags' && Array.isArray(value)) return value.join('; ');
  return String(value);
};

const parseValue = (type: InlineFieldType, raw: string): InlineValue => {
  const trimmed = raw.trim();
  if (type === 'tags') return splitList(trimmed);
  if (type === 'number') return trimmed === '' ? null : Number(trimmed);
  return trimmed === '' ? null : trimmed;
};

const sameValue = (a: InlineValue, b: InlineValue): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = (a as string[]) ?? [];
    const bb = (b as string[]) ?? [];
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  }
  return (a ?? null) === (b ?? null);
};

const InlineEditCell = ({ type, value, options, placeholder, renderDisplay, onSave }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(toEditString(type, value));
    setEditing(true);
  };

  const commit = async (rawOverride?: string) => {
    const raw = rawOverride ?? draft;
    const next = parseValue(type, raw);
    if (sameValue(next, value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // Parent already toasted + rolled back the row value.
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => setEditing(false);

  // ── Display mode ──────────────────────────────────────────────
  if (!editing) {
    const content = renderDisplay
      ? renderDisplay(value)
      : value === null || value === undefined || value === ''
        ? <span className="text-gray-400">—</span>
        : <span className="text-gray-700">{String(value)}</span>;
    return (
      <button
        type="button"
        className="group/cell w-full flex items-center gap-1 text-right rounded px-1 -mx-1 py-0.5 hover:bg-blue-100/60 transition cursor-text"
        onClick={(e) => { e.stopPropagation(); startEdit(); }}
        title="לחץ לעריכה"
      >
        <span className="min-w-0">{content}</span>
        <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover/cell:opacity-100 shrink-0 ms-auto" />
      </button>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  if (type === 'select') {
    return (
      <div onClick={stop} className="flex items-center gap-1">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          disabled={saving}
          value={(value as string) ?? ''}
          onChange={(e) => commit(e.target.value)}
          onBlur={cancel}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
          className="h-7 px-1 border border-blue-400 rounded text-xs bg-white w-full"
        >
          {(options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {saving && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
      </div>
    );
  }

  return (
    <div onClick={stop} className="flex items-center gap-1">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'number' ? 'number' : 'text'}
        disabled={saving}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        className="h-7 px-1.5 border border-blue-400 rounded text-xs bg-white w-full min-w-[6rem]"
      />
      {saving && <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />}
    </div>
  );
};

export default InlineEditCell;
