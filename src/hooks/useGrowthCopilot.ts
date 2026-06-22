import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// NOTE: the growth_* / ceo_goals / ai_preferences tables are not yet in the
// generated Supabase types (regenerate types.ts after the migration is applied).
// Until then we use a loosely-typed client for these tables only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type MissionStatus = 'generated' | 'started' | 'blocked' | 'needs_followup' | 'done';

export interface GrowthMission {
  id: string;
  run_date: string;
  entity: string;
  goal_id: string | null;
  task_id: string | null;
  mission_title: string;
  why_it_matters: string | null;
  what_to_do: string | null;
  how_to_do_it: string | null;
  ready_message: string | null;
  system_update: string | null;
  success_criteria: string | null;
  impact_score: number | null;
  status: MissionStatus;
  outcome_notes: string | null;
}

export interface CeoGoal {
  id: string;
  entity: string;
  period_type: 'monthly' | 'weekly';
  period_start: string;
  period_end: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  priority: number;
  success_definition: string | null;
  notes: string | null;
  status: 'active' | 'done' | 'archived';
}

// UI button → (mission status, task status)
const STATUS_MAP: Record<string, { mission: MissionStatus; task: string }> = {
  started: { mission: 'started', task: 'in_progress' },
  done: { mission: 'done', task: 'done' },
  blocked: { mission: 'blocked', task: 'blocked' },
  needs_followup: { mission: 'needs_followup', task: 'todo' },
};

function israelToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function useGrowthCopilot(entity = 'Digitech') {
  const [mission, setMission] = useState<GrowthMission | null>(null);
  const [goals, setGoals] = useState<CeoGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMission = useCallback(async () => {
    const { data } = await db
      .from('growth_mission_runs')
      .select('*')
      .eq('run_date', israelToday())
      .eq('entity', entity)
      .maybeSingle();
    setMission((data as GrowthMission) ?? null);
  }, [entity]);

  const loadGoals = useCallback(async () => {
    const { data } = await db
      .from('ceo_goals')
      .select('*')
      .eq('entity', entity)
      .eq('status', 'active')
      .order('priority', { ascending: true });
    setGoals((data as CeoGoal[]) ?? []);
  }, [entity]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadMission(), loadGoals()]);
    } finally {
      setLoading(false);
    }
  }, [loadMission, loadGoals]);

  useEffect(() => { refresh(); }, [refresh]);

  // Manually generate today's mission via the edge function.
  const generateNow = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/growth-copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ action: 'generate_mission', entity, force: true, send_telegram: true }),
        },
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'generation_failed');
      await loadMission();
      return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setGenerating(false);
    }
  }, [entity, loadMission]);

  // Update mission status from the UI buttons → both growth_mission_runs and the linked task.
  const updateStatus = useCallback(async (uiStatus: keyof typeof STATUS_MAP) => {
    if (!mission) return;
    const map = STATUS_MAP[uiStatus];
    if (!map) return;
    // optimistic
    setMission({ ...mission, status: map.mission });
    await db.from('growth_mission_runs').update({ status: map.mission }).eq('id', mission.id);
    if (mission.task_id) {
      await db.from('tasks').update({ status: map.task }).eq('id', mission.task_id);
    }
    await loadMission();
  }, [mission, loadMission]);

  const saveGoal = useCallback(async (goal: Partial<CeoGoal>) => {
    const payload = { entity, ...goal };
    if (goal.id) {
      await db.from('ceo_goals').update(payload).eq('id', goal.id);
    } else {
      await db.from('ceo_goals').insert(payload);
    }
    await loadGoals();
  }, [entity, loadGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    await db.from('ceo_goals').update({ status: 'archived' }).eq('id', id);
    await loadGoals();
  }, [loadGoals]);

  return {
    mission, goals, loading, generating, error,
    generateNow, updateStatus, saveGoal, deleteGoal, refresh,
  };
}
