import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type FocusField = 'institution' | 'course';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructorId: string;
  instructorName: string;
  focus?: FocusField;
  onAssigned?: () => void;
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const AssignInstructorPlanningDialog = ({
  open, onOpenChange, instructorId, instructorName, focus = 'institution', onAssigned,
}: Props) => {
  const [institutions, setInstitutions] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [institutionId, setInstitutionId] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');
  const [schoolYear, setSchoolYear] = useState<string>('תשפ"ז');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInstitutionId('');
    setCourseId('');
    setSchoolYear('תשפ"ז');
    setDayOfWeek('');
    setStartTime('');
    setEndTime('');
    setNotes('');

    const load = async () => {
      setLoadingOptions(true);
      const [{ data: ins }, { data: cs }] = await Promise.all([
        supabase.from('educational_institutions').select('id, name, city').order('name'),
        supabase.from('courses').select('id, name').eq('is_visible', true).order('name'),
      ]);
      setInstitutions((ins ?? []) as { id: string; name: string; city: string | null }[]);
      setCourses((cs ?? []) as { id: string; name: string }[]);
      setLoadingOptions(false);
    };
    load();
  }, [open]);

  const handleSave = async () => {
    if (!institutionId && !courseId) {
      toast.error('יש לבחור מוסד או קורס לפחות');
      return;
    }
    setSaving(true);
    const payload = {
      instructor_id: instructorId,
      institution_id: institutionId || null,
      course_id: courseId || null,
      school_year: schoolYear.trim() || null,
      day_of_week: dayOfWeek === '' ? null : parseInt(dayOfWeek, 10),
      start_time: startTime || null,
      end_time: endTime || null,
      notes: notes.trim() || null,
      status: 'pending',
    };
    const { error } = await supabase.from('instructor_assignments').insert([payload]);
    setSaving(false);
    if (error) {
      console.error('assignment insert failed', error);
      toast.error(`שמירת השיבוץ נכשלה: ${error.message ?? ''}`);
      return;
    }
    toast.success('השיבוץ נשמר');
    onAssigned?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיבוץ {instructorName}</DialogTitle>
        </DialogHeader>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ai-institution">מוסד {focus === 'institution' && <span className="text-amber-600">(מומלץ)</span>}</Label>
              <select
                id="ai-institution"
                autoFocus={focus === 'institution'}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
              >
                <option value="">— ללא —</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}{i.city ? ` · ${i.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ai-course">קורס {focus === 'course' && <span className="text-amber-600">(מומלץ)</span>}</Label>
              <select
                id="ai-course"
                autoFocus={focus === 'course'}
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white"
              >
                <option value="">— ללא —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ai-year">שנה"ל</Label>
                <Input id="ai-year" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ai-day">יום</Label>
                <select
                  id="ai-day"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full h-10 px-2 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option value="">—</option>
                  {DAY_LABELS.map((label, idx) => (
                    <option key={idx} value={String(idx)}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1">
                <div className="flex-1">
                  <Label htmlFor="ai-start">משעה</Label>
                  <Input id="ai-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label htmlFor="ai-end">עד</Label>
                  <Input id="ai-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="ai-notes">הערות</Label>
              <Textarea id="ai-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 rounded p-2">
              שיבוץ זה נשמר כשורת תכנון ב-<code>instructor_assignments</code> ולא משנה אוטומטית את ה-CRM של המוסד או את <code>course_instances</code>.
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving || loadingOptions}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שמור שיבוץ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignInstructorPlanningDialog;
