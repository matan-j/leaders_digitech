import { describe, it, expect } from 'vitest';
import { applyUndo, applyUndoToAll, type UndoSchedule } from './undoPostpone';

const makeSchedule = (id: string, start: string, originalStart?: string): UndoSchedule => ({
  id,
  scheduled_start: start,
  scheduled_end: new Date(new Date(start).getTime() + 45 * 60000).toISOString(),
  original_scheduled_start: originalStart ?? null,
  original_scheduled_end: originalStart
    ? new Date(new Date(originalStart).getTime() + 45 * 60000).toISOString()
    : null,
});

describe('applyUndo', () => {
  it('restores a lesson back exactly 7 days', () => {
    const originalStart = '2024-01-08T09:00:00Z';
    const postponedStart = '2024-01-15T09:00:00Z';
    const schedule = makeSchedule('s1', postponedStart, originalStart);
    const result = applyUndo(schedule);
    expect(result.scheduled_start).toBe(originalStart);
    const diffMs = new Date(postponedStart).getTime() - new Date(result.scheduled_start).getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('clears original_scheduled_start and original_scheduled_end after undo', () => {
    const schedule = makeSchedule('s1', '2024-01-15T09:00:00Z', '2024-01-08T09:00:00Z');
    const result = applyUndo(schedule);
    expect(result.original_scheduled_start).toBeNull();
    expect(result.original_scheduled_end).toBeNull();
  });

  it('does not modify a schedule with no original_scheduled_start', () => {
    const schedule = makeSchedule('s1', '2024-01-15T09:00:00Z');
    const result = applyUndo(schedule);
    expect(result).toEqual(schedule);
    expect(result.scheduled_start).toBe('2024-01-15T09:00:00Z');
  });
});

describe('applyUndoToAll', () => {
  it('restores primary and all subsequent schedules', () => {
    const primary = makeSchedule('s1', '2024-01-15T09:00:00Z', '2024-01-08T09:00:00Z');
    const sub1    = makeSchedule('s2', '2024-01-22T09:00:00Z', '2024-01-15T09:00:00Z');
    const sub2    = makeSchedule('s3', '2024-01-29T09:00:00Z', '2024-01-22T09:00:00Z');
    const { primary: p, subsequents: subs } = applyUndoToAll(primary, [sub1, sub2]);
    expect(p.scheduled_start).toBe('2024-01-08T09:00:00Z');
    expect(subs[0].scheduled_start).toBe('2024-01-15T09:00:00Z');
    expect(subs[1].scheduled_start).toBe('2024-01-22T09:00:00Z');
  });

  it('subsequent schedules also move back exactly 7 days each', () => {
    const sub = makeSchedule('s2', '2024-01-22T09:00:00Z', '2024-01-15T09:00:00Z');
    const { subsequents } = applyUndoToAll(makeSchedule('s1', '2024-01-15T09:00:00Z', '2024-01-08T09:00:00Z'), [sub]);
    const diffMs = new Date('2024-01-22T09:00:00Z').getTime() - new Date(subsequents[0].scheduled_start).getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('empty subsequent array does not crash', () => {
    const primary = makeSchedule('s1', '2024-01-15T09:00:00Z', '2024-01-08T09:00:00Z');
    expect(() => applyUndoToAll(primary, [])).not.toThrow();
    const { subsequents } = applyUndoToAll(primary, []);
    expect(subsequents).toHaveLength(0);
  });
});
