import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, Copy, Check, Target, Loader2 } from 'lucide-react';
import { useGrowthCopilot } from '@/hooks/useGrowthCopilot';
import UpdateGoalsModal from './UpdateGoalsModal';

const GOAL_LABELS: Record<string, string> = {
  new_schools: 'בתי ספר',
  organizations: 'ארגונים',
  peak_days: 'ימי שיא',
  newsletters: 'ניוזלטרים',
  opportunities: 'הזדמנויות',
  revenue: 'הכנסות',
};
const goalLabel = (t: string) => GOAL_LABELS[t] ?? t;

// UI status buttons (Hebrew labels, English status keys)
const STATUS_BUTTONS: { key: 'started' | 'done' | 'blocked' | 'needs_followup'; label: string }[] = [
  { key: 'done', label: 'בוצע' },
  { key: 'started', label: 'התחלתי' },
  { key: 'blocked', label: 'חסום' },
  { key: 'needs_followup', label: 'צריך המשך' },
];

export default function GrowthMissionWidget({ entity = 'Digitech' }: { entity?: string }) {
  const { mission, goals, loading, generating, error, generateNow, updateStatus, saveGoal, deleteGoal } =
    useGrowthCopilot(entity);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyReady = async () => {
    if (!mission?.ready_message) return;
    await navigator.clipboard.writeText(mission.ready_message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card dir="rtl" className="border-violet-200 shadow-brand-md">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-violet-900">
            <Brain className="h-5 w-5 text-violet-600" />
            משימת הצמיחה של היום
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setGoalsOpen(true)}>
            <Target className="h-4 w-4 ml-1" /> עדכון יעדים
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-4">
        {/* Monthly progress */}
        {goals.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {goals.slice(0, 4).map((g) => {
              const pct = g.target_value > 0 ? Math.min(100, (g.current_value / g.target_value) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{goalLabel(g.goal_type)}</span>
                    <span className="font-semibold">{g.current_value}/{g.target_value}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}

        {/* Mission body */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin ml-2" /> טוען...
          </div>
        ) : !mission ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="text-3xl">🧠</div>
            <p className="text-sm text-muted-foreground max-w-xs">
              עדיין אין משימה להיום. צרו משימת צמיחה אסטרטגית אחת — מבוססת על היעדים ומצב ה-CRM.
            </p>
            <Button onClick={generateNow} disabled={generating} className="bg-violet-600 hover:bg-violet-700">
              {generating ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Sparkles className="h-4 w-4 ml-1" />}
              צור משימה עכשיו
            </Button>
            {error && <p className="text-xs text-destructive">שגיאה: {error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-violet-900 text-sm md:text-base">{mission.mission_title}</h3>
              {mission.impact_score != null && (
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 shrink-0">
                  אימפקט {mission.impact_score}/10
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {mission.why_it_matters && <Row label="למה זה חשוב" value={mission.why_it_matters} />}
              {mission.what_to_do && <Row label="מה עושים עכשיו" value={mission.what_to_do} />}
              {mission.how_to_do_it && <Row label="איך עושים את זה" value={mission.how_to_do_it} />}
              {mission.success_criteria && <Row label="מה נחשב הצלחה" value={mission.success_criteria} />}
            </div>

            {/* Ready-to-copy message */}
            {mission.ready_message && (
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground">הודעה מוכנה</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyReady}>
                    {copied ? <Check className="h-3.5 w-3.5 ml-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 ml-1" />}
                    {copied ? 'הועתק' : 'העתק'}
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{mission.ready_message}</p>
              </div>
            )}

            {/* Status buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {STATUS_BUTTONS.map((b) => (
                <Button
                  key={b.key}
                  size="sm"
                  variant={mission.status === b.key ? 'default' : 'outline'}
                  className={mission.status === b.key ? 'bg-violet-600 hover:bg-violet-700' : ''}
                  onClick={() => updateStatus(b.key)}
                >
                  {b.label}
                </Button>
              ))}
            </div>

            {/* Regenerate (admin convenience) */}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={generateNow} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Sparkles className="h-3.5 w-3.5 ml-1" />}
                צור מחדש
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <UpdateGoalsModal
        open={goalsOpen}
        onOpenChange={setGoalsOpen}
        goals={goals}
        onSave={saveGoal}
        onDelete={deleteGoal}
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-violet-700">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
