import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CLASS,
  updateClass,
  toggleClassDayOfWeek,
  updateClassTimeSlot,
  addNewClass,
  removeClass,
  type ClassSection,
} from './classUtils';

describe('classes state initialization', () => {
  it('starts with one empty class with default values', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS }];
    expect(classes).toHaveLength(1);
    expect(classes[0].grade_level).toBe('');
    expect(classes[0].days_of_week).toEqual([]);
    expect(classes[0].time_slots).toEqual([]);
    expect(classes[0].lesson_duration_minutes).toBe(45);
    expect(classes[0].is_double_lesson).toBe(false);
  });
});

describe('updateClass', () => {
  it('updates a specific field on the target class', () => {
    const classes = [{ ...DEFAULT_CLASS }, { ...DEFAULT_CLASS }];
    const result = updateClass(classes, 0, 'grade_level', 'כיתה ז');
    expect(result[0].grade_level).toBe('כיתה ז');
  });

  it('does not affect other classes', () => {
    const classes = [{ ...DEFAULT_CLASS }, { ...DEFAULT_CLASS, grade_level: 'כיתה ח' }];
    const result = updateClass(classes, 0, 'grade_level', 'כיתה ז');
    expect(result[1].grade_level).toBe('כיתה ח');
  });

  it('updates numeric fields correctly', () => {
    const classes = [{ ...DEFAULT_CLASS }];
    const result = updateClass(classes, 0, 'lesson_duration_minutes', 90);
    expect(result[0].lesson_duration_minutes).toBe(90);
  });

  it('returns a new array (does not mutate)', () => {
    const classes = [{ ...DEFAULT_CLASS }];
    const result = updateClass(classes, 0, 'grade_level', 'כיתה ז');
    expect(result).not.toBe(classes);
  });
});

describe('toggleClassDayOfWeek', () => {
  it('adds a day and creates a default time_slot', () => {
    const classes = [{ ...DEFAULT_CLASS }];
    const result = toggleClassDayOfWeek(classes, 0, 2);
    expect(result[0].days_of_week).toContain(2);
    expect(result[0].time_slots).toEqual([{ day: 2, start_time: '08:00', end_time: '08:45' }]);
  });

  it('removes a day and its time_slot', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [2, 4],
      time_slots: [
        { day: 2, start_time: '08:00', end_time: '08:45' },
        { day: 4, start_time: '09:00', end_time: '09:45' },
      ],
    }];
    const result = toggleClassDayOfWeek(classes, 0, 2);
    expect(result[0].days_of_week).toEqual([4]);
    expect(result[0].time_slots).toEqual([{ day: 4, start_time: '09:00', end_time: '09:45' }]);
  });

  it('keeps days_of_week sorted after adding a lower day index', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [4],
      time_slots: [{ day: 4, start_time: '08:00', end_time: '08:45' }],
    }];
    const result = toggleClassDayOfWeek(classes, 0, 1);
    expect(result[0].days_of_week).toEqual([1, 4]);
  });

  it('does not affect other classes', () => {
    const classes: ClassSection[] = [
      { ...DEFAULT_CLASS },
      { ...DEFAULT_CLASS, days_of_week: [3], time_slots: [{ day: 3, start_time: '08:00', end_time: '08:45' }] },
    ];
    const result = toggleClassDayOfWeek(classes, 0, 2);
    expect(result[1].days_of_week).toEqual([3]);
    expect(result[1].time_slots).toHaveLength(1);
  });
});

describe('updateClassTimeSlot', () => {
  it('updates start_time for a specific day on a specific class', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [2],
      time_slots: [{ day: 2, start_time: '08:00', end_time: '08:45' }],
    }];
    const result = updateClassTimeSlot(classes, 0, 2, 'start_time', '10:00');
    expect(result[0].time_slots[0].start_time).toBe('10:00');
    expect(result[0].time_slots[0].end_time).toBe('08:45');
  });

  it('updates end_time without affecting start_time', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [2],
      time_slots: [{ day: 2, start_time: '08:00', end_time: '08:45' }],
    }];
    const result = updateClassTimeSlot(classes, 0, 2, 'end_time', '11:30');
    expect(result[0].time_slots[0].end_time).toBe('11:30');
    expect(result[0].time_slots[0].start_time).toBe('08:00');
  });

  it('only updates the correct day slot, leaves others untouched', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [2, 4],
      time_slots: [
        { day: 2, start_time: '08:00', end_time: '08:45' },
        { day: 4, start_time: '09:00', end_time: '09:45' },
      ],
    }];
    const result = updateClassTimeSlot(classes, 0, 2, 'start_time', '10:00');
    expect(result[0].time_slots.find(ts => ts.day === 4)?.start_time).toBe('09:00');
  });

  it('does not affect other classes', () => {
    const classes: ClassSection[] = [
      { ...DEFAULT_CLASS, days_of_week: [2], time_slots: [{ day: 2, start_time: '08:00', end_time: '08:45' }] },
      { ...DEFAULT_CLASS, days_of_week: [2], time_slots: [{ day: 2, start_time: '09:00', end_time: '09:45' }] },
    ];
    const result = updateClassTimeSlot(classes, 0, 2, 'start_time', '10:00');
    expect(result[1].time_slots[0].start_time).toBe('09:00');
  });
});

describe('addNewClass', () => {
  it('pre-fills days_of_week from the first class', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [1, 3],
      time_slots: [
        { day: 1, start_time: '09:00', end_time: '09:45' },
        { day: 3, start_time: '09:00', end_time: '09:45' },
      ],
    }];
    const result = addNewClass(classes);
    expect(result[1].days_of_week).toEqual([1, 3]);
  });

  it('pre-fills lesson_duration_minutes from the first class', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS, lesson_duration_minutes: 60 }];
    const result = addNewClass(classes);
    expect(result[1].lesson_duration_minutes).toBe(60);
  });

  it('initializes time_slots for all pre-filled days with 08:00–08:45 defaults', () => {
    const classes: ClassSection[] = [{
      ...DEFAULT_CLASS,
      days_of_week: [1, 3],
      time_slots: [
        { day: 1, start_time: '09:00', end_time: '09:45' },
        { day: 3, start_time: '10:00', end_time: '10:45' },
      ],
    }];
    const result = addNewClass(classes);
    expect(result[1].time_slots).toEqual([
      { day: 1, start_time: '08:00', end_time: '08:45' },
      { day: 3, start_time: '08:00', end_time: '08:45' },
    ]);
  });

  it('new class starts with empty grade_level', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS, grade_level: 'כיתה ז' }];
    const result = addNewClass(classes);
    expect(result[1].grade_level).toBe('');
  });

  it('new class starts with is_double_lesson false regardless of first class', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS, is_double_lesson: true }];
    const result = addNewClass(classes);
    expect(result[1].is_double_lesson).toBe(false);
  });

  it('appends without modifying existing classes', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS, grade_level: 'כיתה א' }];
    const result = addNewClass(classes);
    expect(result).toHaveLength(2);
    expect(result[0].grade_level).toBe('כיתה א');
  });

  it('edge case: first class has no days — new class has empty days_of_week and time_slots', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS }];
    const result = addNewClass(classes);
    expect(result[1].days_of_week).toEqual([]);
    expect(result[1].time_slots).toEqual([]);
  });
});

describe('removeClass', () => {
  it('removes the correct class by index', () => {
    const classes: ClassSection[] = [
      { ...DEFAULT_CLASS, grade_level: 'א' },
      { ...DEFAULT_CLASS, grade_level: 'ב' },
      { ...DEFAULT_CLASS, grade_level: 'ג' },
    ];
    const result = removeClass(classes, 1);
    expect(result).toHaveLength(2);
    expect(result[0].grade_level).toBe('א');
    expect(result[1].grade_level).toBe('ג');
  });

  it('leaves other classes unaffected', () => {
    const classes: ClassSection[] = [
      { ...DEFAULT_CLASS, grade_level: 'א' },
      { ...DEFAULT_CLASS, grade_level: 'ב' },
    ];
    const result = removeClass(classes, 0);
    expect(result[0].grade_level).toBe('ב');
  });

  it('returns a new array (does not mutate)', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS }, { ...DEFAULT_CLASS }];
    const result = removeClass(classes, 0);
    expect(result).not.toBe(classes);
  });
});

describe('grade_level validation edge cases', () => {
  it('allows empty grade_level without crashing', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS }];
    expect(() => updateClass(classes, 0, 'grade_level', '')).not.toThrow();
    const result = updateClass(classes, 0, 'grade_level', '');
    expect(result[0].grade_level).toBe('');
  });

  it('saves non-empty grade_level correctly', () => {
    const classes: ClassSection[] = [{ ...DEFAULT_CLASS }];
    const result = updateClass(classes, 0, 'grade_level', "כיתה ז'");
    expect(result[0].grade_level).toBe("כיתה ז'");
  });
});
