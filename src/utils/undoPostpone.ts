export interface UndoSchedule {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  original_scheduled_start?: string | null;
  original_scheduled_end?: string | null;
}

/** Restores a single schedule to its original dates. No-op if not postponed. */
export function applyUndo(schedule: UndoSchedule): UndoSchedule {
  if (!schedule.original_scheduled_start) return schedule;
  return {
    ...schedule,
    scheduled_start: schedule.original_scheduled_start,
    scheduled_end: schedule.original_scheduled_end ?? schedule.scheduled_end,
    original_scheduled_start: null,
    original_scheduled_end: null,
  };
}

/** Restores the primary postponed schedule and all chained subsequent schedules. */
export function applyUndoToAll(
  primary: UndoSchedule,
  subsequents: UndoSchedule[]
): { primary: UndoSchedule; subsequents: UndoSchedule[] } {
  return {
    primary: applyUndo(primary),
    subsequents: subsequents.map(applyUndo),
  };
}
