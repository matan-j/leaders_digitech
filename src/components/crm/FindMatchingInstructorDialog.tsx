import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeMatchScore, type MatchContext, type MatchResult } from '@/lib/instructors/matching';
import InstructorMatchCard, { type MatchCardInstructor } from './InstructorMatchCard';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: MatchContext;
  onSelect?: (instructorId: string) => void;
  excludeInstructorId?: string | null;
  title?: string;
}

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const FindMatchingInstructorDialog = ({
  open,
  onOpenChange,
  context,
  onSelect,
  excludeInstructorId,
  title,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [instructors, setInstructors] = useState<MatchCardInstructor[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('instructors')
        .select(
          'id, full_name, city, region, subjects, audiences, availability_days, hourly_rate, rating_score, phone, profile_id, status'
        )
        .eq('status', 'active');

      if (cancelled) return;
      if (error) {
        console.error('failed to load instructors for matching', error);
        setInstructors([]);
        setLoading(false);
        return;
      }
      // Hydrate current_load for instructors with a profile_id.
      const rows = data ?? [];
      const profileIds = rows.map((r: { profile_id: string | null }) => r.profile_id).filter(Boolean) as string[];
      const loadByProfile: Record<string, number> = {};
      if (profileIds.length > 0) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const { data: ciRows } = await supabase
          .from('course_instances')
          .select('instructor_id, end_date')
          .in('instructor_id', profileIds)
          .gte('end_date', todayIso);
        for (const ci of ciRows ?? []) {
          const pid = (ci as { instructor_id: string }).instructor_id;
          loadByProfile[pid] = (loadByProfile[pid] ?? 0) + 1;
        }
      }
      const hydrated: MatchCardInstructor[] = rows.map((r) => ({
        id: r.id as string,
        full_name: r.full_name as string,
        city: (r.city as string) ?? null,
        region: (r.region as string) ?? null,
        subjects: (r.subjects as string[]) ?? null,
        audiences: (r.audiences as string[]) ?? null,
        availability_days: (r.availability_days as number[]) ?? null,
        hourly_rate: (r.hourly_rate as number) ?? null,
        rating_score: (r.rating_score as number) ?? null,
        phone: (r.phone as string) ?? null,
        current_load:
          r.profile_id != null ? loadByProfile[r.profile_id as string] ?? 0 : null,
      }));
      setInstructors(hydrated);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ranked = useMemo(() => {
    const list = instructors
      .filter((i) => (excludeInstructorId ? i.id !== excludeInstructorId : true))
      .filter((i) => {
        if (!filter.trim()) return true;
        const f = filter.trim().toLowerCase();
        return (
          (i.full_name ?? '').toLowerCase().includes(f) ||
          (i.city ?? '').toLowerCase().includes(f) ||
          (i.subjects ?? []).some((s) => s.toLowerCase().includes(f))
        );
      })
      .map<{ instructor: MatchCardInstructor; match: MatchResult }>((i) => ({
        instructor: i,
        match: computeMatchScore(
          {
            id: i.id,
            city: i.city,
            region: i.region,
            subjects: i.subjects,
            audiences: i.audiences,
            availability_days: i.availability_days,
            rating_score: i.rating_score,
            current_load: i.current_load,
          },
          context
        ),
      }));
    list.sort((a, b) => b.match.score - a.match.score);
    return list;
  }, [instructors, context, filter, excludeInstructorId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>{title ?? 'בחירת מדריך מתאים'}</DialogTitle>
        </DialogHeader>

        {/* Context summary */}
        <div className="text-xs text-gray-600 flex flex-wrap gap-3 border-b pb-2">
          {context.city && <span>עיר: <strong>{context.city}</strong></span>}
          {context.subjects && context.subjects.length > 0 && (
            <span>תחומים: <strong>{context.subjects.join(', ')}</strong></span>
          )}
          {context.audiences && context.audiences.length > 0 && (
            <span>קהל: <strong>{context.audiences.join(', ')}</strong></span>
          )}
          {context.day_of_week !== undefined && context.day_of_week !== null && (
            <span>יום: <strong>{DAY_LABELS[context.day_of_week]}</strong></span>
          )}
        </div>

        <div className="py-2">
          <Label htmlFor="match-filter" className="sr-only">חיפוש</Label>
          <Input
            id="match-filter"
            placeholder="חיפוש שם / עיר / תחום"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : ranked.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">לא נמצאו מדריכים</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
              {ranked.map((r) => (
                <InstructorMatchCard
                  key={r.instructor.id}
                  instructor={r.instructor}
                  match={r.match}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FindMatchingInstructorDialog;
