/**
 * Courses Helpers Service
 * Contains utility functions for processing and formatting course data
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  estimated_duration: number;
  is_mandatory: boolean;
  lesson_number: number;
  lesson_title?: string;
  order_index: number;
  scheduled_start?: string;
  scheduled_end?: string;
  lesson_id?: string;
}

export interface Lesson {
  id: string;
  title: string;
  order_index: number;
  course_id: string;
  course_instance_id?: string | null;
}

/**
 * Groups tasks by lesson number
 * @param tasks - Array of tasks
 * @returns Object with lesson numbers as keys and arrays of tasks as values
 */
export function groupTasksByLesson(tasks: Task[]): Record<number, Task[]> {
  const grouped: Record<number, Task[]> = {};

  // Group tasks by lesson number
  for (const task of tasks) {
    if (!grouped[task.lesson_number]) {
      grouped[task.lesson_number] = [];
    }
    grouped[task.lesson_number].push(task);
  }

  // Sort tasks within each lesson by order_index
  for (const lessonNumber in grouped) {
    grouped[lessonNumber].sort((a, b) => a.order_index - b.order_index);
  }

  return grouped;
}

/**
 * Formats course data for display, combining course, lessons, and tasks
 * @param course - Course template data
 * @param lessonsData - All lessons data
 * @param tasksData - All tasks data
 * @returns Formatted course object
 */
export function formatCourseData(
  course: any,
  lessonsData: Lesson[],
  tasksData: Task[]
): any {
  // Step 1: Filter and sort lessons by order_index
  const courseLessons = lessonsData
    .filter((lesson) => lesson.course_id === course.id)
    .sort((a, b) => {
      // Sort by order_index, and if they're equal then by id
      if (a.order_index !== b.order_index) {
        return a.order_index - b.order_index;
      }
      return a.id.localeCompare(b.id);
    });

  // Step 2: Create a map of lesson_id to correct lesson number
  const lessonNumberMap = new Map();
  courseLessons.forEach((lesson, index) => {
    lessonNumberMap.set(lesson.id, index + 1);
  });

  // Step 3: Build the tasks list with correct numbering
  const allCourseTasks = [];

  courseLessons.forEach((lesson) => {
    const lessonNumber = lessonNumberMap.get(lesson.id);
    const lessonTasks = tasksData
      .filter((task) => task.lesson_id === lesson.id)
      .sort((a, b) => a.order_index - b.order_index) // Sort tasks by order_index
      .map((task) => ({
        ...task,
        lesson_title: lesson.title,
        lesson_number: lessonNumber,
      }));

    allCourseTasks.push(...lessonTasks);
  });

  return {
    id: course.id,
    instance_id: null,
    name: course.name || "ללא שם קורס",
    grade_level: "לא צוין",
    max_participants: 0,
    price_per_lesson: 0,
    institution_name: "תבנית קורס",
    instructor_name: "לא הוקצה",
    lesson_count: courseLessons.length,
    start_date: null,
    approx_end_date: null,
    is_assigned: false,
    school_type: course.school_type,
    presentation_link: course.presentation_link,
    program_link: course.program_link,
    tasks: allCourseTasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      estimated_duration: task.estimated_duration,
      is_mandatory: task.is_mandatory,
      lesson_number: task.lesson_number,
      lesson_title: task.lesson_title,
      order_index: task.order_index,
    })),
  };
}
