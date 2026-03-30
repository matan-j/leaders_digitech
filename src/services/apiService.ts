/**
 * API Service
 * Centralized service for all Supabase database operations
 * Organized by entity/table for better maintainability
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// COURSES
// ============================================================================

/**
 * Fetches all visible course templates
 */
export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, created_at, school_type, presentation_link, program_link, is_visible")
    .eq("is_visible", true);

  if (error) {
    console.error("fetchCourses error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches visible courses with pagination
 */
export async function fetchCoursesWithPagination(start: number, end: number) {
  const { data, error, count } = await supabase
    .from("courses")
    .select(`
      id,
      name,
      school_type,
      presentation_link,
      program_link,
      created_at,
      color,
      is_visible
    `, { count: 'exact' })
    .eq("is_visible", true)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) {
    console.error("fetchCoursesWithPagination error:", error.message);
    return { data: [], count: 0 };
  }
  return { data: data || [], count: count || 0 };
}

/**
 * Hides a course (soft delete) by setting is_visible = false
 * Also hides all related course instances
 */
export async function hideCourse(courseId: string) {
  // First, hide all related course instances
  const { error: instancesError } = await supabase
    .from("course_instances")
    .update({ is_visible: false })
    .eq("course_id", courseId);

  if (instancesError) {
    console.error("hideCourse - hiding instances error:", instancesError.message);
    throw instancesError;
  }

  // Then hide the course itself
  const { error } = await supabase
    .from("courses")
    .update({ is_visible: false })
    .eq("id", courseId);

  if (error) {
    console.error("hideCourse error:", error.message);
    throw error;
  }
}

/**
 * Hides a single course instance (soft delete) by setting is_visible = false
 */
export async function hideCourseInstance(instanceId: string) {
  const { error } = await supabase
    .from("course_instances")
    .update({ is_visible: false })
    .eq("id", instanceId);

  if (error) {
    console.error("hideCourseInstance error:", error.message);
    throw error;
  }
}

/**
 * @deprecated Use hideCourse instead for soft delete
 * Deletes a course template and its dependencies (hard delete)
 */
export async function deleteCourseTemplate(courseId: string) {
  const { error } = await supabase.rpc("delete_course_template", {
    p_course_id: courseId,
  });

  if (error) {
    console.error("deleteCourseTemplate error:", error.message);
    throw error;
  }
}

// ============================================================================
// COURSE INSTANCES
// ============================================================================

/**
 * Fetches all visible course instances
 * Also filters by parent course visibility
 */
export async function fetchCourseInstances() {
  const { data, error } = await supabase
    .from("course_instances")
    .select("*, courses!inner(is_visible)")
    .eq("is_visible", true)
    .eq("courses.is_visible", true);

  if (error) {
    console.error("fetchCourseInstances error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Checks for ALL course assignments/instances by course ID (including hidden)
 * Used for warning dialogs before hiding a course
 */
export async function checkCourseAssignments(courseId: string) {
  const { data, error } = await supabase
    .from("course_instances")
    .select(`
      id,
      is_visible,
      educational_institutions (name),
      profiles (full_name)
    `)
    .eq("course_id", courseId)
    .eq("is_visible", true); // Only show visible assignments in warning

  if (error) {
    console.error("checkCourseAssignments error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Deletes lessons for a course instance
 */
export async function deleteLessonsByCourseInstance(courseInstanceId: string) {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('course_instance_id', courseInstanceId);

  if (error) {
    console.error("deleteLessonsByCourseInstance error:", error.message);
    throw error;
  }
}

// ============================================================================
// LESSONS
// ============================================================================

/**
 * Fetches lessons by course IDs using RPC
 */
export async function fetchLessonsByCourses(courseIds: string[]) {
  const { data, error } = await supabase.rpc(
    "get_lessons_by_courses",
    { course_ids: courseIds }
  );

  if (error) {
    console.error("fetchLessonsByCourses error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches lessons by course IDs (direct query)
 */
export async function fetchLessonsForCourses(courseIds: string[]) {
  if (!courseIds.length) return [];

  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .in("course_id", courseIds)
    .order("order_index");

  if (error) {
    console.error("fetchLessonsForCourses error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches lessons with course instance info
 */
export async function fetchLessonsWithInstanceInfo() {
  const { data, error } = await supabase
    .from("lessons")
    .select("*, course_instance_id");

  if (error) {
    console.error("fetchLessonsWithInstanceInfo error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches a single lesson by ID
 */
export async function fetchLessonById(lessonId: string) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (error) {
    console.error("fetchLessonById error:", error.message);
    throw error;
  }
  return data;
}

/**
 * Fetches lesson IDs by course IDs
 */
export async function fetchLessonIdsByCourses(courseIds: string[]) {
  const { data, error } = await supabase
    .from("lessons")
    .select("id")
    .in("course_id", courseIds);

  if (error) {
    console.error("fetchLessonIdsByCourses error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Updates a lesson title
 */
export async function updateLessonTitle(lessonId: string, title: string) {
  const { error } = await supabase
    .from('lessons')
    .update({ title })
    .eq('id', lessonId);

  if (error) {
    console.error("updateLessonTitle error:", error.message);
    throw error;
  }
}

/**
 * Deletes lessons by IDs
 */
export async function deleteLessonsByIds(lessonIds: string[]) {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .in('id', lessonIds);

  if (error) {
    console.error("deleteLessonsByIds error:", error.message);
    throw error;
  }
}

// ============================================================================
// LESSON TASKS
// ============================================================================

/**
 * Fetches tasks for lesson IDs
 */
export async function fetchTasksForLessons(lessonIds: string[]) {
  if (!lessonIds.length) return [];

  const { data, error } = await supabase
    .from("lesson_tasks")
    .select("*")
    .in("lesson_id", lessonIds)
    .order("order_index");

  if (error) {
    console.error("fetchTasksForLessons error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches tasks for a single lesson
 */
export async function fetchTasksByLesson(lessonId: string) {
  const { data, error } = await supabase
    .from("lesson_tasks")
    .select("*")
    .eq("lesson_id", lessonId);

  if (error) {
    console.error("fetchTasksByLesson error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Inserts new tasks
 */
export async function insertTasks(tasks: any[]) {
  const { data, error } = await supabase
    .from('lesson_tasks')
    .insert(tasks)
    .select();

  if (error) {
    console.error("insertTasks error:", error.message);
    throw error;
  }
  return data;
}

/**
 * Inserts a single task
 */
export async function insertTask(task: any) {
  const { data, error } = await supabase
    .from('lesson_tasks')
    .insert(task)
    .select()
    .single();

  if (error) {
    console.error("insertTask error:", error.message);
    throw error;
  }
  return data;
}

/**
 * Deletes tasks by lesson IDs
 */
export async function deleteTasksByLessons(lessonIds: string[]) {
  const { error } = await supabase
    .from('lesson_tasks')
    .delete()
    .in('lesson_id', lessonIds);

  if (error) {
    console.error("deleteTasksByLessons error:", error.message);
    throw error;
  }
}

/**
 * Deletes tasks by task IDs
 */
export async function deleteTasksByIds(taskIds: string[]) {
  const { error } = await supabase
    .from('lesson_tasks')
    .delete()
    .in('id', taskIds);

  if (error) {
    console.error("deleteTasksByIds error:", error.message);
    throw error;
  }
}

// ============================================================================
// LESSON REPORTS
// ============================================================================

/**
 * Fetches lesson reports by date range
 */
export async function fetchLessonReportsByDateRange(start: Date, end: Date) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data, error } = await supabase
    .from("lesson_reports")
    .select("*")
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    console.error("fetchLessonReportsByDateRange error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Reports a work hour (RPC call)
 */
export async function reportWorkHour() {
  const { error } = await supabase.rpc('report_work_hour');

  if (error) {
    console.error("reportWorkHour error:", error.message);
    throw error;
  }
}

// ============================================================================
// LESSON FILES
// ============================================================================

/**
 * Inserts a lesson file record
 */
export async function insertLessonFile(fileData: any) {
  const { error } = await supabase
    .from("lesson_files")
    .insert(fileData);

  if (error) {
    console.error("insertLessonFile error:", error.message);
    throw error;
  }
}

// ============================================================================
// LESSON SCHEDULES
// ============================================================================

/**
 * Deletes lesson schedules by lesson IDs
 */
export async function deleteLessonSchedulesByLessons(lessonIds: string[]) {
  const { error } = await supabase
    .from('lesson_schedules')
    .delete()
    .in('lesson_id', lessonIds);

  if (error) {
    console.error("deleteLessonSchedulesByLessons error:", error.message);
    throw error;
  }
}

// ============================================================================
// PROFILES (USERS/INSTRUCTORS)
// ============================================================================

/**
 * Fetches all instructors
 */
export async function fetchInstructors() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "instructor");

  if (error) {
    console.error("fetchInstructors error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches instructors with additional details
 */
export async function fetchInstructorsDetailed() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone')
    .eq('role', 'instructor')
    .order('full_name');

  if (error) {
    console.error("fetchInstructorsDetailed error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Updates user authentication data (RPC call)
 */
export async function updateUserAuthData(params: {
  p_user_id: string;
  p_email?: string;
  p_password?: string;
}) {
  const { data, error } = await supabase.rpc('update_user_auth_data', params);

  if (error) {
    console.error("updateUserAuthData error:", error.message);
    throw error;
  }
  return data;
}

// ============================================================================
// STUDENTS
// ============================================================================

/**
 * Fetches students by course instance ID
 */
export async function fetchStudentsByCourseInstance(courseInstanceId: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('course_instance_id', courseInstanceId)
    .order('full_name');

  if (error) {
    console.error("fetchStudentsByCourseInstance error:", error.message);
    return [];
  }
  return data || [];
}

// ============================================================================
// SALES LEADS
// ============================================================================

/**
 * Fetches all sales leads with instructor details
 */
export async function fetchSalesLeads() {
  const { data, error } = await supabase
    .from('sales_leads')
    .select(`*, instructor:profiles(id, full_name, phone)`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("fetchSalesLeads error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Updates sales lead status
 */
export async function updateSalesLeadStatus(id: string, status: string) {
  const updateData: any = { status };

  // If closing the lead, set closed_at date
  if (status.startsWith('closed_')) {
    updateData.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('sales_leads')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error("updateSalesLeadStatus error:", error.message);
    throw error;
  }
}

/**
 * Updates sales lead potential value
 */
export async function updateSalesLeadValue(id: string, potentialValue: number) {
  const { error } = await supabase
    .from('sales_leads')
    .update({ potential_value: potentialValue })
    .eq('id', id);

  if (error) {
    console.error("updateSalesLeadValue error:", error.message);
    throw error;
  }
}

/**
 * Creates a new sales lead
 */
export async function createSalesLead(leadData: any) {
  const { data, error } = await supabase
    .from('sales_leads')
    .insert([leadData])
    .select('*')
    .single();

  if (error) {
    console.error("createSalesLead error:", error.message);
    throw error;
  }
  return data;
}

// ============================================================================
// EDUCATIONAL INSTITUTIONS
// ============================================================================

/**
 * Fetches all educational institutions
 */
export async function fetchInstitutions() {
  const { data, error } = await supabase
    .from('educational_institutions')
    .select('id, name, contact_person, contact_phone, address, contact_email')
    .order('name');

  if (error) {
    console.error("fetchInstitutions error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches institutions with basic info (id and name only)
 */
export async function fetchInstitutionsBasic() {
  const { data, error } = await supabase
    .from("educational_institutions")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("fetchInstitutionsBasic error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetches institutions with address data
 */
export async function fetchInstitutionsWithAddress() {
  const { data, error } = await supabase
    .from('educational_institutions')
    .select('name, address')
    .order('name');

  if (error) {
    console.error("fetchInstitutionsWithAddress error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Finds an institution by name
 */
export async function findInstitutionByName(name: string) {
  const { data, error } = await supabase
    .from('educational_institutions')
    .select('id, name')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.error("findInstitutionByName error:", error.message);
  }
  return data || null;
}

/**
 * Creates a new institution
 */
export async function createInstitution(institutionData: {
  name: string;
  address?: string | null;
  contact_email?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
}) {
  const { data, error } = await supabase
    .from('educational_institutions')
    .insert([institutionData])
    .select('id, name')
    .single();

  if (error) {
    console.error("createInstitution error:", error.message);
    throw error;
  }
  return data;
}