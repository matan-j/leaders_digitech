import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import type { CeoGoal } from '@/hooks/useGrowthCopilot';

// goal_type stays in English (code/enum); labels shown to the user are Hebrew.
const GOAL_TYPES: { value: string; label: string }[] = [
  { value: 'new_schools', label: 'בתי ספר חדשים' },
  { value: 'organizations', label: 'ארגונים' },
  { value: 'peak_days', label: 'ימי שיא' },
  { value: 'newsletters', label: 'ניוזלטרים' },
  { value: 'opportunities', label: 'הזדמנויות' },
  { value: 'revenue', label: 'הכנסות (₪)' },
  { value: 'custom', label: 'אחר' },
];

const goalLabel = (t: string) => GOAL_TYPES.find((g) => g.value === t)?.label ?? t;

function monthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goals: CeoGoal[];
  onSave: (goal: Partial<CeoGoal>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function UpdateGoalsModal({ open, onOpenChange, goals, onSave, onDelete }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ goal_type: 'new_schools', target_value: 0, current_value: 0, success_definition: '' });

  const updateField = async (goal: CeoGoal, field: 'target_value' | 'current_value', value: number) => {
    setSavingId(goal.id);
    try {
      await onSave({ id: goal.id, [field]: value });
    } finally {
      setSavingId(null);
    }
  };

  const addGoal = async () => {
    const { start, end } = monthRange();
    setSavingId('new');
    try {
      await onSave({
        goal_type: newGoal.goal_type,
        target_value: Number(newGoal.target_value) || 0,
        current_value: Number(newGoal.current_value) || 0,
        success_definition: newGoal.success_definition || null,
        period_type: 'monthly',
        period_start: start,
        period_end: end,
        priority: 1,
        status: 'active',
      });
      setNewGoal({ goal_type: 'new_schools', target_value: 0, current_value: 0, success_definition: '' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">עדכון יעדים חודשיים</DialogTitle>
        </DialogHeader>

        {/* Existing goals */}
        <div className="space-y-3">
          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">אין יעדים פעילים. הוסיפו יעד ראשון למטה.</p>
          )}
          {goals.map((g) => (
            <div key={g.id} className="flex items-center gap-2 border rounded-lg p-2">
              <span className="flex-1 text-sm font-medium">{goalLabel(g.goal_type)}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  defaultValue={g.current_value}
                  onBlur={(e) => updateField(g, 'current_value', Number(e.target.value))}
                  className="w-16 h-8 text-center"
                  aria-label="ערך נוכחי"
                />
                <span className="text-muted-foreground">/</span>
                <Input
                  type="number"
                  defaultValue={g.target_value}
                  onBlur={(e) => updateField(g, 'target_value', Number(e.target.value))}
                  className="w-16 h-8 text-center"
                  aria-label="יעד"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(g.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add new goal */}
        <div className="border-t pt-3 mt-1 space-y-2">
          <Label className="text-sm">הוספת יעד</Label>
          <div className="flex items-center gap-2">
            <Select value={newGoal.goal_type} onValueChange={(v) => setNewGoal({ ...newGoal, goal_type: v })}>
              <SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="number" placeholder="נוכחי" value={newGoal.current_value || ''}
              onChange={(e) => setNewGoal({ ...newGoal, current_value: Number(e.target.value) })}
              className="w-16 h-9 text-center"
            />
            <span className="text-muted-foreground">/</span>
            <Input
              type="number" placeholder="יעד" value={newGoal.target_value || ''}
              onChange={(e) => setNewGoal({ ...newGoal, target_value: Number(e.target.value) })}
              className="w-16 h-9 text-center"
            />
          </div>
          <Input
            placeholder="מה נחשב הצלחה? (אופציונלי)"
            value={newGoal.success_definition}
            onChange={(e) => setNewGoal({ ...newGoal, success_definition: e.target.value })}
            className="h-9"
          />
          <Button onClick={addGoal} disabled={savingId === 'new'} className="w-full" variant="secondary">
            <Plus className="h-4 w-4 ml-1" /> הוסף יעד
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
