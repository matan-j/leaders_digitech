export interface TimeSlot {
  day: number;
  start_time: string;
  end_time: string;
}

export interface ClassSection {
  grade_level: string;
  days_of_week: number[];
  time_slots: TimeSlot[];
  lesson_duration_minutes: number;
  is_double_lesson: boolean;
}

export const DEFAULT_CLASS: ClassSection = {
  grade_level: '',
  days_of_week: [],
  time_slots: [],
  lesson_duration_minutes: 45,
  is_double_lesson: false,
};

export function updateClass(
  classes: ClassSection[],
  classIdx: number,
  field: keyof ClassSection,
  value: ClassSection[keyof ClassSection]
): ClassSection[] {
  return classes.map((cls, i) => (i === classIdx ? { ...cls, [field]: value } : cls));
}

export function toggleClassDayOfWeek(
  classes: ClassSection[],
  classIdx: number,
  dayIndex: number
): ClassSection[] {
  return classes.map((cls, i) => {
    if (i !== classIdx) return cls;
    if (cls.days_of_week.includes(dayIndex)) {
      return {
        ...cls,
        days_of_week: cls.days_of_week.filter(d => d !== dayIndex),
        time_slots: cls.time_slots.filter(ts => ts.day !== dayIndex),
      };
    }
    return {
      ...cls,
      days_of_week: [...cls.days_of_week, dayIndex].sort((a, b) => a - b),
      time_slots: [...cls.time_slots, { day: dayIndex, start_time: '08:00', end_time: '08:45' }],
    };
  });
}

export function updateClassTimeSlot(
  classes: ClassSection[],
  classIdx: number,
  dayIndex: number,
  field: 'start_time' | 'end_time',
  value: string
): ClassSection[] {
  return classes.map((cls, i) =>
    i !== classIdx
      ? cls
      : {
          ...cls,
          time_slots: cls.time_slots.map(ts =>
            ts.day === dayIndex ? { ...ts, [field]: value } : ts
          ),
        }
  );
}

export function addNewClass(classes: ClassSection[]): ClassSection[] {
  const first = classes[0];
  return [
    ...classes,
    {
      grade_level: '',
      days_of_week: first.days_of_week,
      time_slots: first.days_of_week.map(day => ({
        day,
        start_time: '08:00',
        end_time: '08:45',
      })),
      lesson_duration_minutes: first.lesson_duration_minutes,
      is_double_lesson: false,
    },
  ];
}

export function removeClass(classes: ClassSection[], classIdx: number): ClassSection[] {
  return classes.filter((_, i) => i !== classIdx);
}
