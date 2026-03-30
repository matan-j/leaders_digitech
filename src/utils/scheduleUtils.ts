

import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { AnyAaaaRecord } from "dns";

interface TimeSlot {
  day: number;
  start_time: string;
  end_time: string;
  first_lesson_date?: string;
  [key: string]: Json | undefined;
}

interface CourseInstanceSchedule {
  id: string;
  course_instance_id: string;
  days_of_week: number[];
  time_slots: TimeSlot[];
  total_lessons?: number;
  lesson_duration_minutes?: number;
}

interface GeneratedLessonSchedule {
  id: string;
  course_instance_id: string;
  lesson_id: string;
  scheduled_start: string;
  scheduled_end: string;
  lesson_number: number;
  course_instances?: any;
  lesson?: any;
}

// === NEW SYSTEM CONFIGURATION INTERFACES ===
export interface SystemDefaults {
  id?: string;
  default_lesson_duration: number;
  default_task_duration: number;
  default_break_duration: number;
  created_at?: string;
  updated_at?: string;
}

export interface BlockedDate {
  id: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  created_at?: string;
  created_by?: string;
}

// Cache for better performance
let systemDefaultsCache: SystemDefaults | null = null;
let blockedDatesCache: BlockedDate[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
 
export const formatDateLocal = (date: Date): string => {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
};

export const getSystemDefaults = async (forceRefresh: boolean = false): Promise<SystemDefaults> => {
  const now = Date.now();
  
  if (!forceRefresh && systemDefaultsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return systemDefaultsCache;
  }

  try {
    const { data, error } = await supabase
      .from('system_defaults')
      .select('*')
      .single();
    
    if (error && error.code === 'PGRST116') {
      const defaultValues: SystemDefaults = {
        default_lesson_duration: 45,
        default_task_duration: 15,
        default_break_duration: 10
      };
      
      const { data: newDefaults, error: insertError } = await supabase
        .from('system_defaults')
        .insert([defaultValues])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      systemDefaultsCache = newDefaults;
      cacheTimestamp = now;
      return newDefaults;
    }
    
    if (error) throw error;
    
    systemDefaultsCache = data;
    cacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Error fetching system defaults:', error);
    return {
      default_lesson_duration: 45,
      default_task_duration: 15,
      default_break_duration: 10
    };
  }
};

export const updateSystemDefaults = async (defaults: Partial<SystemDefaults>): Promise<boolean> => {
  try {
    const current = await getSystemDefaults();
    const { error } = await supabase
      .from('system_defaults')
      .update({
        ...defaults,
        updated_at: new Date().toISOString()
      })
      .eq('id', current.id);
    
    if (error) throw error;
    
    systemDefaultsCache = null;
    return true;
  } catch (error) {
    console.error('Error updating system defaults:', error);
    return false;
  }
};

export const getBlockedDates = async (forceRefresh: boolean = false): Promise<BlockedDate[]> => {
  const now = Date.now();

  if (!forceRefresh && blockedDatesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[getBlockedDates] Returning cached blocked dates:', blockedDatesCache);
    return blockedDatesCache;
  }

  try {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getBlockedDates] Error from Supabase:', error);
      throw error;
    }

    console.log('[getBlockedDates] Fetched from DB - count:', data?.length || 0, 'data:', data);

    blockedDatesCache = data || [];
    cacheTimestamp = now;
    return data || [];
  } catch (error) {
    console.error('[getBlockedDates] CRITICAL ERROR fetching blocked dates:', error);
    console.error('[getBlockedDates] Error details:', JSON.stringify(error, null, 2));
    return [];
  }
};

export const isDateBlocked = async (targetDate: Date | string): Promise<boolean> => {
  const blockedDates = await getBlockedDates();
  const targetDateStr = typeof targetDate === 'string' 
    ? targetDate 
    : targetDate.toISOString().split('T')[0];
  
  return blockedDates.some(blockedDate => {
    if (blockedDate.date) {
      return blockedDate.date === targetDateStr;
    }
    
    if (blockedDate.start_date && blockedDate.end_date) {
      return targetDateStr >= blockedDate.start_date && targetDateStr <= blockedDate.end_date;
    }
    
    return false;
  });
};

export const getDisabledDatesForCalendar = async (additionalDisabledDates?: Date[]): Promise<Date[]> => {
  const blockedDates = await getBlockedDates();
  const disabledDates: Date[] = [...(additionalDisabledDates || [])];
  
  blockedDates.forEach(blockedDate => {
    if (blockedDate.date) {
      disabledDates.push(new Date(blockedDate.date));
    } else if (blockedDate.start_date && blockedDate.end_date) {
      const start = new Date(blockedDate.start_date);
      const end = new Date(blockedDate.end_date);
      const current = new Date(start);
      
      while (current <= end) {
        disabledDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
  });
  
  return disabledDates;
};

export const clearSystemCache = (): void => {
  systemDefaultsCache = null;
  blockedDatesCache = null;
  cacheTimestamp = 0;
};

/**
 * Enhanced version that doesn't exclude reported lessons from generation
 * Only excludes lessons that have actual saved schedules
 */
export const generateLessonSchedulesFromPattern = async (
  courseInstanceSchedule: CourseInstanceSchedule,
  lessons: any[],
  courseStartDate: string,
  courseEndDate?: string
): Promise<GeneratedLessonSchedule[]> => {
  const generatedSchedules: GeneratedLessonSchedule[] = [];
  let { days_of_week, time_slots, total_lessons, course_instance_id } = courseInstanceSchedule;

  // *** FIX: Normalize days_of_week and time_slots to ensure they're numbers ***
  // Database stores as text[] but code expects numbers for comparison
  days_of_week = (days_of_week || []).map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day);
  time_slots = (time_slots || []).map((ts: any) => ({
    ...ts,
    day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
  }));
  
  if (!days_of_week.length || !time_slots.length || !lessons.length) {
    return generatedSchedules;
  }

  // בדיקת שיעורים מדווחים
  const { data: existingReports } = await supabase
    .from('reported_lesson_instances')
    .select('lesson_id, lesson_number, scheduled_date')
    .eq('course_instance_id', course_instance_id)
    .order('lesson_number', { ascending: true });

  // יצירת מפה של שיעורים מדווחים
  const reportedLessonsMap = new Map();
  const reportedLessonIds = new Set();
  
  existingReports?.forEach(report => {
    reportedLessonIds.add(report.lesson_id);
    reportedLessonsMap.set(report.lesson_id, {
      lesson_number: report.lesson_number,
      scheduled_date: report.scheduled_date
    });
  });
  
  // אין צורך לסנן שיעורים - כולם מקבלים תזמון
  // שיעורים מדווחים יקבלו את אותו תזמון בדיוק
  const unscheduledLessons = lessons;

  // Fetch blocked dates once before the loop to prevent N+1 queries
  const blockedDates = await getBlockedDates();
  const blockedDateSet = new Set<string>();
  blockedDates.forEach(blockedDate => {
    if (blockedDate.date) {
      blockedDateSet.add(blockedDate.date);
    } else if (blockedDate.start_date && blockedDate.end_date) {
      // Expand date ranges into individual dates
      const start = new Date(blockedDate.start_date);
      const end = new Date(blockedDate.end_date);
      const current = new Date(start);
      while (current <= end) {
        blockedDateSet.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
  });

  // Helper function to check if a date is blocked (synchronous, no await needed)
  const isDateBlockedSync = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDateSet.has(dateStr);
  };

  // מציאת התאריך ההתחלתי לתזמון
  let currentDate = new Date(courseStartDate);

  // מצא את היום הראשון המתאים בפטרן
  // Add iteration limit to prevent infinite loop
  let attempts = 0;
  while (!days_of_week.includes(currentDate.getDay()) && attempts < 7) {
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

  const endDateTime = courseEndDate ? new Date(courseEndDate) : null;
  const maxLessons = total_lessons || lessons.length;
  
  let lessonIndex = 0;
  let lessonNumber = 1;
  const sortedDays = [...days_of_week].sort();
  
  console.log('🔍 CRITICAL DEBUG:');
  console.log('  courseStartDate:', courseStartDate);
  console.log('  courseEndDate:', courseEndDate);
  console.log('  currentDate (initial):', currentDate.toISOString());
  console.log('  days_of_week:', days_of_week);
  console.log('  time_slots:', JSON.stringify(time_slots, null, 2));
  console.log('  lessons.length:', lessons.length);

  // יצירת תזמון לכל השיעורים
  while (lessonIndex < lessons.length && lessonNumber <= maxLessons) {
    const dayOfWeek = currentDate.getDay();
    
    if (lessonIndex === 0) { // רק בפעם הראשונה
      console.log('🔍 DEBUG - First iteration:');
      console.log('  days_of_week:', days_of_week);
      console.log('  sortedDays:', sortedDays);
      console.log('  time_slots:', time_slots);
      console.log('  currentDate:', currentDate.toISOString());
      console.log('  dayOfWeek:', dayOfWeek);
      console.log('  lessons.length:', lessons.length);
      console.log('  endDateTime:', endDateTime?.toISOString());
    }

    if (sortedDays.includes(dayOfWeek)) {
      const timeSlot = time_slots.find(ts => ts.day === dayOfWeek);
      
      if (timeSlot && timeSlot.start_time && timeSlot.end_time) {
        // Use synchronous check - no await needed, much faster!
        const isBlocked = isDateBlockedSync(currentDate);

        if (!isBlocked) {
          if (endDateTime && currentDate > endDateTime) {
            break;
          }

          const dateStr = currentDate.toISOString().split('T')[0];
          const scheduledStart = `${dateStr}T${timeSlot.start_time}:00`;
          const scheduledEnd = `${dateStr}T${timeSlot.end_time}:00`;
          
          const currentLesson = lessons[lessonIndex];
          
          // בדוק אם השיעור כבר דווח
          const reportedInfo = reportedLessonsMap.get(currentLesson.id);
          const isReported = reportedLessonIds.has(currentLesson.id);
          
          generatedSchedules.push({
            id: `generated-${course_instance_id}-${lessonNumber}`,
            course_instance_id: course_instance_id,
            lesson_id: currentLesson.id,
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            lesson_number: lessonNumber,
            lesson: currentLesson,
            is_reported: isReported // סימון אם השיעור דווח
          });

          lessonIndex++;
          lessonNumber++;
        } else {
          console.log(`Skipping blocked date: ${currentDate.toISOString().split('T')[0]}`);
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
    
    if (currentDate.getTime() - new Date(courseStartDate).getTime() > 365 * 24 * 60 * 60 * 1000) {
      console.warn('Schedule generation stopped: exceeded 1 year from start date');
      break;
    }
  }

  console.log(`Generated ${generatedSchedules.length} schedules (including reported lessons)`);
  return generatedSchedules;
};

// export const fetchAndGenerateSchedules = async (
//   courseInstanceId?: string
// ): Promise<GeneratedLessonSchedule[]> => {
//   try {
//     let query = supabase
//       .from('course_instance_schedules')
//       .select(`
//         *,
//         course_instances:course_instance_id (
//           id,
//           course_id,
//           start_date,
//           end_date,
//           grade_level,
//           course:course_id (
//             id,
//             name
//           ),
//           institution:institution_id (
//             id,
//             name
//           ),
//           instructor:instructor_id (
//             id,
//             full_name
//           )
//         )
//       `);

//     if (courseInstanceId) {
//       query = query.eq('course_instance_id', courseInstanceId);
//     }

//     const { data: schedules, error: schedulesError } = await query;

//     if (schedulesError) {
//       console.error('Error fetching course instance schedules:', schedulesError);
//       return [];
//     }

//     if (!schedules || schedules.length === 0) {
//       return [];
//     }

//     const allGeneratedSchedules: GeneratedLessonSchedule[] = [];

//     for (const schedule of schedules) {
//       if (!schedule.course_instances) continue;

//       // const { data: lessons, error: lessonsError } = await supabase
//       //   .from('lessons')
//       //   .select('id, title, course_id, order_index')
//       //   .eq('course_id', schedule.course_instances.course_id)
//       //   .order('order_index');
//       const { data: lessons, error: lessonsError } = await supabase
//         .from('lessons')
//         .select('id, title, course_id, order_index, course_instance_id')
//         .eq('course_id', schedule.course_instances.course_id)
//         .or(`course_instance_id.is.null,course_instance_id.eq.${schedule.course_instance_id}`)
//         .order('order_index');
//       if (lessonsError) {
//         console.error('Error fetching lessons:', lessonsError);
//         continue;
//       }

//       if (!lessons || lessons.length === 0) {
//         continue;
//       }

//       const generatedSchedules = await generateLessonSchedulesFromPattern(
//         {
//           id: schedule.id,
//           course_instance_id: schedule.course_instance_id,
//           days_of_week: schedule.days_of_week,
//           time_slots: schedule.time_slots as TimeSlot[],
//           total_lessons: schedule.total_lessons,
//           lesson_duration_minutes: schedule.lesson_duration_minutes,
//         },
//         lessons,
//         schedule.course_instances.start_date,
//         schedule.course_instances.end_date
//       );

//       const schedulesWithCourseData = generatedSchedules.map(genSchedule => ({
//         ...genSchedule,
//         course_instances: schedule.course_instances,
//       }));

//       allGeneratedSchedules.push(...schedulesWithCourseData);
//     }

//     console.log(`Generated ${allGeneratedSchedules.length} total schedules`);
//     return allGeneratedSchedules;
//   } catch (error) {
//     console.error('Error in fetchAndGenerateSchedules:', error);
//     return [];
//   }
// };



export const fetchAndGenerateSchedules = async (
  courseInstanceIds?: string | string[],
  includeHidden: boolean = false
): Promise<GeneratedLessonSchedule[]> => {
  try {
    let query = supabase
      .from('course_instance_schedules')
      .select(`
        *,
        course_instances:course_instance_id${includeHidden ? '' : '!inner'} (
          id,
          course_id,
          start_date,
          end_date,
          grade_level,
          lesson_mode,
          is_visible,
          course:course_id (
            id,
            name
          ),
          institution:institution_id (
            id,
            name
          ),
          instructor:instructor_id (
            id,
            full_name
          )
        )
      `);

    // Only filter by is_visible when not including hidden
    if (!includeHidden) {
      query = query.eq('course_instances.is_visible', true);
    }

    if (courseInstanceIds) {
      if (Array.isArray(courseInstanceIds)) {
        query = query.in('course_instance_id', courseInstanceIds);
      } else {
        query = query.eq('course_instance_id', courseInstanceIds);
      }
    }

    const { data: schedules, error: schedulesError } = await query;

    if (schedulesError) {
      console.error('Error fetching course instance schedules:', schedulesError);
      return [];
    }

    if (!schedules || schedules.length === 0) {
      return [];
    }

    const allGeneratedSchedules: GeneratedLessonSchedule[] = [];

    for (const schedule of schedules) {
      if (!schedule.course_instances) continue;

      // קבל את lesson_mode של ההקצאה (ברירת מחדל: template)
      const lessonMode = schedule.course_instances.lesson_mode || 'template';
      
      console.log(`Processing instance ${schedule.course_instance_id} with lesson_mode: ${lessonMode}`);

      // שלוף שיעורים ייחודיים
      const { data: instanceLessons, error: instanceError } = await supabase
        .from('lessons')
        .select('id, title, course_id, order_index, course_instance_id')
        .eq('course_instance_id', schedule.course_instance_id)
        .order('order_index');

      if (instanceError) {
        console.error('Error fetching instance lessons:', instanceError);
      }

      // שלוף שיעורי תבנית
      const { data: templateLessons, error: templateError } = await supabase
        .from('lessons')
        .select('id, title, course_id, order_index, course_instance_id')
        .eq('course_id', schedule.course_instances.course_id)
        .is('course_instance_id', null)
        .order('order_index');

      if (templateError) {
        console.error('Error fetching template lessons:', templateError);
      }

      let lessons: any[] = [];

      // *** החלטה לפי lesson_mode ***
      switch (lessonMode) {
        case 'custom_only':
          // רק שיעורים ייחודיים
          lessons = instanceLessons || [];
          console.log(`Using ${lessons.length} custom-only lessons`);
          break;
          
        case 'combined':
          // שני הסוגים ביחד - ממוינים לפי order_index
          const combined = [
            ...(templateLessons || []),
            ...(instanceLessons || [])
          ].sort((a, b) => a.order_index - b.order_index);
          lessons = combined;
          console.log(`Using ${templateLessons?.length || 0} template + ${instanceLessons?.length || 0} custom lessons (total: ${combined.length})`);
          break;
          
        case 'template':
        default:
          // רק שיעורי תבנית (ברירת מחדל)
          lessons = templateLessons || [];
          console.log(`Using ${lessons.length} template lessons`);
          break;
      }

      if (!lessons || lessons.length === 0) {
        console.log(`No lessons found for course instance ${schedule.course_instance_id}`);
        continue;
      }

      const generatedSchedules = await generateLessonSchedulesFromPattern(
        {
          id: schedule.id,
          course_instance_id: schedule.course_instance_id,
          days_of_week: schedule.days_of_week,
          time_slots: schedule.time_slots as TimeSlot[],
          total_lessons: schedule.total_lessons,
          lesson_duration_minutes: schedule.lesson_duration_minutes,
        },
        lessons,
        schedule.course_instances.start_date,
        schedule.course_instances.end_date
      );

      const schedulesWithCourseData = generatedSchedules.map(genSchedule => ({
        ...genSchedule,
        course_instances: schedule.course_instances,
      }));

      allGeneratedSchedules.push(...schedulesWithCourseData);
    }

    console.log(`Generated ${allGeneratedSchedules.length} total schedules`);
    return allGeneratedSchedules;
  } catch (error) {
    console.error('Error in fetchAndGenerateSchedules:', error);
    return [];
  }
};
export const fetchCombinedSchedules = async (
  courseInstanceIds?: string | string[],
  includeHidden: boolean = false
): Promise<any[]> => {
  try {
    // Fetch physical schedules from database
    const physicalSchedules = await fetchPhysicalSchedules(courseInstanceIds, true);

    console.log(`[fetchCombinedSchedules] Fetched ${physicalSchedules.length} physical schedules from DB`);

    // Log sample schedule for debugging
    if (physicalSchedules.length > 0) {
      console.log('[fetchCombinedSchedules] Sample schedule:', physicalSchedules[0]);
    }

    return physicalSchedules;
  } catch (error) {
    console.error('Error in fetchCombinedSchedules:', error);
    return [];
  }
};

/**
 * Helper function - not needed in new architecture
 * @deprecated The new system doesn't use lesson_schedules table
 */
export const saveGeneratedScheduleToDatabase = async (
  courseInstanceId: string,
  lessonId: string,
  scheduledStart: string,
  scheduledEnd: string,
  lessonNumber: number
): Promise<string | null> => {
  console.warn('saveGeneratedScheduleToDatabase is deprecated - new architecture uses course_instance_schedules pattern');
  return null;
};

export const filterSchedulesByDate = (schedules: any[], targetDate: Date): any[] => {
  const targetDateStr = targetDate.toISOString().split('T')[0];
  
  return schedules.filter(schedule => {
    if (!schedule.scheduled_start) return false;
    const scheduleDate = new Date(schedule.scheduled_start).toISOString().split('T')[0];
    return scheduleDate === targetDateStr;
  });
};

export const filterSchedulesByDateRange = (
  schedules: any[],
  startDate: Date,
  endDate: Date
): any[] => {
  return schedules.filter(schedule => {
    if (!schedule.scheduled_start) return false;
    const scheduleDate = new Date(schedule.scheduled_start);
    return scheduleDate >= startDate && scheduleDate <= endDate;
  });
};

/**
 * Fetches physical schedules filtered by date range from the database
 * This is much more efficient than loading all schedules and filtering in JavaScript
 * By default, only returns schedules for visible course instances (is_visible = true)
 * Pass includeHidden: true to get ALL schedules (used by Reports/Salary pages)
 */
export const fetchSchedulesByDateRange = async (
  startDate: Date,
  endDate: Date,
  courseInstanceIds?: string | string[],
  user?: any,
  includeHidden: boolean = false
): Promise<any[]> => {
  try {

    console.log(`[fetchSchedulesByDateRange] ====== START ======`);
    console.log(`[fetchSchedulesByDateRange] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[fetchSchedulesByDateRange] Course instance IDs filter:`, courseInstanceIds);
    console.log(`[fetchSchedulesByDateRange] Include hidden: ${includeHidden}`);

let query = supabase
  .from('lesson_schedules')
  .select(`
    *,
    lesson:lesson_id (
      id,
      title,
      order_index,
      course_id,
      course_instance_id
    ),
    course_instances:course_instance_id${includeHidden ? '' : '!inner'} (
      id,
      course_id,
      start_date,
      end_date,
      grade_level,
      is_visible,
      course:course_id (
        id,
        name
      ),
      institution:institution_id (
        id,
        name
      ),
      instructor:instructor_id (
        id,
        full_name
      )
    )
  `)
  .gte('scheduled_start', startDate.toISOString())
  .lte('scheduled_start', endDate.toISOString())
  .order('scheduled_start', { ascending: true });

// Only filter by is_visible when not including hidden
if (!includeHidden) {
  query = query.eq('course_instances.is_visible', true);
}


// 🔵 אם מורה — סינון לפי instructor_id
if (user?.user_metadata.role === 'instructor') {
  query = query
    .not('course_instances', 'is', null)
    .eq('course_instances.instructor_id', user.id);
}


    if (courseInstanceIds) {
      console.log('[fetchSchedulesByDateRange] Applying course instance filter');
      if (Array.isArray(courseInstanceIds)) {
        query = query.in('course_instance_id', courseInstanceIds);
      } else {
        query = query.eq('course_instance_id', courseInstanceIds);
      }
    }

    console.log('[fetchSchedulesByDateRange] Fetching physical schedules from DB...');
    const { data: schedules, error: schedulesError } = await query;

    if (schedulesError) {
      console.error('[fetchSchedulesByDateRange] ❌ Error fetching physical schedules:', schedulesError);
      return [];
    }

    console.log(`[fetchSchedulesByDateRange] ✅ Found ${schedules?.length || 0} physical schedules`);
    if (schedules && schedules.length > 0) {
      console.log('[fetchSchedulesByDateRange] Sample schedule:', schedules);
    }

    console.log(`[fetchSchedulesByDateRange] ====== COMPLETE ======`);
    console.log(`[fetchSchedulesByDateRange] 🎯 Total physical schedules: ${schedules?.length || 0}`);
    return schedules || [];
  } catch (error) {
    console.error('[fetchSchedulesByDateRange] Error:', error);
    return [];
  }
};

/**
 * Helper function to generate schedules only within a specific date range
 */
async function generateSchedulesInDateRange(
  pattern: any,
  lessons: any[],
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  console.log(`[generateSchedulesInDateRange] --- START ---`);
  console.log(`[generateSchedulesInDateRange] Course instance: ${pattern.course_instance_id}`);
  console.log(`[generateSchedulesInDateRange] Lessons count: ${lessons.length}`);
  console.log(`[generateSchedulesInDateRange] Date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

  const generatedSchedules: any[] = [];
  let { days_of_week, time_slots, course_instance_id, course_instances } = pattern;

  // *** FIX: Normalize days_of_week to ensure it's an array of numbers ***
  // Database stores as text[] but code expects numbers for comparison
  days_of_week = (days_of_week || []).map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day);

  // *** FIX: Normalize time_slots day field to numbers as well ***
  time_slots = (time_slots || []).map((ts: any) => ({
    ...ts,
    day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
  }));

  console.log(`[generateSchedulesInDateRange] Days of week (normalized):`, days_of_week);
  console.log(`[generateSchedulesInDateRange] Time slots (normalized):`, time_slots);

  if (!days_of_week?.length || !time_slots?.length || !lessons.length) {
    console.log(`[generateSchedulesInDateRange] ⚠️ Missing required data - returning empty`);
    console.log(`[generateSchedulesInDateRange]   days_of_week: ${days_of_week?.length || 0}`);
    console.log(`[generateSchedulesInDateRange]   time_slots: ${time_slots?.length || 0}`);
    console.log(`[generateSchedulesInDateRange]   lessons: ${lessons.length}`);
    return generatedSchedules;
  }

  // Get reported lessons
  console.log(`[generateSchedulesInDateRange] Fetching reported lessons...`);
  const { data: existingReports, error: reportsError } = await supabase
    .from('reported_lesson_instances')
    .select('lesson_id, lesson_number')
    .eq('course_instance_id', course_instance_id);

  if (reportsError) {
    console.error(`[generateSchedulesInDateRange] Error fetching reports:`, reportsError);
  } else {
    console.log(`[generateSchedulesInDateRange] Found ${existingReports?.length || 0} reported lessons`);
  }

  const reportedLessonIds = new Set(existingReports?.map(r => r.lesson_id) || []);

  // Fetch blocked dates once before the loop to prevent N+1 queries
  console.log(`[generateSchedulesInDateRange] Fetching blocked dates...`);
  const blockedDates = await getBlockedDates();
  console.log(`[generateSchedulesInDateRange] Found ${blockedDates.length} blocked date entries`);

  // Create a Set of blocked date strings for fast O(1) lookup
  const blockedDateSet = new Set<string>();
  blockedDates.forEach(blockedDate => {
    if (blockedDate.date) {
      blockedDateSet.add(blockedDate.date);
    } else if (blockedDate.start_date && blockedDate.end_date) {
      // Expand date ranges into individual dates
      const start = new Date(blockedDate.start_date);
      const end = new Date(blockedDate.end_date);
      const current = new Date(start);
      while (current <= end) {
        blockedDateSet.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
  });
  console.log(`[generateSchedulesInDateRange] Total blocked dates: ${blockedDateSet.size}`);

  // Helper function to check if a date is blocked (synchronous, no await needed)
  const isDateBlockedSync = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDateSet.has(dateStr);
  };

  // Start from the course start date or the requested start date, whichever is later
  const courseStartDate = new Date(course_instances.start_date);
  console.log(`[generateSchedulesInDateRange] Course start date: ${courseStartDate.toLocaleDateString()}`);

  let currentDate = new Date(Math.max(courseStartDate.getTime(), startDate.getTime()));
  console.log(`[generateSchedulesInDateRange] Starting generation from: ${currentDate.toLocaleDateString()}`);

  // Find first matching day of week
  let searchAttempts = 0;
  while (!days_of_week.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
    searchAttempts++;
    if (currentDate > endDate) {
      console.log(`[generateSchedulesInDateRange] ⚠️ No matching day of week found before end date`);
      return generatedSchedules;
    }
    if (searchAttempts > 7) {
      console.log(`[generateSchedulesInDateRange] ⚠️ Couldn't find matching day in a week - config error?`);
      return generatedSchedules;
    }
  }

  console.log(`[generateSchedulesInDateRange] First matching day: ${currentDate.toLocaleDateString()} (day ${currentDate.getDay()})`);

  const sortedDays = [...days_of_week].sort();
  let lessonIndex = 0;
  let lessonNumber = 1;
  let daysProcessed = 0;

  // Generate schedules within the date range
  console.log(`[generateSchedulesInDateRange] Starting schedule generation loop...`);
  while (currentDate <= endDate && lessonIndex < lessons.length) {
    daysProcessed++;
    const dayOfWeek = currentDate.getDay();

    if (sortedDays.includes(dayOfWeek)) {
      const timeSlot = time_slots.find((ts: any) => ts.day === dayOfWeek);

      if (timeSlot && timeSlot.start_time && timeSlot.end_time) {
        // Use synchronous check - no await needed, much faster!
        const isBlocked = isDateBlockedSync(currentDate);

        if (!isBlocked) {
          const dateStr = currentDate.toISOString().split('T')[0];
          const scheduledStart = `${dateStr}T${timeSlot.start_time}:00`;
          const scheduledEnd = `${dateStr}T${timeSlot.end_time}:00`;

          const currentLesson = lessons[lessonIndex];
          const isReported = reportedLessonIds.has(currentLesson.id);

          const schedule = {
            id: `generated-${course_instance_id}-${lessonNumber}`,
            course_instance_id: course_instance_id,
            lesson_id: currentLesson.id,
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            lesson_number: lessonNumber,
            lesson: currentLesson,
            is_reported: isReported,
            course_instances: course_instances,
          };

          generatedSchedules.push(schedule);

          if (lessonIndex === 0) {
            console.log(`[generateSchedulesInDateRange] 📅 First schedule generated:`, {
              date: dateStr,
              time: `${timeSlot.start_time}-${timeSlot.end_time}`,
              lesson: currentLesson.title
            });
          }

          lessonIndex++;
          lessonNumber++;
        } else {
          console.log(`[generateSchedulesInDateRange]   Skipping blocked date: ${currentDate.toLocaleDateString()}`);
        }
      } else {
        console.log(`[generateSchedulesInDateRange]   No time slot for day ${dayOfWeek}`);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);

    if (daysProcessed > 365) {
      console.log(`[generateSchedulesInDateRange] ⚠️ Safety break - processed ${daysProcessed} days`);
      break;
    }
  }

  console.log(`[generateSchedulesInDateRange] --- COMPLETE ---`);
  console.log(`[generateSchedulesInDateRange] Generated ${generatedSchedules.length} schedules`);
  console.log(`[generateSchedulesInDateRange] Days processed: ${daysProcessed}`);
  console.log(`[generateSchedulesInDateRange] Lessons used: ${lessonIndex}/${lessons.length}`);

  return generatedSchedules;
}

// ============================================================================
// PHYSICAL SCHEDULES FUNCTIONALITY
// ============================================================================

/**
 * Generates and saves physical schedules to the database
 * Unlike virtual schedules, these are actual database records in lesson_schedules table
 */
export const generatePhysicalSchedulesFromPattern = async (
  courseInstanceSchedule: CourseInstanceSchedule,
  lessons: any[],
  courseStartDate: string,
  courseEndDate?: string
): Promise<any[]> => {
  try {
    const { days_of_week, time_slots, total_lessons, course_instance_id } = courseInstanceSchedule;

    // Normalize days_of_week and time_slots to ensure they're numbers
    const normalizedDays = (days_of_week || []).map((day: any) =>
      typeof day === 'string' ? parseInt(day, 10) : day
    );
    const normalizedTimeSlots = (time_slots || []).map((ts: any) => ({
      ...ts,
      day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
    }));

    if (!normalizedDays.length || !normalizedTimeSlots.length || !lessons.length) {
      console.log('Cannot generate physical schedules: missing required data');
      return [];
    }

    console.log(`[generatePhysicalSchedules] Starting generation for course instance ${course_instance_id}`);
    console.log(`[generatePhysicalSchedules] Lessons: ${lessons.length}, Total lessons: ${total_lessons}`);
    console.log(`[generatePhysicalSchedules] Days of week:`, normalizedDays);
    console.log(`[generatePhysicalSchedules] Time slots:`, normalizedTimeSlots);
    console.log(`[generatePhysicalSchedules] Start date: ${courseStartDate}, End date: ${courseEndDate || 'none'}`);

    // Fetch blocked dates once (force refresh to bypass cache)
    const blockedDates = await getBlockedDates(true); // Force refresh!
    const blockedDateSet = new Set<string>();
    blockedDates.forEach(blockedDate => {
      if (blockedDate.date) {
        blockedDateSet.add(blockedDate.date);
      } else if (blockedDate.start_date && blockedDate.end_date) {
        const start = new Date(blockedDate.start_date);
        const end = new Date(blockedDate.end_date);
        const current = new Date(start);
        while (current <= end) {
          blockedDateSet.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
    });

    console.log(`[generatePhysicalSchedules] Blocked dates (${blockedDateSet.size}):`, blockedDateSet.size > 0 ? Array.from(blockedDateSet) : 'none');
    console.log(`[generatePhysicalSchedules] Raw blocked dates from DB:`, blockedDates);

    const isDateBlockedSync = (date: Date): boolean => {
      const dateStr = date.toISOString().split('T')[0];
      return blockedDateSet.has(dateStr);
    };

    // Find first valid date
    let currentDate = new Date(courseStartDate);
    let attempts = 0;
    while (!normalizedDays.includes(currentDate.getDay()) && attempts < 7) {
      currentDate.setDate(currentDate.getDate() + 1);
      attempts++;
    }

    const endDateTime = courseEndDate ? new Date(courseEndDate) : null;
    const maxLessons = total_lessons || lessons.length;

    let lessonIndex = 0;
    let lessonNumber = 1;
    const sortedDays = [...normalizedDays].sort();
    const schedulesToInsert: any[] = [];

    // Generate schedules
    console.log(`[generatePhysicalSchedules] Starting loop - lessonIndex: ${lessonIndex}, maxLessons: ${maxLessons}`);

    while (lessonIndex < lessons.length && lessonNumber <= maxLessons) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = currentDate.toISOString().split('T')[0];

      console.log(`[generatePhysicalSchedules] Checking date ${dateStr} (day ${dayOfWeek}) - lessonIndex: ${lessonIndex}/${lessons.length}, lessonNumber: ${lessonNumber}/${maxLessons}`);

      if (sortedDays.includes(dayOfWeek)) {
        const timeSlot = normalizedTimeSlots.find(ts => ts.day === dayOfWeek);

        if (timeSlot && timeSlot.start_time && timeSlot.end_time) {
          const isBlocked = isDateBlockedSync(currentDate);

          if (!isBlocked) {
            if (endDateTime && currentDate > endDateTime) {
              console.log(`[generatePhysicalSchedules] Reached end date - breaking`);
              break;
            }

            const scheduledStart = `${dateStr}T${timeSlot.start_time}:00`;
            const scheduledEnd = `${dateStr}T${timeSlot.end_time}:00`;

            const currentLesson = lessons[lessonIndex];

            console.log(`[generatePhysicalSchedules] ✓ Creating schedule for lesson #${lessonNumber}: ${currentLesson.title} on ${dateStr}`);

            schedulesToInsert.push({
              course_instance_id: course_instance_id,
              lesson_id: currentLesson.id,
              scheduled_start: scheduledStart,
              scheduled_end: scheduledEnd,
              lesson_number: lessonNumber,
            });

            lessonIndex++;
            lessonNumber++;
          } else {
            console.log(`[generatePhysicalSchedules] ✗ Skipping blocked date: ${dateStr}`);
          }
        } else {
          console.log(`[generatePhysicalSchedules] ✗ No time slot found for day ${dayOfWeek}`);
        }
      } else {
        console.log(`[generatePhysicalSchedules] ✗ Day ${dayOfWeek} not in schedule (${sortedDays.join(',')})`);
      }

      currentDate.setDate(currentDate.getDate() + 1);

      // Safety check
      if (currentDate.getTime() - new Date(courseStartDate).getTime() > 365 * 24 * 60 * 60 * 1000) {
        console.warn('[generatePhysicalSchedules] Safety break: exceeded 1 year from start date');
        break;
      }
    }

    console.log(`[generatePhysicalSchedules] Loop ended - Final state: lessonIndex: ${lessonIndex}/${lessons.length}, lessonNumber: ${lessonNumber}/${maxLessons}`);
    console.log(`[generatePhysicalSchedules] Generated ${schedulesToInsert.length} schedules to insert`);

    if (schedulesToInsert.length < maxLessons) {
      console.warn(`[generatePhysicalSchedules] WARNING: Expected ${maxLessons} schedules but only generated ${schedulesToInsert.length}!`);
      console.warn(`[generatePhysicalSchedules] This might be due to: blocked dates, end date reached, or missing time slots`);
    }

    // Insert all schedules to database
    if (schedulesToInsert.length > 0) {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .insert(schedulesToInsert)
        .select();

      if (error) {
        console.error('[generatePhysicalSchedules] Error inserting schedules:', error);
        throw error;
      }

      console.log(`[generatePhysicalSchedules] Successfully inserted ${data?.length || 0} physical schedules`);
      return data || [];
    }

    return [];
  } catch (error) {
    console.error('[generatePhysicalSchedules] Error:', error);
    throw error;
  }
};

/**
 * Fetches physical schedules from the database
 * By default, only returns schedules for visible course instances (is_visible = true)
 * Pass includeHidden: true to get ALL schedules (used by Reports/Salary pages)
 */
export const fetchPhysicalSchedules = async (
  courseInstanceIds?: string | string[],
  includeHidden: boolean = false
): Promise<any[]> => {
  try {
    let query = supabase
      .from('lesson_schedules')
      .select(`
        *,
        lesson:lesson_id (
          id,
          title,
          order_index,
          course_id,
          course_instance_id
        ),
        course_instances:course_instance_id${includeHidden ? '' : '!inner'} (
          id,
          course_id,
          start_date,
          end_date,
          grade_level,
          is_visible,
          course:course_id (
            id,
            name
          ),
          institution:institution_id (
            id,
            name
          ),
          instructor:instructor_id (
            id,
            full_name
          )
        )
      `)
      .order('scheduled_start', { ascending: true });

    // Only filter by is_visible when not including hidden
    if (!includeHidden) {
      query = query.eq('course_instances.is_visible', true);
    }

    if (courseInstanceIds) {
      if (Array.isArray(courseInstanceIds)) {
        query = query.in('course_instance_id', courseInstanceIds);
      } else {
        query = query.eq('course_instance_id', courseInstanceIds);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[fetchPhysicalSchedules] Error:', error);
      return [];
    }

    console.log(`[fetchPhysicalSchedules] Fetched ${data?.length || 0} physical schedules`);
    return data || [];
  } catch (error) {
    console.error('[fetchPhysicalSchedules] Error:', error);
    return [];
  }
};

/**
 * Smart update function that syncs physical schedules with course instance schedule pattern
 * - Updates changed schedules
 * - Deletes removed schedules (only if no report exists)
 * - Inserts new schedules
 * - Protects schedules that have reports
 */
export const updatePhysicalSchedules = async (
  courseInstanceScheduleId: string,
  courseInstanceId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`[updatePhysicalSchedules] Starting update for course instance ${courseInstanceId}`);

    // 1. Fetch the current schedule pattern
    const { data: schedulePattern, error: patternError } = await supabase
      .from('course_instance_schedules')
      .select(`
        *,
        course_instances:course_instance_id (
          id,
          course_id,
          start_date,
          end_date,
          lesson_mode
        )
      `)
      .eq('id', courseInstanceScheduleId)
      .single();

    if (patternError || !schedulePattern) {
      console.error('[updatePhysicalSchedules] Error fetching schedule pattern:', patternError);
      return { success: false, message: 'Schedule pattern not found' };
    }

    // 2. Fetch lessons based on lesson_mode
    const lessonMode = schedulePattern.course_instances.lesson_mode || 'template';

    const { data: instanceLessons } = await supabase
      .from('lessons')
      .select('id, title, course_id, order_index, course_instance_id')
      .eq('course_instance_id', courseInstanceId)
      .order('order_index');

    const { data: templateLessons } = await supabase
      .from('lessons')
      .select('id, title, course_id, order_index, course_instance_id')
      .eq('course_id', schedulePattern.course_instances.course_id)
      .is('course_instance_id', null)
      .order('order_index');

    let lessons: any[] = [];
    switch (lessonMode) {
      case 'custom_only':
        lessons = instanceLessons || [];
        break;
      case 'combined':
        lessons = [...(templateLessons || []), ...(instanceLessons || [])]
          .sort((a, b) => a.order_index - b.order_index);
        break;
      case 'template':
      default:
        lessons = templateLessons || [];
        break;
    }

    if (!lessons || lessons.length === 0) {
      console.log('[updatePhysicalSchedules] No lessons found');
      return { success: false, message: 'No lessons found for this course' };
    }

    // 3. Fetch existing physical schedules
    const { data: existingSchedules, error: schedError } = await supabase
      .from('lesson_schedules')
      .select(`
        *,
        lesson_reports:lesson_reports(id)
      `)
      .eq('course_instance_id', courseInstanceId)

    if (schedError) {
      console.error('[updatePhysicalSchedules] Error fetching existing schedules:', schedError);
      return { success: false, message: 'Error fetching existing schedules' };
    }

    console.log(`[updatePhysicalSchedules] Found ${existingSchedules?.length || 0} existing schedules`);

    // 4. Generate new schedule structure (what it SHOULD be)
    const { days_of_week, time_slots, total_lessons } = schedulePattern;
    const normalizedDays = (days_of_week || []).map((day: any) =>
      typeof day === 'string' ? parseInt(day, 10) : day
    );
    const normalizedTimeSlots = (time_slots || []).map((ts: any) => ({
      ...ts,
      day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
    }));

    // Fetch blocked dates
    const blockedDates = await getBlockedDates();
    const blockedDateSet = new Set<string>();
    blockedDates.forEach(blockedDate => {
      if (blockedDate.date) {
        blockedDateSet.add(blockedDate.date);
      } else if (blockedDate.start_date && blockedDate.end_date) {
        const start = new Date(blockedDate.start_date);
        const end = new Date(blockedDate.end_date);
        const current = new Date(start);
        while (current <= end) {
          blockedDateSet.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
    });

    const isDateBlockedSync = (date: Date): boolean => {
      const dateStr = date.toISOString().split('T')[0];
      return blockedDateSet.has(dateStr);
    };

    // Generate the ideal schedule structure
    let currentDate = new Date(schedulePattern.course_instances.start_date);
    let attempts = 0;
    while (!normalizedDays.includes(currentDate.getDay()) && attempts < 7) {
      currentDate.setDate(currentDate.getDate() + 1);
      attempts++;
    }

    const endDateTime = schedulePattern.course_instances.end_date
      ? new Date(schedulePattern.course_instances.end_date)
      : null;
    const maxLessons = total_lessons || lessons.length;

    let lessonIndex = 0;
    let lessonNumber = 1;
    const sortedDays = [...normalizedDays].sort();
    const idealSchedules: any[] = [];

    while (lessonIndex < lessons.length && lessonNumber <= maxLessons) {
      const dayOfWeek = currentDate.getDay();

      if (sortedDays.includes(dayOfWeek)) {
        const timeSlot = normalizedTimeSlots.find(ts => ts.day === dayOfWeek);

        if (timeSlot && timeSlot.start_time && timeSlot.end_time) {
          const isBlocked = isDateBlockedSync(currentDate);

          if (!isBlocked) {
            if (endDateTime && currentDate > endDateTime) {
              break;
            }

            const dateStr = currentDate.toISOString().split('T')[0];
            const scheduledStart = `${dateStr}T${timeSlot.start_time}:00`;
            const scheduledEnd = `${dateStr}T${timeSlot.end_time}:00`;

            idealSchedules.push({
              lesson_id: lessons[lessonIndex].id,
              scheduled_start: scheduledStart,
              scheduled_end: scheduledEnd,
              lesson_number: lessonNumber,
            });

            lessonIndex++;
            lessonNumber++;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);

      if (currentDate.getTime() - new Date(schedulePattern.course_instances.start_date).getTime() > 365 * 24 * 60 * 60 * 1000) {
        break;
      }
    }

    console.log(`[updatePhysicalSchedules] Generated ${idealSchedules.length} ideal schedules`);

    // 5. Compare and sync
    const schedulesToUpdate: any[] = [];
    const schedulesToInsert: any[] = [];
    const schedulesToDelete: string[] = [];
    const protectedScheduleIds = new Set<string>();

    // Build a map of existing schedules by lesson_number
    const existingMap = new Map<number, any>();
    existingSchedules?.forEach(schedule => {
      if (schedule.lesson_number) {
        existingMap.set(schedule.lesson_number, schedule);
      }
    });

    // Check each ideal schedule
    idealSchedules.forEach(idealSched => {
      const existing = existingMap.get(idealSched.lesson_number);

      if (existing) {
        // Check if it has reports
        const hasReports = existing.lesson_reports && existing.lesson_reports.length > 0;

        if (hasReports) {
          // Protect schedules with reports - don't update
          protectedScheduleIds.add(existing.id);
          console.log(`[updatePhysicalSchedules] Protecting schedule ${existing.id} (has reports)`);
        } else {
          // Check if anything changed
          const changed =
            existing.lesson_id !== idealSched.lesson_id ||
            existing.scheduled_start !== idealSched.scheduled_start ||
            existing.scheduled_end !== idealSched.scheduled_end;

          if (changed) {
            schedulesToUpdate.push({
              id: existing.id,
              lesson_id: idealSched.lesson_id,
              scheduled_start: idealSched.scheduled_start,
              scheduled_end: idealSched.scheduled_end,
            });
          }
        }

        // Remove from map so we know it's been processed
        existingMap.delete(idealSched.lesson_number);
      } else {
        // New schedule needed
        schedulesToInsert.push({
          course_instance_id: courseInstanceId,
          lesson_id: idealSched.lesson_id,
          scheduled_start: idealSched.scheduled_start,
          scheduled_end: idealSched.scheduled_end,
          lesson_number: idealSched.lesson_number,
          is_generated: false,
        });
      }
    });

    // Remaining schedules in existingMap should be deleted (if no reports)
    existingMap.forEach((schedule) => {
      const hasReports = schedule.lesson_reports && schedule.lesson_reports.length > 0;
      if (!hasReports) {
        schedulesToDelete.push(schedule.id);
      } else {
        protectedScheduleIds.add(schedule.id);
        console.log(`[updatePhysicalSchedules] Protecting schedule ${schedule.id} from deletion (has reports)`);
      }
    });

    console.log(`[updatePhysicalSchedules] Changes needed:`);
    console.log(`  - Update: ${schedulesToUpdate.length}`);
    console.log(`  - Insert: ${schedulesToInsert.length}`);
    console.log(`  - Delete: ${schedulesToDelete.length}`);
    console.log(`  - Protected: ${protectedScheduleIds.size}`);

    // 6. Execute changes
    let updateCount = 0;
    let insertCount = 0;
    let deleteCount = 0;

    // Update existing schedules
    for (const schedule of schedulesToUpdate) {
      const { error } = await supabase
        .from('lesson_schedules')
        .update({
          lesson_id: schedule.lesson_id,
          scheduled_start: schedule.scheduled_start,
          scheduled_end: schedule.scheduled_end,
        })
        .eq('id', schedule.id);

      if (!error) updateCount++;
    }

    // Insert new schedules
    if (schedulesToInsert.length > 0) {
      const { data, error } = await supabase
        .from('lesson_schedules')
        .insert(schedulesToInsert);

      if (!error) insertCount = schedulesToInsert.length;
    }

    // Delete obsolete schedules
    if (schedulesToDelete.length > 0) {
      const { error } = await supabase
        .from('lesson_schedules')
        .delete()
        .in('id', schedulesToDelete);

      if (!error) deleteCount = schedulesToDelete.length;
    }

    const message = `Updated ${updateCount}, inserted ${insertCount}, deleted ${deleteCount} schedules. ${protectedScheduleIds.size} schedules protected.`;
    console.log(`[updatePhysicalSchedules] ${message}`);

    return { success: true, message };
  } catch (error) {
    console.error('[updatePhysicalSchedules] Error:', error);
    return { success: false, message: `Error: ${error}` };
  }
};

/**
 * Postpones a lesson schedule to the next available day based on the course pattern
 * and chains all subsequent schedules forward by one occurrence.
 *
 * @param scheduleId - The ID of the schedule to postpone
 * @param reportId - The ID of the report marking it as "not held"
 * @returns Promise with success status and message
 */
export const postponeScheduleToNextDay = async (
  scheduleId: string,
  reportId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`[postponeSchedule] Postponing schedule ${scheduleId} with report ${reportId}`);

    // 1. Fetch the original schedule with all related data
    const { data: originalSchedule, error: fetchError } = await supabase
      .from('lesson_schedules')
      .select(`
        *,
        course_instances:course_instance_id (
          id,
          start_date,
          end_date,
          course_instance_schedules (
            id,
            days_of_week,
            time_slots,
            total_lessons,
            lesson_duration_minutes
          )
        ),
        lessons:lesson_id (
          id,
          title,
          order_index
        )
      `)
      .eq('id', scheduleId)
      .single();

    if (fetchError || !originalSchedule) {
      console.error('[postponeSchedule] Error fetching schedule:', fetchError);
      return { success: false, message: 'לא נמצא תזמון' };
    }

    console.log('[postponeSchedule] Original schedule:', originalSchedule);
    console.log('[postponeSchedule] course_instances data:', originalSchedule.course_instances);

    const courseInstance = originalSchedule.course_instances;
    console.log('[postponeSchedule] courseInstance:', courseInstance);
    console.log('[postponeSchedule] course_instance_schedules array:', courseInstance?.course_instance_schedules);

    let pattern = courseInstance?.course_instance_schedules?.[0];
    console.log('[postponeSchedule] pattern from join:', pattern);

    // If pattern not found via join, try direct query
    if (!pattern || !pattern.days_of_week || !pattern.time_slots) {
      console.error('[postponeSchedule] Pattern validation failed:', {
        hasPattern: !!pattern,
        hasDaysOfWeek: !!pattern?.days_of_week,
        hasTimeSlots: !!pattern?.time_slots,
        pattern: pattern
      });

      // Try to fetch the pattern directly
      console.log('[postponeSchedule] Trying to fetch pattern directly from DB...');
      const { data: directPattern, error: directError } = await supabase
        .from('course_instance_schedules')
        .select('*')
        .eq('course_instance_id', originalSchedule.course_instance_id)
        .maybeSingle();

      console.log('[postponeSchedule] Direct pattern query result:', directPattern, 'error:', directError);

      if (directPattern && directPattern.days_of_week && directPattern.time_slots) {
        console.log('[postponeSchedule] ✅ Using direct pattern instead');
        pattern = directPattern; // Use the direct pattern
      } else {
        return { success: false, message: 'לא נמצא תבנית תזמון' };
      }
    }

    console.log('[postponeSchedule] Final pattern to use:', pattern);

    // Normalize days
    const normalizedDays = (pattern.days_of_week || []).map((day: any) =>
      typeof day === 'string' ? parseInt(day, 10) : day
    ).sort();

    const normalizedTimeSlots = (pattern.time_slots || []).map((ts: any) => ({
      ...ts,
      day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
    }));

    console.log('[postponeSchedule] Pattern days:', normalizedDays);
    console.log('[postponeSchedule] Time slots:', normalizedTimeSlots);

    // 2. Calculate next available date
    const originalDate = new Date(originalSchedule.scheduled_start);
    const originalDay = originalDate.getDay();

    let nextDate = new Date(originalDate);
    nextDate.setDate(nextDate.getDate() + 1); // Start from next day

    // Find next day that matches the pattern
    let attempts = 0;
    while (!normalizedDays.includes(nextDate.getDay()) && attempts < 14) {
      nextDate.setDate(nextDate.getDate() + 1);
      attempts++;
    }

    if (attempts >= 14) {
      return { success: false, message: 'לא נמצא יום זמין בשבועיים הקרובים' };
    }

    // Check blocked dates
    const blockedDates = await getBlockedDates(true);
    const blockedDateSet = new Set<string>();
    blockedDates.forEach(blockedDate => {
      if (blockedDate.date) {
        blockedDateSet.add(blockedDate.date);
      } else if (blockedDate.start_date && blockedDate.end_date) {
        const start = new Date(blockedDate.start_date);
        const end = new Date(blockedDate.end_date);
        const current = new Date(start);
        while (current <= end) {
          blockedDateSet.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
    });

    // Skip blocked dates
    attempts = 0;
    while (blockedDateSet.has(nextDate.toISOString().split('T')[0]) && attempts < 30) {
      nextDate.setDate(nextDate.getDate() + 1);
      // Make sure it still matches pattern
      while (!normalizedDays.includes(nextDate.getDay()) && attempts < 30) {
        nextDate.setDate(nextDate.getDate() + 1);
        attempts++;
      }
      attempts++;
    }

    // 3. Find the time slot for the new day
    const nextDayOfWeek = nextDate.getDay();
    const timeSlot = normalizedTimeSlots.find(ts => ts.day === nextDayOfWeek);

    if (!timeSlot || !timeSlot.start_time || !timeSlot.end_time) {
      return { success: false, message: 'לא נמצא slot זמן עבור היום הבא' };
    }

    // 4. Calculate new start and end times
    const [startHour, startMinute] = timeSlot.start_time.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.end_time.split(':').map(Number);

    const newStart = new Date(nextDate);
    newStart.setHours(startHour, startMinute, 0, 0);

    const newEnd = new Date(nextDate);
    newEnd.setHours(endHour, endMinute, 0, 0);

    console.log('[postponeSchedule] New schedule date:', newStart.toISOString());

    // 5. Update the existing schedule (instead of creating a duplicate)
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('lesson_schedules')
      .update({
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString()
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (updateError || !updatedSchedule) {
      console.error('[postponeSchedule] Error updating schedule:', updateError);
      return { success: false, message: 'שגיאה בעדכון תזמון' };
    }

    console.log('[postponeSchedule] Updated schedule:', updatedSchedule.id, 'to', newStart.toISOString());

    // 6. Chain all subsequent schedules (shift them forward by one day of pattern)
    // Get schedules that start at or after the NEW date (not the original date)
    const { data: subsequentSchedules, error: fetchSubError } = await supabase
      .from('lesson_schedules')
      .select('*')
      .eq('course_instance_id', originalSchedule.course_instance_id)
      .gte('scheduled_start', newStart.toISOString())
      .neq('id', scheduleId) // Exclude the schedule we just updated
      .order('scheduled_start', { ascending: true });

    if (!fetchSubError && subsequentSchedules && subsequentSchedules.length > 0) {
      console.log(`[postponeSchedule] Chaining ${subsequentSchedules.length} subsequent schedules`);

      for (const schedule of subsequentSchedules) {
        const scheduleDate = new Date(schedule.scheduled_start);
        const scheduleDayOfWeek = scheduleDate.getDay();

        // Find next pattern day
        let shiftedDate = new Date(scheduleDate);
        shiftedDate.setDate(shiftedDate.getDate() + 1);

        attempts = 0;
        while (!normalizedDays.includes(shiftedDate.getDay()) && attempts < 14) {
          shiftedDate.setDate(shiftedDate.getDate() + 1);
          attempts++;
        }

        // Skip blocked dates
        attempts = 0;
        while (blockedDateSet.has(shiftedDate.toISOString().split('T')[0]) && attempts < 30) {
          shiftedDate.setDate(shiftedDate.getDate() + 1);
          while (!normalizedDays.includes(shiftedDate.getDay()) && attempts < 30) {
            shiftedDate.setDate(shiftedDate.getDate() + 1);
            attempts++;
          }
          attempts++;
        }

        // Find time slot for shifted day
        const shiftedDayOfWeek = shiftedDate.getDay();
        const shiftedTimeSlot = normalizedTimeSlots.find(ts => ts.day === shiftedDayOfWeek);

        if (shiftedTimeSlot && shiftedTimeSlot.start_time && shiftedTimeSlot.end_time) {
          const [shiftStartHour, shiftStartMinute] = shiftedTimeSlot.start_time.split(':').map(Number);
          const [shiftEndHour, shiftEndMinute] = shiftedTimeSlot.end_time.split(':').map(Number);

          const shiftedStart = new Date(shiftedDate);
          shiftedStart.setHours(shiftStartHour, shiftStartMinute, 0, 0);

          const shiftedEnd = new Date(shiftedDate);
          shiftedEnd.setHours(shiftEndHour, shiftEndMinute, 0, 0);

          // Update the schedule
          await supabase
            .from('lesson_schedules')
            .update({
              scheduled_start: shiftedStart.toISOString(),
              scheduled_end: shiftedEnd.toISOString()
            })
            .eq('id', schedule.id);

          console.log(`[postponeSchedule] Shifted schedule ${schedule.id} to ${shiftedStart.toISOString()}`);
        }
      }
    }

    const message = `התזמון נדחה ליום ${nextDate.toLocaleDateString('he-IL')} ו-${subsequentSchedules?.length || 0} תזמונים נשרשרו קדימה`;
    return { success: true, message };

  } catch (error) {
    console.error('[postponeSchedule] Error:', error);
    return { success: false, message: `שגיאה: ${error}` };
  }
};