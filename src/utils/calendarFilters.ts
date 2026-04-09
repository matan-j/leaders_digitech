export interface LessonCourseInstance {
  instructor?: { id: string } | null;
  course?: { id: string } | null;
  institution?: { id: string } | null;
}

export interface FilterableLesson {
  course_instances?: LessonCourseInstance | null;
}

export function filterLessons<T extends FilterableLesson>(
  lessons: T[],
  selectedInstructor: string,
  selectedCourse: string,
  selectedInstitution: string
): T[] {
  return lessons.filter(lesson => {
    const ci = lesson.course_instances;
    if (selectedInstructor !== 'all' && ci?.instructor?.id !== selectedInstructor) return false;
    if (selectedCourse !== 'all' && ci?.course?.id !== selectedCourse) return false;
    if (selectedInstitution !== 'all' && ci?.institution?.id !== selectedInstitution) return false;
    return true;
  });
}
