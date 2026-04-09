import { describe, it, expect } from 'vitest';
import { filterLessons } from './calendarFilters';

const make = (instructorId?: string, courseId?: string, institutionId?: string) => ({
  course_instances: {
    instructor: instructorId ? { id: instructorId } : null,
    course: courseId ? { id: courseId } : null,
    institution: institutionId ? { id: institutionId } : null,
  },
});

const lessons = [
  make('inst-1', 'course-A', 'school-X'),
  make('inst-2', 'course-B', 'school-Y'),
  make('inst-1', 'course-B', 'school-X'),
];

describe('filterLessons', () => {
  it('no filters (all "all") — returns all lessons', () => {
    expect(filterLessons(lessons, 'all', 'all', 'all')).toHaveLength(3);
  });

  it('filter by instructor — returns only matching lessons', () => {
    const result = filterLessons(lessons, 'inst-1', 'all', 'all');
    expect(result).toHaveLength(2);
    result.forEach(l => expect(l.course_instances?.instructor?.id).toBe('inst-1'));
  });

  it('filter by course — returns only matching lessons', () => {
    const result = filterLessons(lessons, 'all', 'course-B', 'all');
    expect(result).toHaveLength(2);
    result.forEach(l => expect(l.course_instances?.course?.id).toBe('course-B'));
  });

  it('filter by institution — returns only matching lessons', () => {
    const result = filterLessons(lessons, 'all', 'all', 'school-X');
    expect(result).toHaveLength(2);
    result.forEach(l => expect(l.course_instances?.institution?.id).toBe('school-X'));
  });

  it('combined filters (instructor + course) — returns only exact matches', () => {
    const result = filterLessons(lessons, 'inst-1', 'course-B', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].course_instances?.institution?.id).toBe('school-X');
  });

  it('no match — returns empty array', () => {
    expect(filterLessons(lessons, 'inst-99', 'all', 'all')).toHaveLength(0);
  });

  it('edge case: lesson with null course_instances — does not crash, excluded from filtered results', () => {
    const withNull = [{ course_instances: null }];
    expect(() => filterLessons(withNull, 'inst-1', 'all', 'all')).not.toThrow();
    expect(filterLessons(withNull, 'inst-1', 'all', 'all')).toHaveLength(0);
  });

  it('edge case: lesson with null course_instances passes through when all filters are "all"', () => {
    const withNull = [{ course_instances: null }];
    expect(filterLessons(withNull, 'all', 'all', 'all')).toHaveLength(1);
  });
});
