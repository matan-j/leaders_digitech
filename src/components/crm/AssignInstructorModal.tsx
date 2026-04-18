import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const C = {
  surface: '#FFFFFF',
  border: '#E4E7ED',
  text: '#111827',
  textSub: '#6B7280',
  accent: '#3B5BDB',
  accentBg: '#EEF2FF',
  success: '#16A34A',
  successBg: '#DCFCE7',
  bg: '#F8F9FB',
};

const Av = ({ name, size = 28 }: { name: string; size?: number }) => (
  <div
    style={{
      width: size, height: size, borderRadius: '50%',
      background: C.accentBg, color: C.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size / 2.6, fontWeight: 700, flexShrink: 0,
    }}
  >
    {(name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
  </div>
);

interface Instructor {
  id: string;
  full_name: string;
  city?: string | null;
}

interface Props {
  institutionId: string;
  institutionName: string;
  institutionCity: string | null;
  onClose: () => void;
  onAssigned: (instructorId: string, instructorName: string) => void;
}

const AssignInstructorModal = ({
  institutionId,
  institutionName,
  institutionCity,
  onClose,
  onAssigned,
}: Props) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, city')
        .eq('role', 'instructor')
        .order('full_name');
      if (data) setInstructors(data as Instructor[]);
    };
    load();
  }, []);

  const cityNorm = (institutionCity ?? '').trim();
  const suggested = instructors.filter(
    (i) => i.city && i.city.trim() === cityNorm && cityNorm !== '',
  );
  const others = instructors.filter(
    (i) => !(i.city && i.city.trim() === cityNorm && cityNorm !== ''),
  );

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('educational_institutions')
      .update({ crm_assigned_instructor_id: selected })
      .eq('id', institutionId);
    setSaving(false);
    if (!error) {
      const instr = instructors.find((i) => i.id === selected);
      onAssigned(selected, instr?.full_name ?? '');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(15,17,23,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.surface, borderRadius: 12, width: 440,
        maxWidth: '94vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }} dir="rtl">
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>שיוך מדריך — {institutionName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: C.textSub, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '18px 22px', flex: 1 }}>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12 }}>
            🏙 עיר: <b style={{ color: C.text }}>{institutionCity ?? '—'}</b>
          </div>

          {suggested.length > 0 && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.success,
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8,
              }}>
                ✓ מדריכים לפי אזור
              </div>
              {suggested.map((instr) => (
                <div
                  key={instr.id}
                  onClick={() => setSelected(instr.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    border: `2px solid ${selected === instr.id ? C.accent : C.border}`,
                    marginBottom: 6, cursor: 'pointer',
                    background: selected === instr.id ? C.accentBg : C.surface,
                  }}
                >
                  <Av name={instr.full_name} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{instr.full_name}</div>
                    {instr.city && <div style={{ fontSize: 11, color: C.textSub }}>{instr.city}</div>}
                  </div>
                  <span style={{
                    fontSize: 10, color: C.success, fontWeight: 700,
                    background: C.successBg, padding: '2px 7px', borderRadius: 10,
                  }}>מתאים</span>
                  {selected === instr.id && <span style={{ color: C.accent, fontSize: 16 }}>✓</span>}
                </div>
              ))}
            </>
          )}

          {others.length > 0 && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.textSub,
                textTransform: 'uppercase', letterSpacing: '0.4px',
                margin: '12px 0 8px',
              }}>
                מדריכים אחרים
              </div>
              {others.map((instr) => (
                <div
                  key={instr.id}
                  onClick={() => setSelected(instr.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    border: `2px solid ${selected === instr.id ? C.accent : C.border}`,
                    marginBottom: 5, cursor: 'pointer',
                    background: selected === instr.id ? C.accentBg : C.surface,
                  }}
                >
                  <Av name={instr.full_name} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{instr.full_name}</div>
                    {instr.city && <div style={{ fontSize: 11, color: C.textSub }}>{instr.city}</div>}
                  </div>
                  {selected === instr.id && <span style={{ color: C.accent, fontSize: 16 }}>✓</span>}
                </div>
              ))}
            </>
          )}

          {instructors.length === 0 && (
            <div style={{ fontSize: 13, color: C.textSub }}>טוען מדריכים...</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '13px 22px', borderTop: `1px solid ${C.border}`,
          flexShrink: 0, display: 'flex', gap: 8,
        }}>
          <button
            onClick={handleAssign}
            disabled={!selected || saving}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, borderRadius: 6, fontWeight: 600,
              cursor: !selected || saving ? 'not-allowed' : 'pointer',
              border: 'none', fontSize: 13, padding: '7px 14px',
              background: C.accent, color: '#fff',
              opacity: !selected || saving ? 0.45 : 1,
            }}
          >
            {saving ? 'שומר...' : '✓ שייך מדריך'}
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, borderRadius: 6, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${C.border}`, fontSize: 13, padding: '7px 14px',
              background: C.surface, color: C.text,
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignInstructorModal;
