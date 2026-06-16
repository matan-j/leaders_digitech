import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  CRM_CUSTOMER_CLASS,
  CRM_LEAD_CLASS,
  CRM_SOFT_DELETE_FILTER,
  applyCustomerClass as applyCustomerOnly,
  applyLeadClass as applyLeadOnly,
  applyNotDeleted,
  countInstitutionIdsWithDestination,
  countSendableInstitutions,
  fetchInstitutionIds,
  hasRequiredDestination,
  pickBestContactForChannel,
} from '@/lib/crmQueryHelpers';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'whatsapp' | 'email';

interface AudienceList {
  id: string;
  name: string;
  desc: string;
  count: number | null;
  filter: Record<string, unknown>;
}

interface TemplateAttachment {
  name: string;
  url: string;
  mime_type?: string | null;
  size?: number | null;
  kind?: 'image' | 'video' | 'audio' | 'document' | null;
  storage_path?: string | null;
}

interface Template {
  id: string;
  name: string;
  stage: string | null;
  channel: Channel;
  body: string;
  attachments?: TemplateAttachment[] | null;
}

interface CRMList {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
}

interface ContactStatus {
  id: string;
  label: string;
  color: string;
  order_index: number;
  legacy_crm_risk: string | null;
}

interface SendResult {
  success?: boolean;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  error?: string;
}

interface RecipientPreview {
  institution_id: string;
  institution_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  available: boolean;
}

interface ListMemberRow {
  institution_id: string;
  institution_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
}

interface InstResult {
  id: string;
  name: string;
  city: string | null;
}

interface RecipientStats {
  total: number;
  available: number;
  unavailable: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#F7F8FC', surface: '#FFFFFF', border: '#E5E7EB', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#6D28D9', accentBg: '#F3E8FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  teal: '#0891B2', tealBg: '#CFFAFE',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  gray: '#6B7280', grayBg: '#F3F4F6',
  ai: '#0EA5E9', aiBg: '#E0F2FE',
};

const FILTERED_AUDIENCE_ID = 'filtered';
const chunkIds = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function fetchInstitutionIdsWithDestination(
  institutionIds: string[],
  channel: Channel,
): Promise<string[]> {
  if (institutionIds.length === 0) return [];

  const destinationColumn = channel === 'whatsapp' ? 'phone' : 'email';
  const matched = new Set<string>();

  for (const ids of chunkIds(institutionIds, 500)) {
    const { data, error } = await supabase
      .from('crm_contacts')
      .select(`institution_id, ${destinationColumn}`)
      .in('institution_id', ids)
      .not(destinationColumn, 'is', null);

    if (error) throw error;

    for (const contact of data ?? []) {
      const destination = contact[destinationColumn];
      if (typeof destination === 'string' && destination.trim()) {
        matched.add(contact.institution_id);
      }
    }
  }

  return institutionIds.filter(id => matched.has(id));
}

async function fetchSendableRecipientRows(
  institutionIds: string[],
  channel: Channel,
): Promise<RecipientPreview[]> {
  const sendableIds = await fetchInstitutionIdsWithDestination(institutionIds, channel);
  if (sendableIds.length === 0) return [];

  const institutions: { id: string; name: string }[] = [];
  const contacts: { institution_id: string; name: string; phone: string | null; email: string | null; is_primary: boolean | null }[] = [];

  for (const ids of chunkIds(sendableIds, 500)) {
    const [{ data: institutionRows, error: instError }, { data: contactRows, error: contactError }] = await Promise.all([
      applyNotDeleted(supabase.from('educational_institutions').select('id, name').in('id', ids)),
      supabase.from('crm_contacts').select('institution_id, name, phone, email, is_primary').in('institution_id', ids),
    ]);

    if (instError) throw instError;
    if (contactError) throw contactError;

    institutions.push(...(institutionRows ?? []));
    contacts.push(...((contactRows ?? []) as typeof contacts));
  }

  const institutionMap = new Map(institutions.map(inst => [inst.id, inst.name]));
  const contactsByInstitution = new Map<string, { name: string; phone: string | null; email: string | null; is_primary: boolean | null }[]>();
  for (const contact of contacts) {
    const rows = contactsByInstitution.get(contact.institution_id) ?? [];
    rows.push(contact);
    contactsByInstitution.set(contact.institution_id, rows);
  }

  return sendableIds.map(instId => {
    const contact = pickBestContactForChannel(contactsByInstitution.get(instId) ?? [], channel);
    const row = {
      institution_id: instId,
      institution_name: institutionMap.get(instId) ?? '—',
      contact_name: contact?.name ?? null,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
    };
    return { ...row, available: hasRequiredDestination(row, channel) };
  }).filter(row => row.available);
}

// ─── Stage badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage, color = C.gray }: { stage: string | null; color?: string }) {
  if (!stage) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  );
}

// ─── Steps indicator ──────────────────────────────────────────────────────────

function Steps({ step, onGoTo }: { step: number; onGoTo: (i: number) => void }) {
  const labels = ['בחר קהל', 'בחר הודעה', 'שלח'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {labels.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: i <= step ? 'pointer' : 'default' }}
            onClick={() => { if (i <= step) onGoTo(i); }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i < step ? C.success : i === step ? C.accent : C.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i === step ? C.text : C.textSub }}>{s}</span>
          </div>
          {i < 2 && <div style={{ width: 30, height: 1, background: i < step ? C.success : C.border, margin: '0 8px' }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Expandable member table ──────────────────────────────────────────────────
// sourceKind='list'    → fetches from crm_list_members by listId
// sourceKind='dynamic' → fetches educational_institutions directly by audienceId

function ExpandableMemberTable({
  sourceKind,
  channel,
  listId = '',
  audienceId = '',
  monthStart = '',
  sevenDaysAgo = '',
  noReplyStageName = null,
  defaultExpanded = false,
}: {
  sourceKind: 'list' | 'dynamic';
  channel: Channel;
  listId?: string;
  audienceId?: string;
  monthStart?: string;
  sevenDaysAgo?: string;
  noReplyStageName?: string | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [members, setMembers] = useState<ListMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setMembers([]);
    setHasMore(false);
    setLoaded(false);
  }, [sourceKind, channel, listId, audienceId, monthStart, sevenDaysAgo, noReplyStageName]);

  useEffect(() => {
    if (!expanded || loaded) return;
    setLoading(true);
    (async () => {
      try {
        let audienceIds: string[] = [];

        if (sourceKind === 'list') {
          const { data: memberRows } = await supabase
            .from('crm_list_members')
            .select('institution_id')
            .eq('list_id', listId);
          if (!memberRows || memberRows.length === 0) {
            setMembers([]); setLoaded(true); setLoading(false); return;
          }
          const listIds = [...new Set(memberRows.map(m => m.institution_id))];
          audienceIds = await fetchInstitutionIds(() =>
            applyNotDeleted(supabase.from('educational_institutions').select('id')).in('id', listIds),
          );
        } else {
          audienceIds = await fetchInstitutionIds(() =>
            applyDynamicAudienceFilter(
              applyNotDeleted(supabase.from('educational_institutions').select('id')),
              audienceId,
              monthStart,
              sevenDaysAgo,
              noReplyStageName,
            ),
          );
          if (audienceIds.length === 0) {
            setMembers([]); setLoaded(true); setLoading(false); return;
          }
        }

        const sendableRows = await fetchSendableRecipientRows(audienceIds, channel);
        setHasMore(false);
        setMembers(sendableRows);
        setLoaded(true);
      } catch (err) {
        console.error('[ExpandableMemberTable] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded, loaded, sourceKind, channel, listId, audienceId, monthStart, sevenDaysAgo, noReplyStageName]);

  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', padding: '3px 0' }}
      >
        <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>הצג אנשי קשר</span>
        <span style={{ fontSize: 9, color: C.accent, display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
      </div>

      {expanded && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden', marginTop: 4 }}>
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: C.textDim }}>טוען...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: C.textDim }}>אין מוסדות</div>
          ) : (
            <>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['מוסד', 'איש קשר ראשי', 'טלפון', 'מייל'].map(h => (
                      <th key={h} style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600, color: C.textSub, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, i) => (
                    <tr key={m.institution_id} style={{ background: i % 2 === 0 ? C.surface : C.bg, borderBottom: i < members.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                      <td style={{ padding: '5px 10px', fontWeight: 500 }}>{m.institution_name}</td>
                      <td style={{ padding: '5px 10px', color: m.contact_name ? C.text : C.textDim }}>{m.contact_name ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: C.textSub }}>{m.phone ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: C.textSub }}>{m.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div style={{ padding: '5px 10px', fontSize: 10, color: C.textDim, textAlign: 'center', background: C.bg, borderTop: `1px solid ${C.borderLight}` }}>
                  ועוד נמענים נוספים...
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Institution search box ───────────────────────────────────────────────────

function InstSearchBox({
  selected,
  onSelect,
  onRemove,
}: {
  selected: InstResult[];
  onSelect: (inst: InstResult) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InstResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIds = selected.map(s => s.id);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResults([]); setShowDropdown(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('educational_institutions')
      .select('id, name, city')
      .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
      .or(CRM_SOFT_DELETE_FILTER)
      .limit(12);
    setResults((data ?? []).filter(r => !selectedIds.includes(r.id)) as InstResult[]);
    setShowDropdown(true);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, minHeight: 36, alignItems: 'center' }}>
          {selected.map(inst => (
            <span key={inst.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: C.accentBg, color: C.accent, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              {inst.name}
              <span onClick={() => onRemove(inst.id)} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>×</span>
            </span>
          ))}
          <input
            value={query}
            onChange={handleChange}
            onFocus={() => { if (query.trim()) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={selected.length === 0 ? 'חפש מוסד לפי שם או עיר...' : 'הוסף עוד...'}
            style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1, minWidth: 120, background: 'transparent', color: C.text }}
          />
        </div>
        {showDropdown && (
          <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: C.textDim }}>מחפש...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: C.textDim }}>לא נמצאו תוצאות</div>
            ) : results.map(r => (
              <div
                key={r.id}
                onMouseDown={() => { onSelect(r); setQuery(''); setResults([]); setShowDropdown(false); }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
              >
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                {r.city && <span style={{ color: C.textSub, fontSize: 11 }}>{r.city}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{selected.length} מוסדות נבחרו</div>
      )}
    </div>
  );
}

// ─── Edit group modal ─────────────────────────────────────────────────────────
// Rename a manual list (WhatsApp group) and add/remove its institutions.
// Reuses InstSearchBox: selected={members} gives search, chips, add, remove,
// and duplicate-prevention for free. Writes go through the same RLS-backed
// client calls already used by create/delete (crm_lists / crm_list_members).

function EditGroupModal({
  list,
  userId,
  onClose,
  onSaved,
}: {
  list: { id: string; name: string; description: string | null };
  userId: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(list.name);
  const [desc, setDesc] = useState(list.description ?? '');
  const [members, setMembers] = useState<InstResult[]>([]);
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load current members of the group
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: memberRows, error: memberErr } = await supabase
          .from('crm_list_members')
          .select('institution_id')
          .eq('list_id', list.id);
        if (memberErr) throw memberErr;

        const ids = [...new Set((memberRows ?? []).map(m => m.institution_id))];
        if (ids.length === 0) {
          if (active) { setMembers([]); setOriginalIds(new Set()); }
          return;
        }
        // Fetch by id without the soft-delete filter so the true membership is
        // always shown — even a removed institution can then be cleaned out.
        const { data: insts, error: instErr } = await supabase
          .from('educational_institutions')
          .select('id, name, city')
          .in('id', ids);
        if (instErr) throw instErr;
        if (!active) return;
        setMembers((insts ?? []) as InstResult[]);
        setOriginalIds(new Set(ids));
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'שגיאה בטעינת מוסדות הקבוצה');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [list.id]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving && !loading && !loadError;

  const handleSave = async () => {
    if (!trimmedName) { setSaveError('שם הקבוצה הוא שדה חובה'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      // 1. Rename + description
      const { error: updErr } = await supabase
        .from('crm_lists')
        .update({ name: trimmedName, description: desc.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', list.id);
      if (updErr) throw updErr;

      const currentIds = members.map(m => m.id);
      const addedMembers = members.filter(m => !originalIds.has(m.id));
      const removedIds = [...originalIds].filter(id => !currentIds.includes(id));

      // 2. Add new institutions (ignoreDuplicates → safe against the UNIQUE constraint)
      if (addedMembers.length > 0) {
        const { error: addErr } = await supabase.from('crm_list_members').upsert(
          addedMembers.map(m => ({ list_id: list.id, institution_id: m.id, added_by: userId })),
          { onConflict: 'list_id,institution_id', ignoreDuplicates: true },
        );
        if (addErr) throw addErr;
      }

      // 3. Remove institutions the user dropped
      if (removedIds.length > 0) {
        const { error: delErr } = await supabase
          .from('crm_list_members')
          .delete()
          .eq('list_id', list.id)
          .in('institution_id', removedIds);
        if (delErr) throw delErr;
      }

      onSaved('הקבוצה עודכנה בהצלחה');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'שגיאה בשמירת הקבוצה');
      setSaving(false);
    }
  };

  return (
    <div
      onClick={() => { if (!saving) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', padding: '20px 22px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>עריכת קבוצה</div>
          <button onClick={() => { if (!saving) onClose(); }} style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: C.textSub }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>שם הקבוצה *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="שם הקבוצה"
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${trimmedName ? C.border : C.danger}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            {!trimmedName && <div style={{ fontSize: 11, color: C.danger, marginTop: 3 }}>שם הקבוצה הוא שדה חובה</div>}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>תיאור (אופציונלי)</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="תיאור קצר..."
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>מוסדות בקבוצה</label>
            {loading ? (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 6 }}>טוען מוסדות...</div>
            ) : loadError ? (
              <div style={{ padding: '10px 12px', borderRadius: 6, background: C.dangerBg, color: C.danger, fontSize: 12, fontWeight: 600 }}>{loadError}</div>
            ) : (
              <>
                <InstSearchBox
                  selected={members}
                  onSelect={inst => setMembers(prev => (prev.some(m => m.id === inst.id) ? prev : [...prev, inst]))}
                  onRemove={id => setMembers(prev => prev.filter(m => m.id !== id))}
                />
                {members.length === 0 && (
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>אין מוסדות בקבוצה. חפש והוסף מוסדות.</div>
                )}
              </>
            )}
          </div>

          {saveError && (
            <div style={{ padding: '9px 12px', borderRadius: 6, background: C.dangerBg, color: C.danger, fontSize: 12, fontWeight: 600 }}>{saveError}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: canSave ? C.accent : C.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function applyDynamicAudienceFilter(query: any, audienceId: string | undefined, monthStart: string, sevenDaysAgo: string, noReplyStageName: string | null) {
  if (audienceId === 'new_leads')
    return applyLeadOnly(query).gte('created_at', monthStart);
  if (audienceId === 'no_reply')
    return noReplyStageName
      ? applyLeadOnly(query).eq('crm_stage', noReplyStageName).or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${sevenDaysAgo}`)
      : applyLeadOnly(query).limit(0);
  if (audienceId === 'renewal')
    return applyCustomerOnly(query);
  if (audienceId === 'all_active')
    return applyLeadOnly(query);
  return query;
}

function applyRecipientSelectionFilters(
  query: any,
  selectedStageNames: string[],
  selectedStatusIds: string[],
  contactStatuses: ContactStatus[],
) {
  query = applyLeadOnly(query);

  if (selectedStageNames.length > 0) {
    query = query.in('crm_stage', selectedStageNames);
  }

  if (selectedStatusIds.length > 0) {
    const selectedStatuses = contactStatuses.filter((status) => selectedStatusIds.includes(status.id));
    const legacyRisks = selectedStatuses
      .map((status) => status.legacy_crm_risk)
      .filter((risk): risk is string => Boolean(risk));

    if (legacyRisks.length > 0) {
      query = query.or(
        `crm_contact_status_id.in.(${selectedStatusIds.join(',')}),and(crm_contact_status_id.is.null,crm_risk.in.(${legacyRisks.join(',')}))`,
      );
    } else {
      query = query.in('crm_contact_status_id', selectedStatusIds);
    }
  }

  return query;
}

export default function CRMBroadcast() {
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [selList, setSelList] = useState<AudienceList | null>(null);
  const [selTpl, setSelTpl] = useState<Template | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audiences, setAudiences] = useState<AudienceList[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [manualListId, setManualListId] = useState<string | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview[]>([]);
  const [recipientStats, setRecipientStats] = useState<RecipientStats>({ total: 0, available: 0, unavailable: 0 });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [contactStatuses, setContactStatuses] = useState<ContactStatus[]>([]);
  const [selectedStageNames, setSelectedStageNames] = useState<string[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [loadingFilteredCount, setLoadingFilteredCount] = useState(false);
  const [loadingRecipientFilters, setLoadingRecipientFilters] = useState(true);
  const [filterLoadError, setFilterLoadError] = useState<string | null>(null);

  // Manual lists state
  const [manualLists, setManualLists] = useState<CRMList[]>([]);
  const [loadingManualLists, setLoadingManualLists] = useState(true);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [createSelected, setCreateSelected] = useState<InstResult[]>([]);
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit existing group (rename + add/remove members)
  const [editGroup, setEditGroup] = useState<CRMList | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Stable date strings for dynamic audience queries (computed once per mount)
  const [dateStrings] = useState(() => {
    const now = new Date();
    return {
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  useEffect(() => {
    async function loadRecipientFilters() {
      setLoadingRecipientFilters(true);
      setFilterLoadError(null);

      let stagesResult = await supabase
        .from('crm_pipeline_stages')
        .select('id, name, color, order_index')
        .eq('is_active', true)
        .order('order_index');

      if (stagesResult.error) {
        stagesResult = await supabase
          .from('crm_pipeline_stages')
          .select('id, name, color, order_index')
          .order('order_index');
      }

      const [statusesResult] = await Promise.all([
        supabase
          .from('crm_contact_statuses')
          .select('id, label, color, order_index, legacy_crm_risk')
          .eq('is_active', true)
          .order('order_index'),
      ]);

      if (!stagesResult.error && stagesResult.data) {
        setPipelineStages((stagesResult.data as PipelineStage[]).filter((stage) => Boolean(stage.name?.trim())));
      }
      if (!statusesResult.error && statusesResult.data) {
        setContactStatuses(statusesResult.data as ContactStatus[]);
      }
      if (stagesResult.error || statusesResult.error) {
        setFilterLoadError(stagesResult.error?.message ?? statusesResult.error?.message ?? 'שגיאה בטעינת הסינונים');
      }
      setLoadingRecipientFilters(false);
    }

    loadRecipientFilters();
  }, []);

  const noReplyStageName = pipelineStages[1]?.name ?? pipelineStages[0]?.name ?? null;

  // Build dynamic audience counts
  useEffect(() => {
    async function buildAudiences() {
      setLoadingCounts(true);
      const createBaseQuery = () => applyNotDeleted(supabase.from('educational_institutions').select('id'));
      const [newLeads, noReply, renewal, allActive] = await Promise.all([
        countSendableInstitutions(supabase, () => applyLeadOnly(createBaseQuery()).gte('created_at', dateStrings.monthStart), channel),
        noReplyStageName
          ? countSendableInstitutions(
              supabase,
              () => applyLeadOnly(createBaseQuery())
                .eq('crm_stage', noReplyStageName)
                .or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${dateStrings.sevenDaysAgo}`),
              channel,
            )
          : Promise.resolve(0),
        countSendableInstitutions(supabase, () => applyCustomerOnly(createBaseQuery()), channel),
        countSendableInstitutions(supabase, () => applyLeadOnly(createBaseQuery()), channel),
      ]);
      setAudiences([
        { id: 'new_leads', name: 'לידים חדשים (החודש)', desc: 'הצטרפו החודש', count: newLeads, filter: { crm_class: CRM_LEAD_CLASS, since: dateStrings.monthStart } },
        { id: 'no_reply', name: `${noReplyStageName ?? 'שלב'} — ללא מענה 7 ימים`, desc: 'לא ענו בשבוע', count: noReply, filter: { crm_class: CRM_LEAD_CLASS, crm_stage: noReplyStageName, no_reply: true } },
        { id: 'renewal', name: 'לקוחות — פוטנציאל חידוש', desc: 'לקוחות פעילים', count: renewal, filter: { crm_class: CRM_CUSTOMER_CLASS } },
        { id: 'all_active', name: 'כל הלידים הפעילים', desc: 'לידים פתוחים במערכת', count: allActive, filter: { crm_class: CRM_LEAD_CLASS } },
      ]);
      setLoadingCounts(false);
    }
    buildAudiences();
  }, [channel, dateStrings, noReplyStageName]);

  const hasRecipientFilters = selectedStageNames.length > 0 || selectedStatusIds.length > 0;

  const filteredAudience: AudienceList = {
    id: FILTERED_AUDIENCE_ID,
    name: 'סינון לפי CRM',
    desc: 'שלב בפייפליין / סטטוס קשר',
    count: filteredCount,
    filter: {
      crm_class: CRM_LEAD_CLASS,
      stage_names: selectedStageNames,
      contact_status_ids: selectedStatusIds,
      legacy_crm_risks: contactStatuses
        .filter(status => selectedStatusIds.includes(status.id))
        .map(status => status.legacy_crm_risk)
        .filter(Boolean),
    },
  };

  useEffect(() => {
    if (!hasRecipientFilters) {
      setFilteredCount(null);
      if (selList?.id === FILTERED_AUDIENCE_ID) setSelList(null);
      return;
    }

    setLoadingFilteredCount(true);
    async function loadFilteredCount() {
      const count = await countSendableInstitutions(
        supabase,
        () => applyRecipientSelectionFilters(
          applyNotDeleted(supabase.from('educational_institutions').select('id')),
          selectedStageNames,
          selectedStatusIds,
          contactStatuses,
        ),
        channel,
      );
      setFilteredCount(count);
      setLoadingFilteredCount(false);
    }

    loadFilteredCount();
  }, [channel, contactStatuses, hasRecipientFilters, selectedStageNames, selectedStatusIds, selList?.id]);

  // Load templates filtered by channel
  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('crm_message_templates')
        .select('id, name, stage, channel, body, attachments')
        .eq('channel', channel);
      setTemplates((data ?? []) as Template[]);
    }
    loadTemplates();
  }, [channel]);

  // Load manual lists on mount
  const loadManualLists = useCallback(async () => {
    setLoadingManualLists(true);
    const { data: lists } = await supabase
      .from('crm_lists')
      .select('id, name, description')
      .order('name');
    if (!lists) { setManualLists([]); setLoadingManualLists(false); return; }
    const { data: members } = await supabase.from('crm_list_members').select('list_id, institution_id');
    const idsByList = new Map<string, string[]>();
    for (const member of members ?? []) {
      const ids = idsByList.get(member.list_id) ?? [];
      ids.push(member.institution_id);
      idsByList.set(member.list_id, ids);
    }
    const countMap = new Map<string, number>();
    for (const list of lists) {
      const ids = [...new Set(idsByList.get(list.id) ?? [])];
      if (ids.length === 0) {
        countMap.set(list.id, 0);
        continue;
      }
      const activeIds = await fetchInstitutionIds(() =>
        applyNotDeleted(supabase.from('educational_institutions').select('id')).in('id', ids),
      );
      countMap.set(list.id, await countInstitutionIdsWithDestination(supabase, activeIds, channel));
    }
    setManualLists(lists.map(l => ({ ...l, member_count: countMap.get(l.id) ?? 0 })));
    setLoadingManualLists(false);
  }, [channel]);

  useEffect(() => { loadManualLists(); }, [loadManualLists]);

  // Manual list CRUD
  const handleCreateList = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data: created, error } = await supabase
      .from('crm_lists')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, type: 'manual', created_by: user?.id ?? null })
      .select('id')
      .single();
    if (error || !created) { setCreating(false); return; }
    if (createSelected.length > 0) {
      await supabase.from('crm_list_members').insert(
        createSelected.map(inst => ({ list_id: created.id, institution_id: inst.id, added_by: user?.id ?? null }))
      );
    }
    setCreating(false);
    setShowCreate(false);
    setNewName(''); setNewDesc(''); setCreateSelected([]);
    setToast('הרשימה נוצרה בהצלחה');
    loadManualLists();
  };

  const handleDeleteList = async (listId: string) => {
    setDeleting(true);
    await supabase.from('crm_lists').delete().eq('id', listId);
    if (manualListId === listId) { setManualListId(null); setSelList(null); }
    setDeleteId(null);
    setDeleting(false);
    setToast('הרשימה נמחקה');
    loadManualLists();
  };

  // Fetch recipient preview whenever step 2 is entered
  useEffect(() => {
    if (step !== 2 || sent) return;
    setLoadingPreview(true);
    setRecipientPreview([]);
    setRecipientStats({ total: 0, available: 0, unavailable: 0 });

    async function run() {
      try {
        let audienceIds: string[] = [];

        if (selList?.id === 'manual') {
          if (!manualListId) { setLoadingPreview(false); return; }
          const { data: members } = await supabase
            .from('crm_list_members')
            .select('institution_id')
            .eq('list_id', manualListId);
          const ids = (members ?? []).map((m: { institution_id: string }) => m.institution_id);
          if (ids.length === 0) { setRecipientPreview([]); setLoadingPreview(false); return; }
          audienceIds = await fetchInstitutionIds(() =>
            applyNotDeleted(supabase.from('educational_institutions').select('id')).in('id', [...new Set(ids)]),
          );
        } else if (selList?.id === FILTERED_AUDIENCE_ID) {
          audienceIds = await fetchInstitutionIds(() =>
            applyRecipientSelectionFilters(
              applyNotDeleted(supabase.from('educational_institutions').select('id')),
              selectedStageNames,
              selectedStatusIds,
              contactStatuses,
            ),
          );
        } else {
          audienceIds = await fetchInstitutionIds(() =>
            applyDynamicAudienceFilter(
              applyNotDeleted(supabase.from('educational_institutions').select('id')),
              selList?.id,
              dateStrings.monthStart,
              dateStrings.sevenDaysAgo,
              noReplyStageName,
            ),
          );
        }

        if (audienceIds.length === 0) { setRecipientPreview([]); setLoadingPreview(false); return; }

        const sendablePreview = await fetchSendableRecipientRows(audienceIds, channel);
        setRecipientPreview(sendablePreview);
        setRecipientStats({
          total: audienceIds.length,
          available: sendablePreview.length,
          unavailable: audienceIds.length - sendablePreview.length,
        });
      } catch (err) {
        console.error('[CRMBroadcast] preview fetch error:', err);
      } finally {
        setLoadingPreview(false);
      }
    }
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, contactStatuses, dateStrings.monthStart, dateStrings.sevenDaysAgo, manualListId, selectedStageNames, selectedStatusIds, selList?.id, sent, step]);

  const doSend = async () => {
    if (!selList || !selTpl) return;
    if (selList.id === 'manual' && !manualListId) return;
    setSending(true);
    setSendResult(null);

    const audienceFilter = selList.id === 'manual'
      ? { list_id: manualListId }
      : selList.id === FILTERED_AUDIENCE_ID
        ? {
            crm_class: CRM_LEAD_CLASS,
            stage_names: selectedStageNames,
            contact_status_ids: selectedStatusIds,
            legacy_crm_risks: contactStatuses
              .filter(status => selectedStatusIds.includes(status.id))
              .map(status => status.legacy_crm_risk)
              .filter(Boolean),
          }
        : selList.filter;
    const recipientCount = selList.id === 'manual'
      ? (manualLists.find(l => l.id === manualListId)?.member_count ?? 0)
      : selList.id === FILTERED_AUDIENCE_ID
        ? (filteredCount ?? 0)
        : (selList.count ?? 0);

    const { data: broadcast, error: broadcastErr } = await supabase
      .from('crm_broadcasts')
      .insert([{
        name: `${selList.name} — ${selTpl.name}`,
        channel,
        template_id: selTpl.id,
        audience_type: selList.id,
        audience_filter: audienceFilter,
        recipient_count: recipientCount,
        status: 'draft',
        created_by: user?.id ?? null,
      }])
      .select('id')
      .single();

    if (broadcastErr || !broadcast) {
      setSendResult({ error: broadcastErr?.message ?? 'שגיאה ביצירת השידור' });
      setSending(false);
      return;
    }

    const { data: result, error: fnErr } = await supabase.functions.invoke('crm-broadcast-send', {
      body: { broadcast_id: broadcast.id, user_id: user?.id ?? null },
    });

    if (fnErr) {
      setSendResult({ error: fnErr.message });
      setSending(false);
      setSent(true);
      return;
    }

    setSendResult(result as SendResult);
    setSending(false);
    setSent(true);
    setTimeout(reset, 3000);
  };

  const reset = () => {
    setStep(0); setSelList(null); setSelTpl(null); setSent(false); setSending(false);
    setRecipientPreview([]); setRecipientStats({ total: 0, available: 0, unavailable: 0 }); setPreviewExpanded(true); setSendResult(null);
    setManualListId(null);
  };

  // Manual audience sentinel — reused when selecting a manual list card
  const manualAudienceSentinel: AudienceList = {
    id: 'manual', name: 'רשימה ידנית', desc: '', count: null, filter: { manual: true },
  };

  const audienceCount = selList?.id === 'manual'
    ? (manualLists.find(l => l.id === manualListId)?.member_count ?? null)
    : selList?.id === FILTERED_AUDIENCE_ID
      ? filteredCount
      : (selList?.count ?? null);
  const confirmationRecipientCount = loadingPreview ? null : recipientStats.available;
  const channelLabel = channel === 'whatsapp' ? 'וואטסאפ' : 'מייל';
  const channelDestinationLabel = channel === 'whatsapp' ? 'טלפון' : 'כתובת מייל';
  const channelRequirementText = channel === 'whatsapp'
    ? 'נמענים ללא מספר טלפון לא ייכללו בשליחה.'
    : 'נמענים ללא כתובת מייל לא ייכללו בשליחה.';
  const selectedAudienceKindLabel = selList?.id === 'renewal'
    ? 'לקוחות'
    : selList?.id === 'manual'
      ? 'מוסדות ברשימה'
      : 'לידים';
  const emptyPreviewText = recipientStats.total === 0
    ? `לא נמצאו ${selectedAudienceKindLabel} שמתאימים לסינונים שנבחרו.`
    : `אין נמענים זמינים לשליחת ${channelLabel}. ${channelRequirementText}`;
  const noSendableRecipients = !loadingPreview && recipientStats.available === 0;
  const sendDisabled = sending || loadingPreview || noSendableRecipients;
  const selectedListLabel = selList?.id === 'manual'
    ? manualLists.find(l => l.id === manualListId)?.name ?? '—'
    : selList?.name ?? '—';

  // Is the "Next" button enabled?
  const canAdvance = selList !== null && (selList.id !== 'manual' || manualListId !== null);

  const selectFilteredAudience = () => {
    if (hasRecipientFilters) {
      setSelList(filteredAudience);
      setManualListId(null);
    }
  };

  const toggleStageFilter = (stageName: string) => {
    setSelectedStageNames(prev => {
      const next = prev.includes(stageName) ? prev.filter(name => name !== stageName) : [...prev, stageName];
      return next;
    });
  };

  const toggleStatusFilter = (statusId: string) => {
    setSelectedStatusIds(prev => {
      const next = prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId];
      return next;
    });
  };

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto', minHeight: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom: 12, padding: '9px 14px', background: C.successBg, color: C.success, fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.success}30` }}>
          ✓ {toast}
        </div>
      )}

      {/* Edit group modal */}
      {editGroup && (
        <EditGroupModal
          list={editGroup}
          userId={user?.id ?? null}
          onClose={() => setEditGroup(null)}
          onSaved={message => { setEditGroup(null); setToast(message); loadManualLists(); }}
        />
      )}

      {/* Channel + steps bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
          {([
            { id: 'whatsapp' as Channel, l: '📱 וואטסאפ', c: C.teal },
            { id: 'email' as Channel, l: '📧 מייל', c: C.accent },
          ] as const).map(t => (
            <div
              key={t.id}
              onClick={() => { setChannel(t.id); setSelTpl(null); }}
              style={{ padding: '7px 18px', fontSize: 13, fontWeight: channel === t.id ? 600 : 400, color: channel === t.id ? t.c : C.textSub, background: channel === t.id ? C.surface : 'transparent', cursor: 'pointer' }}
            >
              {t.l}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Steps step={step} onGoTo={setStep} />
      </div>

      {/* ── Step 0: audience ── */}
      {step === 0 && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>בחר רשימת נמענים</div>
          {/* Unified card grid — dynamic + manual + create */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>

            <div
              onClick={selectFilteredAudience}
              style={{ background: C.surface, border: `2px solid ${selList?.id === FILTERED_AUDIENCE_ID ? C.accent : C.border}`, borderRadius: 9, padding: '12px 16px', cursor: hasRecipientFilters ? 'pointer' : 'default' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.tealBg, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>#</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>סינון נמענים לפי CRM</div>
                  <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>בחרו שלבי פייפליין ו/או סטטוסי קשר. הבחירה כאן הופכת אוטומטית לקהל השליחה.</div>
                </div>
                <div style={{ textAlign: 'center', minWidth: 58 }}>
                  {loadingFilteredCount ? (
                    <div style={{ fontSize: 11, color: C.textDim }}>...</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.teal }}>{hasRecipientFilters ? (filteredCount ?? 0) : '-'}</div>
                      <div style={{ fontSize: 10, color: C.textDim }}>נמענים תואמים</div>
                    </>
                  )}
                </div>
                {selList?.id === FILTERED_AUDIENCE_ID && <span style={{ color: C.accent, fontSize: 18, fontWeight: 700 }}>✓</span>}
              </div>

              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filterLoadError && (
                  <div style={{ padding: '8px 10px', borderRadius: 7, background: C.warningBg, color: C.warning, fontSize: 12, fontWeight: 600 }}>
                    שגיאה בטעינת סינוני CRM: {filterLoadError}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.textSub, marginBottom: 6 }}>שלב בפייפליין</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {loadingRecipientFilters && <span style={{ fontSize: 12, color: C.textDim }}>טוען שלבים...</span>}
                    {!loadingRecipientFilters && pipelineStages.length === 0 && <span style={{ fontSize: 12, color: C.textDim }}>לא נמצאו שלבים פעילים</span>}
                    {pipelineStages.map(stage => {
                      const selected = selectedStageNames.includes(stage.name);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => { toggleStageFilter(stage.name); setSelList({ ...filteredAudience, count: filteredCount }); setManualListId(null); }}
                          style={{ padding: '5px 10px', borderRadius: 16, border: `1px solid ${selected ? stage.color : C.border}`, background: selected ? `${stage.color}18` : C.surface, color: selected ? stage.color : C.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {stage.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.textSub, marginBottom: 6 }}>סטטוס קשר</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {loadingRecipientFilters && <span style={{ fontSize: 12, color: C.textDim }}>טוען סטטוסים...</span>}
                    {!loadingRecipientFilters && contactStatuses.length === 0 && <span style={{ fontSize: 12, color: C.textDim }}>לא נמצאו סטטוסי קשר פעילים</span>}
                    {contactStatuses.map(status => {
                      const selected = selectedStatusIds.includes(status.id);
                      return (
                        <button
                          key={status.id}
                          type="button"
                          onClick={() => { toggleStatusFilter(status.id); setSelList({ ...filteredAudience, count: filteredCount }); setManualListId(null); }}
                          style={{ padding: '5px 10px', borderRadius: 16, border: `1px solid ${selected ? status.color : C.border}`, background: selected ? `${status.color}18` : C.surface, color: selected ? status.color : C.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic audience cards */}
            {audiences.map(l => {
              const isSelected = selList?.id === l.id;
              return (
                <div
                  key={l.id}
                  onClick={() => { setSelList(l); setManualListId(null); }}
                  style={{ background: C.surface, border: `2px solid ${isSelected ? C.accent : C.border}`, borderRadius: 9, padding: '12px 16px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📋</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>{l.desc}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 48 }}>
                      {loadingCounts ? (
                        <div style={{ fontSize: 11, color: C.textDim }}>טוען...</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{l.count ?? '—'}</div>
                          <div style={{ fontSize: 10, color: C.textDim }}>נמענים</div>
                        </>
                      )}
                    </div>
                    {isSelected && <span style={{ color: C.accent, fontSize: 18, fontWeight: 700 }}>✓</span>}
                  </div>
                  {/* Expandable contacts preview */}
                  <div onClick={e => e.stopPropagation()}>
                    <ExpandableMemberTable
                      sourceKind="dynamic"
                      channel={channel}
                      audienceId={l.id}
                      monthStart={dateStrings.monthStart}
                      sevenDaysAgo={dateStrings.sevenDaysAgo}
                      noReplyStageName={noReplyStageName}
                    />
                  </div>
                </div>
              );
            })}

            {/* Manual list cards */}
            {loadingManualLists ? (
              <div style={{ padding: '14px 16px', background: C.bg, borderRadius: 8, fontSize: 12, color: C.textDim }}>טוען רשימות ידניות...</div>
            ) : (
              <>
                {manualLists.map(list => {
                  const isSelected = selList?.id === 'manual' && manualListId === list.id;
                  return (
                    <div
                      key={list.id}
                      style={{ background: C.surface, border: `2px solid ${isSelected ? C.accent : C.border}`, borderRadius: 9, padding: '12px 16px' }}
                    >
                      {/* Card header row — clickable for selection */}
                      <div
                        onClick={() => { setSelList(manualAudienceSentinel); setManualListId(list.id); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: C.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📝</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{list.name}</div>
                          {list.description && <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>{list.description}</div>}
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 48 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: C.purple }}>{list.member_count}</div>
                          <div style={{ fontSize: 10, color: C.textDim }}>נמענים</div>
                        </div>
                        {/* Delete button */}
                        <div onClick={e => e.stopPropagation()}>
                          {deleteId === list.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button
                                onClick={() => handleDeleteList(list.id)}
                                disabled={deleting}
                                style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.danger, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                {deleting ? '...' : 'מחק'}
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 11, cursor: 'pointer' }}
                              >
                                ביטול
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteId(list.id)}
                              title="מחק רשימה"
                              style={{ padding: '3px 7px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.danger, fontSize: 12, cursor: 'pointer' }}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                        {isSelected && <span style={{ color: C.accent, fontSize: 18, fontWeight: 700 }}>✓</span>}
                      </div>

                      {/* Expandable contacts */}
                      <div onClick={e => e.stopPropagation()}>
                        <ExpandableMemberTable sourceKind="list" channel={channel} listId={list.id} />
                      </div>

                      {/* Edit group — rename + add/remove institutions */}
                      <button
                        onClick={e => { e.stopPropagation(); setEditGroup(list); }}
                        style={{ marginTop: 8, padding: '5px 0', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%' }}
                      >
                        ✏️ ערוך קבוצה
                      </button>
                    </div>
                  );
                })}

                {/* Create new list card / form */}
                {showCreate ? (
                  <div style={{ background: C.bg, border: `2px dashed ${C.accent}`, borderRadius: 9, padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: C.accent }}>יצירת רשימה חדשה</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>שם הרשימה *</label>
                        <input
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          placeholder="לדוגמה: לידים — תל אביב"
                          style={{ width: '100%', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>תיאור (אופציונלי)</label>
                        <input
                          value={newDesc}
                          onChange={e => setNewDesc(e.target.value)}
                          placeholder="תיאור קצר..."
                          style={{ width: '100%', padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.textSub, display: 'block', marginBottom: 4 }}>מוסדות</label>
                        <InstSearchBox
                          selected={createSelected}
                          onSelect={inst => setCreateSelected(prev => [...prev, inst])}
                          onRemove={id => setCreateSelected(prev => prev.filter(i => i.id !== id))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                        <button
                          onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setCreateSelected([]); }}
                          style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          ביטול
                        </button>
                        <button
                          disabled={!newName.trim() || creating}
                          onClick={handleCreateList}
                          style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: newName.trim() ? C.accent : C.border, color: '#fff', fontSize: 12, fontWeight: 600, cursor: newName.trim() && !creating ? 'pointer' : 'not-allowed', opacity: creating ? 0.7 : 1 }}
                        >
                          {creating ? 'יוצר...' : 'צור רשימה'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setShowCreate(true)}
                    style={{ background: C.surface, border: `2px dashed ${C.border}`, borderRadius: 9, padding: '18px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.textSub, fontSize: 13, fontWeight: 600 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.accent; (e.currentTarget as HTMLDivElement).style.color = C.accent; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.color = C.textSub; }}
                  >
                    <span style={{ fontSize: 18 }}>+</span>
                    <span>צור רשימה חדשה</span>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            disabled={!canAdvance}
            onClick={() => setStep(1)}
            style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: canAdvance ? C.accent : C.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: canAdvance ? 'pointer' : 'not-allowed', opacity: canAdvance ? 1 : 0.5 }}
          >
            הבא — בחר הודעה →
          </button>
        </div>
      )}

      {/* ── Step 1: template ── */}
      {step === 1 && (
        <div style={{ maxWidth: 580 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>בחר תבנית הודעה</div>
          {templates.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: C.textSub, fontSize: 13, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9 }}>
              אין תבניות לערוץ זה. צור תבניות בעורך ההודעות.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelTpl(t)}
                  style={{ background: C.surface, border: `2px solid ${selTpl?.id === t.id ? C.accent : C.border}`, borderRadius: 9, padding: '12px 15px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <StageBadge stage={t.stage} color={pipelineStages.find(stage => stage.name === t.stage)?.color} />
                      {selTpl?.id === t.id && <span style={{ color: C.accent, fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.body.slice(0, 100)}{t.body.length > 100 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(0)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: C.text }}>
              ← חזור
            </button>
            <button
              disabled={!selTpl}
              onClick={() => setStep(2)}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: selTpl ? C.accent : C.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: selTpl ? 'pointer' : 'not-allowed', opacity: selTpl ? 1 : 0.5 }}
            >
              {`הבא — אישור ושליחה${audienceCount !== null ? ` (${audienceCount})` : ''} →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: confirm / sent ── */}
      {step === 2 && (
        <div style={{ maxWidth: 480 }}>
          {!sent ? (
            <>
              {/* Banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.aiBg, border: `1px solid ${C.ai}20`, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                <span style={{ color: C.ai, flex: 1 }}>
                  עומד לשלוח <b>{channelLabel}</b> ל-<b>{confirmationRecipientCount ?? '?'} נמענים זמינים</b>
                </span>
              </div>

              {/* Summary card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
                {([
                  ['ערוץ', channel === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'],
                  ['רשימה', `${selectedListLabel} (${confirmationRecipientCount ?? '?'})`],
                  ['תבנית', selTpl?.name ?? '—'],
                  ['שליחה', 'מיידית'],
                ] as const).map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < 3 ? `1px solid ${C.borderLight}` : 'none' }}>
                    <span style={{ width: 70, fontSize: 12, color: C.textSub, fontWeight: 500 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.borderLight}` }}>
                  <span style={{ width: 70, fontSize: 12, color: C.textSub, fontWeight: 500 }}>נמענים</span>
                  <div style={{ flex: 1 }}>
                    {loadingPreview ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>מחשב נמענים זמינים...</span>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ padding: '3px 8px', borderRadius: 20, background: C.grayBg, color: C.gray, fontSize: 11, fontWeight: 700 }}>
                            {recipientStats.total} התאמות
                          </span>
                          <span style={{ padding: '3px 8px', borderRadius: 20, background: C.successBg, color: C.success, fontSize: 11, fontWeight: 700 }}>
                            {recipientStats.available} זמינים לשליחה
                          </span>
                          {recipientStats.unavailable > 0 && (
                            <span style={{ padding: '3px 8px', borderRadius: 20, background: C.warningBg, color: C.warning, fontSize: 11, fontWeight: 700 }}>
                              {recipientStats.unavailable} ללא {channelDestinationLabel}
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 5, fontSize: 11, color: recipientStats.available === 0 ? C.warning : C.textSub }}>
                          {recipientStats.available === 0 ? `אין נמענים זמינים. ${channelRequirementText}` : channelRequirementText}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Message preview */}
              <div style={{ padding: '12px 14px', borderRadius: 9, background: channel === 'whatsapp' ? '#E9FBD8' : C.accentBg, marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap' }}>
                {selTpl?.body.replace(/\[שם\]/g, '[שם הנמען]')}
                {Array.isArray(selTpl?.attachments) && selTpl!.attachments!.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>📎 קבצים שיישלחו עם ההודעה</div>
                    {selTpl!.attachments!.map((att, idx) => {
                      const icon = att.kind === 'image' ? '🖼️' : att.kind === 'video' ? '🎬' : att.kind === 'audio' ? '🎵' : '📄';
                      return (
                        <a key={`${att.url}_${idx}`} href={att.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text, textDecoration: 'none' }}>
                          <span>{icon}</span>
                          <span style={{ fontWeight: 500 }}>{att.name}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recipient preview table */}
              <div style={{ marginBottom: 16 }}>
                <div
                  onClick={() => setPreviewExpanded(prev => !prev)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    נמענים ({loadingPreview ? '...' : recipientPreview.length})
                  </span>
                  <span style={{ fontSize: 10, color: C.textSub, display: 'inline-block', transform: previewExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                </div>

                {previewExpanded && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    {loadingPreview ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: C.textDim }}>
                        ⟳ מחשב התאמה לערוץ ובונה תצוגה מקדימה...
                      </div>
                    ) : recipientPreview.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{emptyPreviewText}</div>
                        <div style={{ marginTop: 5, fontSize: 11, color: C.textSub }}>
                          שינוי סינון הקהל או הערוץ יעדכן את הספירה והתצוגה.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0 }}>
                                <th style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: C.textSub, whiteSpace: 'nowrap' }}>מוסד</th>
                                <th style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: C.textSub, whiteSpace: 'nowrap' }}>איש קשר</th>
                                <th style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 600, color: C.textSub, whiteSpace: 'nowrap' }}>
                                  {channel === 'whatsapp' ? 'טלפון' : 'מייל'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {recipientPreview.map((row, i) => (
                                <tr
                                  key={row.institution_id}
                                  style={{ borderBottom: i < recipientPreview.length - 1 ? `1px solid ${C.borderLight}` : 'none', background: i % 2 === 0 ? C.surface : C.bg }}
                                >
                                  <td style={{ padding: '6px 12px', fontWeight: 500 }}>{row.institution_name}</td>
                                  <td style={{ padding: '6px 12px', color: row.contact_name ? C.text : C.textDim }}>{row.contact_name ?? 'אין איש קשר'}</td>
                                  <td style={{ padding: '6px 12px', color: C.textSub }}>
                                    <span>{(channel === 'whatsapp' ? row.phone : row.email) ?? '—'}</span>
                                    <span style={{ marginInlineStart: 6, padding: '2px 6px', borderRadius: 20, background: C.successBg, color: C.success, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      יש {channelDestinationLabel}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, cursor: 'pointer', fontWeight: 600, color: C.text }}>
                  ← חזור
                </button>
                <button
                  onClick={doSend}
                  disabled={sendDisabled}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: sendDisabled ? C.border : C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: sendDisabled ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                >
                  {sending ? '⟳ שולח...' : loadingPreview ? 'מחשב נמענים...' : noSendableRecipients ? 'אין נמענים זמינים' : '📤 שלח עכשיו'}
                </button>
              </div>
              {noSendableRecipients && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: C.warningBg, color: C.warning, fontSize: 12, fontWeight: 600 }}>
                  אי אפשר לשלוח כרגע: הסינון הנוכחי לא מחזיר נמענים עם {channelDestinationLabel}.
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              {sendResult?.error ? (
                <>
                  <div style={{ fontSize: 44, marginBottom: 14 }}>❌</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: C.danger }}>שגיאה בשליחה</div>
                  <div style={{ fontSize: 12, color: C.textSub, marginBottom: 24, padding: '8px 14px', background: C.dangerBg, borderRadius: 8 }}>{sendResult.error}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>נשלח בהצלחה!</div>
                  <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>
                    הושלמה שליחה לרשימה "{selList?.id === 'manual' ? manualLists.find(l => l.id === manualListId)?.name : selList?.name}"
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 22, maxWidth: 320, margin: '0 auto 22px' }}>
                    {([
                      ['נשלחו', sendResult?.sent ?? 0, C.success],
                      ['דולגו', sendResult?.skipped ?? 0, C.warning],
                      ['נכשלו', sendResult?.failed ?? 0, C.danger],
                    ] as const).map(([l, v, c], i) => (
                      <div key={i} style={{ padding: '10px', borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, color: C.textSub }}>{l}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>מתאפס אוטומטית תוך שניות...</div>
              <button onClick={reset} style={{ padding: '7px 22px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                שליחה חדשה
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
