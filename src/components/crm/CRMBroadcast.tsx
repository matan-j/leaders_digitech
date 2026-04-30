import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = 'whatsapp' | 'email';

interface AudienceList {
  id: string;
  name: string;
  desc: string;
  count: number | null;
  filter: Record<string, unknown>;
}

interface Template {
  id: string;
  name: string;
  stage: string | null;
  channel: Channel;
  body: string;
}

interface CRMList {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
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

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#F8F9FB', surface: '#FFFFFF', border: '#E4E7ED', borderLight: '#F0F2F5',
  text: '#111827', textSub: '#6B7280', textDim: '#9CA3AF',
  accent: '#3B5BDB', accentBg: '#EEF2FF',
  success: '#16A34A', successBg: '#DCFCE7',
  warning: '#D97706', warningBg: '#FEF3C7',
  danger: '#DC2626', dangerBg: '#FEE2E2',
  teal: '#0891B2', tealBg: '#CFFAFE',
  purple: '#7C3AED', purpleBg: '#EDE9FE',
  gray: '#6B7280', grayBg: '#F3F4F6',
  ai: '#0EA5E9', aiBg: '#E0F2FE',
};

// ─── Stage badge ──────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const map: Record<string, [string, string]> = {
    'יצירת קשר': [C.textSub, C.grayBg],
    'מעוניין': [C.accent, C.accentBg],
    'סגירה': [C.warning, C.warningBg],
    'זכה': [C.success, C.successBg],
    'הפסיד': [C.danger, C.dangerBg],
    'Customer': [C.success, C.successBg],
  };
  const [color, bg] = map[stage] ?? [C.gray, C.grayBg];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
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
  listId = '',
  audienceId = '',
  monthStart = '',
  sevenDaysAgo = '',
  defaultExpanded = false,
}: {
  sourceKind: 'list' | 'dynamic';
  listId?: string;
  audienceId?: string;
  monthStart?: string;
  sevenDaysAgo?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [members, setMembers] = useState<ListMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;
    setLoading(true);
    (async () => {
      try {
        const LIMIT = 21;
        let instIds: string[] = [];

        if (sourceKind === 'list') {
          const { data: memberRows } = await supabase
            .from('crm_list_members')
            .select('institution_id')
            .eq('list_id', listId)
            .limit(LIMIT);
          if (!memberRows || memberRows.length === 0) {
            setMembers([]); setLoaded(true); setLoading(false); return;
          }
          setHasMore(memberRows.length === LIMIT);
          instIds = memberRows.slice(0, 20).map(m => m.institution_id);
        } else {
          let q = supabase.from('educational_institutions').select('id').limit(LIMIT);
          if (audienceId === 'new_leads')
            q = q.eq('crm_class', 'Lead').gte('created_at', monthStart) as typeof q;
          else if (audienceId === 'no_reply')
            q = q.eq('crm_stage', 'מעוניין').or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${sevenDaysAgo}`) as typeof q;
          else if (audienceId === 'renewal')
            q = q.eq('crm_class', 'Customer') as typeof q;
          else if (audienceId === 'all_active')
            q = q.in('crm_class', ['Lead', 'Customer']) as typeof q;
          const { data: rows } = await q;
          if (!rows || rows.length === 0) {
            setMembers([]); setLoaded(true); setLoading(false); return;
          }
          setHasMore(rows.length === LIMIT);
          instIds = rows.slice(0, 20).map(r => r.id);
        }

        const [{ data: institutions }, { data: contacts }] = await Promise.all([
          supabase.from('educational_institutions').select('id, name').in('id', instIds),
          supabase.from('crm_contacts').select('institution_id, name, phone, email, is_primary').in('institution_id', instIds),
        ]);

        const contactMap = new Map<string, { name: string; phone: string | null; email: string | null }>();
        for (const c of contacts ?? []) {
          if (c.is_primary && !contactMap.has(c.institution_id))
            contactMap.set(c.institution_id, { name: c.name, phone: c.phone ?? null, email: c.email ?? null });
        }
        for (const c of contacts ?? []) {
          if (!contactMap.has(c.institution_id))
            contactMap.set(c.institution_id, { name: c.name, phone: c.phone ?? null, email: c.email ?? null });
        }

        setMembers((institutions ?? []).map(inst => ({
          institution_id: inst.id,
          institution_name: inst.name,
          contact_name: contactMap.get(inst.id)?.name ?? null,
          phone: contactMap.get(inst.id)?.phone ?? null,
          email: contactMap.get(inst.id)?.email ?? null,
        })));
        setLoaded(true);
      } catch (err) {
        console.error('[ExpandableMemberTable] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded, loaded, sourceKind, listId, audienceId, monthStart, sevenDaysAgo]);

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

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);

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

  // Add members to existing list
  const [addToListId, setAddToListId] = useState<string | null>(null);
  const [addSelected, setAddSelected] = useState<InstResult[]>([]);
  const [addSaving, setAddSaving] = useState(false);

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

  // Build dynamic audience counts
  useEffect(() => {
    async function buildAudiences() {
      setLoadingCounts(true);
      const [newLeads, noReply, renewal, allActive] = await Promise.all([
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_class', 'Lead').gte('created_at', dateStrings.monthStart),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_stage', 'מעוניין').lt('crm_last_contact_at', dateStrings.sevenDaysAgo),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).eq('crm_class', 'Customer'),
        supabase.from('educational_institutions').select('id', { count: 'exact', head: true }).in('crm_class', ['Lead', 'Customer']),
      ]);
      setAudiences([
        { id: 'new_leads', name: 'לידים חדשים (החודש)', desc: 'הצטרפו החודש', count: newLeads.count, filter: { crm_class: 'Lead', since: dateStrings.monthStart } },
        { id: 'no_reply', name: 'מעוניין — ללא מענה 7 ימים', desc: 'לא ענו בשבוע', count: noReply.count, filter: { crm_stage: 'מעוניין', no_reply: true } },
        { id: 'renewal', name: 'לקוחות — פוטנציאל חידוש', desc: 'לקוחות פעילים', count: renewal.count, filter: { crm_class: 'Customer' } },
        { id: 'all_active', name: 'כל הלידים הפעילים', desc: 'לא הפסידו', count: allActive.count, filter: { crm_class_in: ['Lead', 'Customer'] } },
      ]);
      setLoadingCounts(false);
    }
    buildAudiences();
  }, [dateStrings]);

  // Load templates filtered by channel
  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('crm_message_templates')
        .select('id, name, stage, channel, body')
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
    const { data: counts } = await supabase.from('crm_list_members').select('list_id');
    const countMap = new Map<string, number>();
    for (const c of counts ?? []) countMap.set(c.list_id, (countMap.get(c.list_id) ?? 0) + 1);
    setManualLists(lists.map(l => ({ ...l, member_count: countMap.get(l.id) ?? 0 })));
    setLoadingManualLists(false);
  }, []);

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

  const handleAddMembers = async (listId: string) => {
    if (addSelected.length === 0) { setAddToListId(null); return; }
    setAddSaving(true);
    await supabase.from('crm_list_members').upsert(
      addSelected.map(inst => ({ list_id: listId, institution_id: inst.id, added_by: user?.id ?? null })),
      { onConflict: 'list_id,institution_id', ignoreDuplicates: true }
    );
    setAddSaving(false);
    setAddToListId(null);
    setAddSelected([]);
    setToast('המוסדות נוספו בהצלחה');
    loadManualLists();
  };

  // Fetch recipient preview whenever step 2 is entered
  useEffect(() => {
    if (step !== 2 || sent) return;
    setLoadingPreview(true);
    setRecipientPreview([]);
    const MAX = 51;

    async function run() {
      try {
        let institutions: { id: string; name: string }[] = [];

        if (selList?.id === 'manual') {
          if (!manualListId) { setLoadingPreview(false); return; }
          const { data: members } = await supabase
            .from('crm_list_members')
            .select('institution_id')
            .eq('list_id', manualListId)
            .limit(MAX);
          const ids = (members ?? []).map((m: { institution_id: string }) => m.institution_id);
          if (ids.length === 0) { setRecipientPreview([]); setLoadingPreview(false); return; }
          const { data } = await supabase.from('educational_institutions').select('id, name').in('id', ids);
          institutions = data ?? [];
        } else {
          let q = supabase.from('educational_institutions').select('id, name').limit(MAX);
          if (selList?.id === 'new_leads')
            q = q.eq('crm_class', 'Lead').gte('created_at', dateStrings.monthStart);
          else if (selList?.id === 'no_reply')
            q = q.eq('crm_stage', 'מעוניין').or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${dateStrings.sevenDaysAgo}`);
          else if (selList?.id === 'renewal')
            q = q.eq('crm_class', 'Customer');
          else if (selList?.id === 'all_active')
            q = q.in('crm_class', ['Lead', 'Customer']);
          const { data } = await q;
          institutions = data ?? [];
        }

        if (institutions.length === 0) { setRecipientPreview([]); setLoadingPreview(false); return; }

        const instIds = institutions.map(i => i.id);
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, name, phone, email, institution_id, is_primary')
          .in('institution_id', instIds);

        const contactMap = new Map<string, { name: string; phone: string | null; email: string | null }>();
        for (const c of contacts ?? []) {
          if (c.is_primary && !contactMap.has(c.institution_id))
            contactMap.set(c.institution_id, { name: c.name, phone: c.phone ?? null, email: c.email ?? null });
        }
        for (const c of contacts ?? []) {
          if (!contactMap.has(c.institution_id))
            contactMap.set(c.institution_id, { name: c.name, phone: c.phone ?? null, email: c.email ?? null });
        }

        setRecipientPreview(institutions.map(inst => ({
          institution_id: inst.id,
          institution_name: inst.name,
          contact_name: contactMap.get(inst.id)?.name ?? null,
          phone: contactMap.get(inst.id)?.phone ?? null,
          email: contactMap.get(inst.id)?.email ?? null,
        })));
      } catch (err) {
        console.error('[CRMBroadcast] preview fetch error:', err);
      } finally {
        setLoadingPreview(false);
      }
    }
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sent]);

  const doSend = async () => {
    if (!selList || !selTpl) return;
    if (selList.id === 'manual' && !manualListId) return;
    setSending(true);
    setSendResult(null);

    const audienceFilter = selList.id === 'manual' ? { list_id: manualListId } : selList.filter;
    const recipientCount = selList.id === 'manual'
      ? (manualLists.find(l => l.id === manualListId)?.member_count ?? 0)
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
    setRecipientPreview([]); setPreviewExpanded(true); setSendResult(null);
    setManualListId(null);
  };

  // Manual audience sentinel — reused when selecting a manual list card
  const manualAudienceSentinel: AudienceList = {
    id: 'manual', name: 'רשימה ידנית', desc: '', count: null, filter: { manual: true },
  };

  const audienceCount = selList?.id === 'manual'
    ? (manualLists.find(l => l.id === manualListId)?.member_count ?? null)
    : (selList?.count ?? null);

  // Is the "Next" button enabled?
  const canAdvance = selList !== null && (selList.id !== 'manual' || manualListId !== null);

  return (
    <div dir="rtl" style={{ padding: '20px 24px', overflowY: 'auto', minHeight: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom: 12, padding: '9px 14px', background: C.successBg, color: C.success, fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.success}30` }}>
          ✓ {toast}
        </div>
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
                      audienceId={l.id}
                      monthStart={dateStrings.monthStart}
                      sevenDaysAgo={dateStrings.sevenDaysAgo}
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
                        <ExpandableMemberTable sourceKind="list" listId={list.id} />
                      </div>

                      {/* Add members */}
                      {addToListId === list.id ? (
                        <div style={{ marginTop: 10, padding: '10px', background: C.bg, borderRadius: 7, border: `1px solid ${C.borderLight}` }}>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>הוסף מוסדות לרשימה</div>
                          <InstSearchBox
                            selected={addSelected}
                            onSelect={inst => setAddSelected(prev => [...prev, inst])}
                            onRemove={id => setAddSelected(prev => prev.filter(i => i.id !== id))}
                          />
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setAddToListId(null); setAddSelected([]); }}
                              style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 11, cursor: 'pointer' }}
                            >
                              ביטול
                            </button>
                            <button
                              disabled={addSelected.length === 0 || addSaving}
                              onClick={() => handleAddMembers(list.id)}
                              style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: addSelected.length > 0 ? C.accent : C.border, color: '#fff', fontSize: 11, fontWeight: 600, cursor: addSelected.length > 0 && !addSaving ? 'pointer' : 'not-allowed', opacity: addSaving ? 0.7 : 1 }}
                            >
                              {addSaving ? 'שומר...' : 'הוסף'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setAddToListId(list.id); setAddSelected([]); }}
                          style={{ marginTop: 8, padding: '4px 0', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%' }}
                        >
                          + הוסף מוסדות
                        </button>
                      )}
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
                      <StageBadge stage={t.stage} />
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
                  עומד לשלוח <b>{channel === 'whatsapp' ? 'וואטסאפ' : 'מייל'}</b> ל-<b>{audienceCount ?? '?'} נמענים</b>
                </span>
              </div>

              {/* Summary card */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
                {([
                  ['ערוץ', channel === 'whatsapp' ? '📱 וואטסאפ' : '📧 מייל'],
                  ['רשימה', selList?.id === 'manual' ? `${manualLists.find(l => l.id === manualListId)?.name ?? '—'} (${audienceCount ?? '?'})` : `${selList?.name} (${selList?.count ?? '?'})`],
                  ['תבנית', selTpl?.name ?? '—'],
                  ['שליחה', 'מיידית'],
                ] as const).map(([k, v], i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < 3 ? `1px solid ${C.borderLight}` : 'none' }}>
                    <span style={{ width: 70, fontSize: 12, color: C.textSub, fontWeight: 500 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Message preview */}
              <div style={{ padding: '12px 14px', borderRadius: 9, background: channel === 'whatsapp' ? '#E9FBD8' : C.accentBg, marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap' }}>
                {selTpl?.body.replace(/\[שם\]/g, '[שם הנמען]')}
              </div>

              {/* Recipient preview table */}
              <div style={{ marginBottom: 16 }}>
                <div
                  onClick={() => setPreviewExpanded(prev => !prev)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                    נמענים ({loadingPreview ? '...' : Math.min(recipientPreview.length, 50)}{recipientPreview.length > 50 ? '+' : ''})
                  </span>
                  <span style={{ fontSize: 10, color: C.textSub, display: 'inline-block', transform: previewExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                </div>

                {previewExpanded && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    {loadingPreview ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: C.textDim }}>⟳ טוען נמענים...</div>
                    ) : recipientPreview.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: C.textDim }}>לא נמצאו נמענים</div>
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
                              {recipientPreview.slice(0, 50).map((row, i) => (
                                <tr
                                  key={row.institution_id}
                                  style={{ borderBottom: i < Math.min(recipientPreview.length, 50) - 1 ? `1px solid ${C.borderLight}` : 'none', background: i % 2 === 0 ? C.surface : C.bg }}
                                >
                                  <td style={{ padding: '6px 12px', fontWeight: 500 }}>{row.institution_name}</td>
                                  <td style={{ padding: '6px 12px', color: row.contact_name ? C.text : C.textDim }}>{row.contact_name ?? 'אין איש קשר'}</td>
                                  <td style={{ padding: '6px 12px', color: C.textSub }}>{(channel === 'whatsapp' ? row.phone : row.email) ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {recipientPreview.length > 50 && (
                          <div style={{ padding: '7px 12px', fontSize: 11, color: C.textDim, textAlign: 'center', borderTop: `1px solid ${C.borderLight}`, background: C.bg }}>
                            ועוד {recipientPreview.length - 50} נמענים נוספים...
                          </div>
                        )}
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
                  disabled={sending}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                >
                  {sending ? '⟳ שולח...' : '📤 שלח עכשיו'}
                </button>
              </div>
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
