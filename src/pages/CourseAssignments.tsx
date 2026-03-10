import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Calendar,
  Edit,
  Clock,
  CheckCircle2,
  Circle,
  UserPlus,
  Filter,
  Trash,
  ChevronUp,
  ChevronDown,
  Loader2, // Import Loader icon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getSchoolTypeDisplayName,
  getSchoolTypeColors,
} from "@/utils/schoolTypeUtils";
import CourseAssignDialog from "@/components/CourseAssignDialog";
import MobileNavigation from "@/components/layout/MobileNavigation";
// *** Assuming fetchCombinedSchedules still exists and works ***
import { fetchCombinedSchedules } from "@/utils/scheduleUtils"; // Make sure this path is correct
import { DeleteConfirmationPopup } from "@/components/ui/DeleteConfirmationPopup ";
import { Pagination } from "@/components/ui/Pagination"; // Import Pagination component
import { hideCourseInstance } from "@/services/apiService";

// Interface Definitions
interface Task {
  id: string;
  title: string;
  description: string;
  estimated_duration: number;
  is_mandatory: boolean;
  lesson_number: number;
  lesson_title?: string;
  lesson_id?: string;
  order_index: number;
  scheduled_start?: string;
  scheduled_end?: string;
  report_status?: { // Keep this structure
    isReported: boolean;
    isCompleted?: boolean;
    isLessonOk?: boolean;
    reportId?: string;
  };
}

interface CourseAssignment {
  id: string; // Course Template ID
  instance_id: string; // Course Instance ID
  name: string;
  grade_level: string;
  max_participants: number;
  price_for_instructor: number;
  price_for_customer: number;
  institution_name: string;
  instructor_name: string;
  lesson_count: number;
  tasks: Task[]; // Ensure this holds the full Task structure
  start_date: string;
  approx_end_date: string;
  school_type?: string;
  presentation_link?: string;
  program_link?: string;
  lesson_mode?: 'template' | 'custom_only' | 'combined';
  // Include nested objects if needed by edit dialog or other logic
  course?: { id: string; name: string; school_type?: string; presentation_link?: string; program_link?: string };
  instructor?: { id: string; full_name: string };
  institution?: { id: string; name: string };
}

// Simple Cache for report statuses
const statusCache = new Map<string, { data: Map<string, any>; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

const CourseAssignments = () => {
  const { user } = useAuth();

  // State
  const [paginatedAssignments, setPaginatedAssignments] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; instanceId: string; name: string } | null>(null);
  const [editData, setEditData] = useState<Partial<CourseAssignment> | null>(null);
  const [deleteTargetAssignment, setDeleteTargetAssignment] = useState<CourseAssignment | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filter states (using names/types as per old logic for now)
  const [instructorFilter, setInstructorFilter] = useState<string>("");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<string>("");

  // Filter options
  const [instructors, setInstructors] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [courseTemplates, setCourseTemplates] = useState<any[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 8;
  const totalPages = Math.ceil(totalCount / pageSize);

  // No longer needed: const [reportStatusMap, setReportStatusMap] = useState<Map<string, { isCompleted: boolean; isLessonOk: boolean; reportId?: string }>>(new Map());

  const userRole = user?.user_metadata?.role;
  const hasAdminAccess = ["admin", "pedagogical_manager"].includes(userRole || '');
  const isInstructor = userRole === "instructor";

  // --- Helper Functions ---
  const formatDate = useCallback((isoDate: string | null | undefined): string => {
      if (!isoDate) return "לא צוין"; try { const date = new Date(isoDate); if (isNaN(date.getTime())) return "תאריך לא חוקי"; const day = date.getDate(); const month = date.getMonth() + 1; const year = date.getFullYear(); return `${day}.${month}.${year}`; } catch (e) { console.error("Error formatting date:", isoDate, e); return "שגיאה בתאריך"; }
  }, []);

  const formatDateTime = useCallback((isoDateTime: string | null | undefined): string | null => {
      if (!isoDateTime) return null; try { const date = new Date(isoDateTime); if (isNaN(date.getTime())) return "תאריך לא חוקי"; const day = date.getDate(); const month = date.getMonth() + 1; const year = date.getFullYear(); const hours = date.getHours().toString().padStart(2, "0"); const minutes = date.getMinutes().toString().padStart(2, "0"); return `${day}.${month}.${year} ${hours}:${minutes}`; } catch (e) { console.error("Error formatting datetime:", isoDateTime, e); return "שגיאה בתאריך"; }
  }, []);

  const groupTasksByLesson = useCallback((tasks: Task[]): Record<number, Task[]> => {
      if (!Array.isArray(tasks)) { console.error("groupTasksByLesson received non-array:", tasks); return {}; }
      const grouped = tasks.reduce((acc, task) => {
          const lessonNum = task.lesson_number;
          if (!acc[lessonNum]) acc[lessonNum] = [];
          acc[lessonNum].push(task);
          return acc;
      }, {} as Record<number, Task[]>);

      // Sort tasks within each group after grouping
      Object.keys(grouped).forEach(lessonNum => {
          grouped[Number(lessonNum)].sort((a, b) => a.order_index - b.order_index);
      });
      return grouped;
  }, []);

  const renderReportStatus = useCallback((reportStatus: Task['report_status']) => {
      try {
          if (!reportStatus?.isReported) {
              return <Badge variant="outline" className="bg-gray-100 text-gray-700 whitespace-nowrap">📋 טרם דווח</Badge>;
          }
          if (reportStatus.isCompleted === false) {
              return <Badge className="bg-orange-500 text-white border-orange-600 whitespace-nowrap">❌ לא התקיים</Badge>;
          }
          if (reportStatus.isCompleted && reportStatus.isLessonOk === false) {
              return <Badge className="bg-red-500 text-white border-red-600 whitespace-nowrap">לא התנהל כשורה⚠️</Badge>;
          }
          if (reportStatus.isCompleted && reportStatus.isLessonOk !== false) {
              return <Badge className="bg-green-500 text-white border-green-600 whitespace-nowrap">✅ דווח תקין</Badge>;
          }
          return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 whitespace-nowrap">❓ סטטוס לא ברור</Badge>;
      } catch (error) {
          console.error("Error rendering report status:", error, reportStatus);
          return <Badge variant="destructive" className="whitespace-nowrap">⚠️ שגיאה</Badge>;
      }
  }, []);

  const toggleCardExpansion = useCallback((instanceId: string) => {
      setExpandedCards((prev) => { const newSet = new Set(prev); if (newSet.has(instanceId)) newSet.delete(instanceId); else newSet.add(instanceId); return newSet; });
  }, []);


  // --- Report Status Fetching ---
  const fetchReportStatuses = useCallback(async (courseInstanceIds: string[]): Promise<Map<string, { isCompleted: boolean; isLessonOk: boolean; reportId?: string }>> => {
      if (!courseInstanceIds || courseInstanceIds.length === 0) return new Map();
      try {
          console.log("[ReportStatus] Fetching for instances:", courseInstanceIds);
          const { data: lessonReports, error } = await supabase
              .from("lesson_reports")
              .select(`id, is_completed, is_lesson_ok, created_at, reported_lesson_instances!inner (lesson_schedule_id, course_instance_id, lesson_id)`)
              .in("reported_lesson_instances.course_instance_id", courseInstanceIds);

          if (error) { console.error("Error fetching lesson reports:", error); return new Map(); }
          console.log(`[ReportStatus] Found ${lessonReports?.length || 0} raw report entries.`);

          const statusMap = new Map<string, { isCompleted: boolean; isLessonOk: boolean; reportId: string ; createdAt: Date}>();
          lessonReports?.forEach((report: any) => {
              if (!report.reported_lesson_instances) return;
              const instances = Array.isArray(report.reported_lesson_instances) ? report.reported_lesson_instances : [report.reported_lesson_instances];
              instances.forEach((instance: any) => {
                  if (!instance) return;
                  // *** DEBUG: Log instance data ***
                  // console.log("[ReportStatus] Processing instance:", instance);

                  const keys: string[] = [];
                  // Key 1: schedule ID (legacy or new)
                  if (instance.lesson_schedule_id) {
                      keys.push(instance.lesson_schedule_id);
                      // console.log(`  > Key 1 (schedule_id): ${instance.lesson_schedule_id}`);
                  }
                  // Key 2: composite ID
                  if (instance.course_instance_id && instance.lesson_id) {
                      const compositeKey = `${instance.course_instance_id}_${instance.lesson_id}`;
                      keys.push(compositeKey);
                      // console.log(`  > Key 2 (composite): ${compositeKey}`);
                  }

                  keys.forEach((key) => {
                      if (key) {
                          const existing = statusMap.get(key);
                          const reportCreatedAt = report.created_at ? new Date(report.created_at) : new Date(0);
                          const existingCreatedAt = existing?.createdAt || new Date(0);
                          if (!existing || reportCreatedAt > existingCreatedAt) {
                              statusMap.set(key, { isCompleted: report.is_completed !== false, isLessonOk: report.is_lesson_ok ?? false, reportId: report.id, createdAt: reportCreatedAt });
                              // console.log(`    >> Updated status for key "${key}" with report ${report.id}`);
                          } else {
                              // console.log(`    >> Kept existing status for key "${key}" (older report ${report.id})`);
                          }
                      }
                  });
              });
          });
          console.log("[ReportStatus] Created internal map size:", statusMap.size);
          // console.log("[ReportStatus] Internal Map Keys:", Array.from(statusMap.keys())); // Log all keys

          // Convert to the final map structure expected by the component
          const finalMap = new Map<string, { isCompleted: boolean; isLessonOk: boolean; reportId?: string }>();
          statusMap.forEach((value, key) => finalMap.set(key, { isCompleted: value.isCompleted, isLessonOk: value.isLessonOk, reportId: value.reportId }));
          return finalMap;
      } catch (error) {
          console.error("Error in fetchReportStatuses:", error);
          return new Map();
      }
   }, []);

  const getCachedReportStatuses = useCallback(async (courseInstanceIds: string[]) => {
      const cacheKey = courseInstanceIds.sort().join(","); const cached = statusCache.get(cacheKey); if (cached && Date.now() - cached.timestamp < CACHE_TTL) { console.log("[Cache] Using cached report statuses"); return cached.data; } const fresh = await fetchReportStatuses(courseInstanceIds); statusCache.set(cacheKey, { data: fresh, timestamp: Date.now() }); statusCache.forEach((value, key) => { if (Date.now() - value.timestamp > CACHE_TTL) statusCache.delete(key); }); return fresh;
  }, [fetchReportStatuses]);


  // --- Fetch Filter Options ---
  const fetchFilterOptions = useCallback(async () => {
       console.log("[fetchFilterOptions] Fetching..."); try { const [instructorsRes, institutionsRes, coursesRes] = await Promise.all([ supabase.from("profiles").select("id, full_name").eq("role", "instructor").order("full_name"), supabase.from("educational_institutions").select("id, name").order("name"), supabase.from("courses").select("id, name, school_type").eq("is_visible", true).order("name"), ]); if (instructorsRes.error) throw instructorsRes.error; if (institutionsRes.error) throw institutionsRes.error; if (coursesRes.error) throw coursesRes.error; setInstructors(instructorsRes.data || []); setInstitutions(institutionsRes.data || []); setCourseTemplates(coursesRes.data || []); console.log("[fetchFilterOptions] Success."); } catch (error) { console.error("Error fetching filter options:", error); }
  }, []);


  // --- fetchAssignments (Integrates Schedules and Statuses) ---
  const fetchAssignments = useCallback(async (pageToFetch = 0) => {
    if (!user) return;
    console.log(`[fetchAssignments] Fetching page ${pageToFetch}... Filters:`, { instructorFilter, institutionFilter, courseFilter, schoolTypeFilter });
    setLoading(true);

    try {
      const start = pageToFetch * pageSize;
      const end = start + pageSize - 1;

      let instanceQuery = supabase
        .from("course_instances")
        .select(`
            id, grade_level, max_participants, price_for_customer, price_for_instructor,
            start_date, end_date, created_at, lesson_mode, is_visible,
            course:course_id!inner (id, name, school_type, presentation_link, program_link, is_visible),
            instructor:instructor_id (id, full_name),
            institution:institution_id (id, name)
        `, { count: 'exact' })
        .eq('is_visible', true) // Only show visible instances
        .eq('course.is_visible', true) // Only show instances of visible courses
        .order('created_at', { ascending: false });

      if (isInstructor && user?.id) {
        instanceQuery = instanceQuery.eq('instructor_id', user.id);
      }

      // Apply Filters
      let filtersApplied = false;
      if (instructorFilter && instructorFilter !== 'all' && hasAdminAccess) {
          const instructor = instructors.find(i => i.full_name === instructorFilter);
          if(instructor) { instanceQuery = instanceQuery.eq('instructor_id', instructor.id); filtersApplied = true; }
          else if (instructors.length > 0) console.warn(`Instructor filter: ID not found for "${instructorFilter}"`);
      }
      if (institutionFilter && institutionFilter !== 'all') {
           const institution = institutions.find(i => i.name === institutionFilter);
           if(institution) { instanceQuery = instanceQuery.eq('institution_id', institution.id); filtersApplied = true; }
           else if (institutions.length > 0) console.warn(`Institution filter: ID not found for "${institutionFilter}"`);
      }
      if (courseFilter && courseFilter !== 'all') {
           const course = courseTemplates.find(c => c.name === courseFilter);
           if(course) { instanceQuery = instanceQuery.eq('course_id', course.id); filtersApplied = true; }
           else if (courseTemplates.length > 0) console.warn(`Course filter: ID not found for "${courseFilter}"`);
      }
      if (schoolTypeFilter && schoolTypeFilter !== 'all') {
          instanceQuery = instanceQuery.eq('course.school_type', schoolTypeFilter); filtersApplied = true;
      }
      console.log("[fetchAssignments] Filters applied:", filtersApplied);

      // Apply Range
      instanceQuery = instanceQuery.range(start, end);

      const { data: currentAssignmentsData, error: instancesError, count } = await instanceQuery;

      if (instancesError) throw instancesError;

      setTotalCount(count || 0);
      console.log(`[fetchAssignments] Page ${pageToFetch}: Found ${currentAssignmentsData?.length} instances, Total Filtered: ${count}`);

      if (!currentAssignmentsData || currentAssignmentsData.length === 0) {
        setPaginatedAssignments([]); setLoading(false); return;
      }

      // Fetch Details for the CURRENT PAGE's assignments
      const currentPageCourseIds = currentAssignmentsData.map((inst: any) => inst.course?.id).filter(Boolean);
      const currentPageInstanceIds = currentAssignmentsData.map((inst: any) => inst.id);

      if (currentPageInstanceIds.length > 0) {
        console.log("[fetchAssignments] Fetching details for instances:", currentPageInstanceIds);
        const [lessonsData, tasksData, schedulesData, statusMap] = await Promise.all([
          // Fetch Lessons
          supabase.from("lessons").select("*, course_instance_id")
            .in("course_id", currentPageCourseIds)
            .or(`course_instance_id.is.null,course_instance_id.in.(${currentPageInstanceIds.join(',')})`)
            .order("order_index").limit(500) // Limit potentially large lesson fetches
            .then(res => { if (res.error) console.error("Lessons fetch error:", res.error); return res.data || []; }),
          // Fetch Tasks (depends on lessons, fetched after lessons are resolved)
          supabase.from("lessons").select("id").in("course_id", currentPageCourseIds) // First get relevant lesson IDs
            .or(`course_instance_id.is.null,course_instance_id.in.(${currentPageInstanceIds.join(',')})`)
            .then(async ({ data: lessonIdsData, error: lessonIdsError }) => {
                if (lessonIdsError || !lessonIdsData || lessonIdsData.length === 0) {
                    if(lessonIdsError) console.error("Error fetching lesson IDs for tasks:", lessonIdsError);
                    return [];
                }
                const lessonIds = lessonIdsData.map(l => l.id);
                 console.log(`[fetchAssignments] Fetching tasks for ${lessonIds.length} lessons.`);
                const { data: tasksResult, error: tasksError } = await supabase.from("lesson_tasks").select("*")
                    .in("lesson_id", lessonIds).order("order_index").limit(2000); // Limit tasks
                if (tasksError) console.error("Tasks fetch error:", tasksError);
                return tasksResult || [];
            }),
          // Fetch Schedules
          fetchCombinedSchedules(currentPageInstanceIds),
          // Fetch Statuses
          getCachedReportStatuses(currentPageInstanceIds),
        ]);

        console.log(`[fetchAssignments] Details fetched: ${lessonsData.length} lessons, ${tasksData.length} tasks, ${schedulesData.length} schedules, ${statusMap.size} statuses`);
        // console.log("[fetchAssignments] Schedules data:", schedulesData); // *** DEBUG: Log schedules ***
        // console.log("[fetchAssignments] Status map:", statusMap); // *** DEBUG: Log status map ***

        // Format ONLY the current page assignments
        const formattedAssignments = currentAssignmentsData.map((instanceData: any): CourseAssignment => {
            const course = instanceData.course;
            const lessonMode = instanceData.lesson_mode || 'template';
            let courseLessons: any[] = [];
            const allRelatedLessons = lessonsData.filter((l: any) => l.course_id === course?.id);

             switch (lessonMode) {
                 case 'custom_only': courseLessons = allRelatedLessons.filter((l: any) => l.course_instance_id === instanceData.id).sort((a:any, b:any) => a.order_index - b.order_index); break;
                 case 'combined': const tpl = allRelatedLessons.filter((l: any) => l.course_instance_id === null); const inst = allRelatedLessons.filter((l: any) => l.course_instance_id === instanceData.id); courseLessons = [...tpl, ...inst].sort((a:any, b:any) => a.order_index - b.order_index); break;
                 default: courseLessons = allRelatedLessons.filter((l: any) => l.course_instance_id === null).sort((a:any, b:any) => a.order_index - b.order_index); break;
            }

            // Format tasks including schedule and status
            const allCourseTasks = courseLessons.flatMap((lesson: any, lessonIndex: number): Task[] => {
                const lessonTasksData = tasksData.filter((task: any) => task.lesson_id === lesson.id);

                // *** DEBUG: Check schedule matching ***
                const lessonSchedule = schedulesData.find((s: any) => {
                    // console.log(`  > Comparing schedule: lesson ${s.lesson_id} / instance ${s.course_instance_id} vs lesson ${lesson.id} / instance ${instanceData.id}`);
                    return s.lesson_id === lesson.id && s.course_instance_id === instanceData.id;
                });
                if (!lessonSchedule) {
                    // console.log(`  > No schedule found for lesson ${lesson.id} in instance ${instanceData.id}`);
                }

                let reportStatus: Task['report_status'] = { isReported: false }; // Default
                const keys = [lessonSchedule?.id, `${instanceData.id}_${lesson.id}`].filter(Boolean);
                let statusFound = false; // Flag to check if status was found
                for (const key of keys) {
                    const status = statusMap.get(key);
                    if (status) {
                        reportStatus = {
                            isReported: true,
                            isCompleted: status.isCompleted,
                            isLessonOk: status.isLessonOk,
                            reportId: status.reportId
                        };
                        statusFound = true; // Mark as found
                        // console.log(`    >> Status FOUND for lesson ${lesson.id} using key "${key}"`, reportStatus);
                        break;
                    }
                }
                 if (!statusFound) {
                    // console.log(`    >> Status NOT FOUND for lesson ${lesson.id} (tried keys: ${keys.join(', ')})`);
                 }


                return lessonTasksData.map((task: any): Task => ({
                    id: task.id, title: task.title, description: task.description, estimated_duration: task.estimated_duration, is_mandatory: task.is_mandatory,
                    lesson_number: lessonIndex + 1, lesson_title: lesson.title, lesson_id: lesson.id, order_index: task.order_index,
                    scheduled_start: lessonSchedule?.scheduled_start, // Add schedule info
                    scheduled_end: lessonSchedule?.scheduled_end,     // Add schedule info
                    report_status: reportStatus, // Add status info
                }));
            });

            return { // Return the full CourseAssignment structure
                id: course?.id || '', instance_id: instanceData.id, name: course?.name || "ללא שם קורס",
                grade_level: instanceData.grade_level || "לא צוין", max_participants: instanceData.max_participants || 0,
                price_for_customer: instanceData.price_for_customer || 0, price_for_instructor: instanceData.price_for_instructor || 0,
                institution_name: instanceData.institution?.name || "לא צוין", instructor_name: instanceData.instructor?.full_name || "לא צוין",
                lesson_count: courseLessons.length, start_date: instanceData.start_date, approx_end_date: instanceData.end_date,
                school_type: course?.school_type, presentation_link: course?.presentation_link, program_link: course?.program_link,
                lesson_mode: lessonMode, tasks: allCourseTasks, // Include the fully formatted tasks
                course: instanceData.course, instructor: instanceData.instructor, institution: instanceData.institution,
            };
        });
        setPaginatedAssignments(formattedAssignments);

      } else {
         setPaginatedAssignments([]);
      }

    } catch (error) {
      console.error("Error fetching assignments:", error);
       setPaginatedAssignments([]);
       setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, pageSize, isInstructor, hasAdminAccess, instructors, institutions, courseTemplates, instructorFilter, institutionFilter, courseFilter, schoolTypeFilter, getCachedReportStatuses, fetchCombinedSchedules]);


  // --- Effects ---
  useEffect(() => {
    fetchFilterOptions(); // Fetch dropdown options once on mount
  }, []);

  // Fetch assignments when user, page, filters, or filter options change
  useEffect(() => {
    const optionsLoaded = instructors.length > 0 || institutions.length > 0 || courseTemplates.length > 0 || !hasAdminAccess;
    // Helper function defined inside or outside the component
    const filtersNeedOptionsCheck = () => (instructorFilter && hasAdminAccess) || institutionFilter || courseFilter;

    if (user && (optionsLoaded || !filtersNeedOptionsCheck())) {
        console.log("Triggering fetchAssignments due to dependency change...");
        fetchAssignments(currentPage);
    } else if (user) {
        console.log("Waiting for filter options to load before fetching...");
        // Optional: Show a specific loading state or message?
    }
  }, [user, currentPage, instructorFilter, institutionFilter, courseFilter, schoolTypeFilter, instructors, institutions, courseTemplates, fetchAssignments, hasAdminAccess]); // Added hasAdminAccess


  // --- Real-time & Other Event Listeners ---
  useEffect(() => {
    if (!user) return; let refreshTimeout: NodeJS.Timeout; const debouncedRefresh = () => { clearTimeout(refreshTimeout); refreshTimeout = setTimeout(() => { console.log("RT Refresh"); statusCache.clear(); fetchAssignments(currentPage); }, 1500); }; const channel = supabase.channel("course-assignments-changes") .on("postgres_changes",{ event: "*", schema: "public", table: "lesson_reports" }, debouncedRefresh) .on("postgres_changes",{ event: "*", schema: "public", table: "reported_lesson_instances" }, debouncedRefresh) .on("postgres_changes",{ event: "*", schema: "public", table: "course_instances"}, debouncedRefresh) .subscribe(); return () => { clearTimeout(refreshTimeout); supabase.removeChannel(channel); };
  }, [user, currentPage, fetchAssignments]);

  useEffect(() => {
    const handleRefresh = () => { console.log("Storage/Custom Event Refresh"); statusCache.clear(); fetchAssignments(currentPage); }; window.addEventListener("storage", (e) => { if (e.key === 'lessonReportUpdated') handleRefresh(); }); window.addEventListener("lessonReportUpdated", handleRefresh); return () => { window.removeEventListener("storage", (e) => { if (e.key === 'lessonReportUpdated') handleRefresh(); }); window.removeEventListener("lessonReportUpdated", handleRefresh); };
  }, [currentPage, fetchAssignments]);


  // --- Event Handlers for Dialogs ---
   const handleAssignCourse = useCallback((courseId: string, instanceId: string, courseName: string) => {
        setSelectedCourse({ id: courseId, instanceId: instanceId, name: courseName }); setDialogMode("create"); setEditData(null); setShowDialog(true);
    }, []);

   const handleEditAssignment = useCallback((assignment: CourseAssignment) => {
        const dialogEditData = {
             instance_id: assignment.instance_id, instructor_id: assignment.instructor?.id, institution_id: assignment.institution?.id,
             name: assignment.name, grade_level: assignment.grade_level, max_participants: assignment.max_participants,
             price_for_customer: assignment.price_for_customer, price_for_instructor: assignment.price_for_instructor,
             institution_name: assignment.institution_name, instructor_name: assignment.instructor_name,
             start_date: assignment.start_date, approx_end_date: assignment.approx_end_date, lesson_mode: assignment.lesson_mode
         };
        setEditData(dialogEditData); setDialogMode("edit"); setSelectedCourse({ id: assignment.id, instanceId: assignment.instance_id, name: assignment.name }); console.log("Editing assignment, prepared data:", dialogEditData); setShowDialog(true);
    }, []);

   const handleAssignmentComplete = useCallback(() => {
       statusCache.clear(); fetchAssignments(currentPage); setSelectedCourse(null); setEditData(null); setShowDialog(false);
    }, [currentPage, fetchAssignments]);

   const handleDeleteConfirm = useCallback(() => {
       fetchAssignments(currentPage); alert("ההקצאה נמחקה בהצלחה!");
    }, [currentPage, fetchAssignments]);

    // --- Filter Change Handlers ---
    const handleInstructorFilterChange = useCallback((value: string) => { setInstructorFilter(value === 'all' ? '' : value); setCurrentPage(0); }, []);
    const handleInstitutionFilterChange = useCallback((value: string) => { setInstitutionFilter(value === 'all' ? '' : value); setCurrentPage(0); }, []);
    const handleCourseFilterChange = useCallback((value: string) => { setCourseFilter(value === 'all' ? '' : value); setCurrentPage(0); }, []);
    const handleSchoolTypeFilterChange = useCallback((value: string) => { setSchoolTypeFilter(value === 'all' ? '' : value); setCurrentPage(0); }, []);
    const clearFilters = useCallback(() => { setInstructorFilter(""); setInstitutionFilter(""); setCourseFilter(""); setSchoolTypeFilter(""); setCurrentPage(0); }, []);

  // --- JSX Rendering ---

   // Initial Loading State
   if (loading && paginatedAssignments.length === 0) {
     return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center">
                <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary"/>
                <p className="text-lg text-gray-700 font-medium">טוען הקצאות...</p>
            </div>
        </div>
     );
   }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Mobile Nav */}
      <div className="md:hidden"><MobileNavigation /></div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <div><h1 className="text-3xl font-bold text-gray-900 mb-2"> {isInstructor ? "הקורסים שלי" : "הקצאות קורסים"} ({totalCount}) </h1> <p className="text-gray-600 text-lg"> {isInstructor ? "צפייה בקורסים שהוקצו לך" : "ניהול וצפייה בכל הקורסים שהוקצו למדריכים"} </p></div>
        </div>

        {/* Filters */}
        <div className="mb-6">
           <Card className="shadow-sm border-0 bg-white/80 backdrop-blur-sm">
             <CardContent className="p-4 space-y-4">
                 <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-500"/><span className="font-medium text-gray-700">סינון:</span></div>
                 <div className={`grid grid-cols-1 md:grid-cols-2 ${hasAdminAccess ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
                    {/* Instructor */}
                     {hasAdminAccess && ( <div className="flex flex-col gap-1">
                         <span className="text-xs font-medium text-gray-600">מדריך:</span>
                         <Select value={instructorFilter} onValueChange={handleInstructorFilterChange}>
                            <SelectTrigger><SelectValue placeholder="כל המדריכים" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">כל המדריכים</SelectItem>{instructors.map((inst) => (<SelectItem key={inst.id} value={inst.full_name}>{inst.full_name}</SelectItem>))}</SelectContent>
                         </Select>
                     </div>)}
                     {/* Institution */}
                     <div className="flex flex-col gap-1">
                         <span className="text-xs font-medium text-gray-600">מוסד:</span>
                         <Select value={institutionFilter} onValueChange={handleInstitutionFilterChange}>
                            <SelectTrigger><SelectValue placeholder="כל המוסדות" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">כל המוסדות</SelectItem>{institutions.map((inst) => (<SelectItem key={inst.id} value={inst.name}>{inst.name}</SelectItem>))}</SelectContent>
                         </Select>
                     </div>
                    {/* Course */}
                     <div className="flex flex-col gap-1">
                         <span className="text-xs font-medium text-gray-600">קורס:</span>
                         <Select value={courseFilter} onValueChange={handleCourseFilterChange}>
                            <SelectTrigger><SelectValue placeholder="כל הקורסים" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">כל הקורסים</SelectItem>{courseTemplates.map((course) => (<SelectItem key={course.id} value={course.name}>{course.name}</SelectItem>))}</SelectContent>
                         </Select>
                     </div>
                     {/* School Type */}
                     <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-gray-600">סוג בי"ס:</span>
                         <Select value={schoolTypeFilter} onValueChange={handleSchoolTypeFilterChange}>
                             <SelectTrigger><SelectValue placeholder="כל הסוגים" /></SelectTrigger>
                           <SelectContent><SelectItem value="all">כל הסוגים</SelectItem><SelectItem value="elementary">יסודי</SelectItem><SelectItem value="middle">חטיבה</SelectItem><SelectItem value="high">תיכון</SelectItem></SelectContent>
                         </Select>
                     </div>
                 </div>
                 {/* Clear Button */}
                 {(instructorFilter || institutionFilter || courseFilter || schoolTypeFilter) && (<Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 text-xs h-8">נקה סינון</Button>)}
             </CardContent>
           </Card>
         </div>

         {/* Loading Overlay (Only show when loading pages AFTER initial load) */}
        {loading && paginatedAssignments.length > 0 && ( <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> )}

        {/* Empty State */}
        {!loading && paginatedAssignments.length === 0 && (
             <Card className="text-center py-16 shadow-lg border-0 bg-white/80 backdrop-blur-sm mt-8">
                 <CardContent>
                     <Users className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                     <h3 className="text-xl font-semibold text-gray-900 mb-3">
                         {(instructorFilter || institutionFilter || courseFilter || schoolTypeFilter) ? "לא נמצאו הקצאות התואמות לסינון" : (isInstructor ? "לא הוקצו לך קורסים עדיין" : "לא נמצאו הקצאות קורסים")}
                     </h3>
                     <p className="text-gray-600 mb-6 text-lg">
                          {(instructorFilter || institutionFilter || courseFilter || schoolTypeFilter) ? "נסה לשנות את הסינון או לנקות אותו." : (isInstructor ? "כאשר יוקצו לך קורסים, הם יופיעו כאן." : "ניתן להקצות קורסים דרך עמוד ניהול הקורסים.")}
                     </p>
                 </CardContent>
             </Card>
         )}

        {/* Assignments List - Map over paginatedAssignments */}
        <div className="space-y-8">
          {paginatedAssignments.map((assignment) => (
            <Card key={assignment.instance_id} className="shadow-xl border-0 backdrop-blur-sm bg-white/80 transition-shadow duration-300 hover:shadow-2xl overflow-hidden">
              <CardHeader className="text-white rounded-t-lg bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6"> {/* Adjusted padding */}
                   <div className="flex justify-between items-start">
                        {/* Left Side: Info */}
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="text-blue-100 mb-1 text-sm">{formatDate(assignment.start_date)} - {formatDate(assignment.approx_end_date)}</div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <CardTitle className="text-2xl text-white break-words">{assignment.name}</CardTitle>
                                <Badge className="bg-green-500/20 text-green-100 border-green-300/30 whitespace-nowrap text-xs px-1.5 py-0.5">מוקצה</Badge> {/* Smaller badge */}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 mt-1 text-sm">
                                {assignment.presentation_link ? ( <a href={assignment.presentation_link} target="_blank" rel="noopener noreferrer" className="underline text-blue-100 hover:text-white"><b>צפה במצגת</b></a> ) : ( <span className="text-blue-200 italic">אין מצגת</span> )}
                                {assignment.program_link ? ( <a href={assignment.program_link} target="_blank" rel="noopener noreferrer" className="underline text-blue-100 hover:text-white"><b>צפה בתכנית</b></a> ) : ( <span className="text-blue-200 italic">אין תכנית</span> )}
                            </div>
                            <CardDescription className="text-blue-100 text-sm sm:text-base mt-2 break-words"> {/* Adjusted font size */}
                                {assignment.institution_name} • מדריך: {assignment.instructor_name} • כיתה: {assignment.grade_level}
                            </CardDescription>
                        </div>
                         {/* Right Side: Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-end flex-shrink-0">
                            {hasAdminAccess && (<>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => handleEditAssignment(assignment)} title="עריכת הקצאה"><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="text-red-300 hover:bg-red-500/50 hover:text-white h-8 w-8" onClick={() => setDeleteTargetAssignment(assignment)} title="מחיקת הקצאה"><Trash className="h-4 w-4" /></Button>
                            </>)}
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => toggleCardExpansion(assignment.instance_id)} title={expandedCards.has(assignment.instance_id) ? "הסתר" : "הצג פרטים"}>
                                {expandedCards.has(assignment.instance_id) ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
              </CardHeader>

              {/* Card Content - Render details directly */}
              {expandedCards.has(assignment.instance_id) && (
                <CardContent className="p-4 sm:p-6 bg-white">
                     {/* Info Grid */}
                     <div className={`grid grid-cols-2 sm:grid-cols-3 ${hasAdminAccess ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 mb-6 text-sm`}>
                         <div className={`p-3 rounded-lg border ${getSchoolTypeColors(assignment.school_type).border} ${getSchoolTypeColors(assignment.school_type).bg}`}><div className={`font-medium mb-1 ${getSchoolTypeColors(assignment.school_type).text}`}>סוג בי"ס</div><div className="font-bold text-gray-900">{getSchoolTypeDisplayName(assignment.school_type)}</div></div>
                         <div className="bg-blue-50 p-3 rounded-lg border border-blue-100"><div className="font-medium text-blue-700 mb-1">כיתה</div><div className="font-bold text-gray-900">{assignment.grade_level}</div></div>
                         <div className="bg-purple-50 p-3 rounded-lg border border-purple-100"><div className="font-medium text-purple-700 mb-1">מס' שיעורים</div><div className="font-bold text-gray-900">{assignment.lesson_count}</div></div>
                         { hasAdminAccess && <div className="bg-orange-50 p-3 rounded-lg border border-orange-100"><div className="font-medium text-orange-700 mb-1">מחיר ללקוח</div><div className="font-bold text-gray-900">₪{assignment.price_for_customer}</div></div>}
                     </div>

                   {/* Tasks Section */}
                   <h3 className="text-lg font-semibold text-gray-800 mb-3">שיעורים ומשימות</h3>
                   {assignment.tasks && assignment.tasks.length > 0 ? (
                     <div className="space-y-4">
                        {Object.entries(groupTasksByLesson(assignment.tasks))
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([lessonNumber, tasksInLesson]) => (
                          <div key={lessonNumber} className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                            {/* Lesson Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                                <h4 className="font-semibold text-gray-800 flex items-center text-base">
                                    <Calendar className="h-4 w-4 mr-2 text-gray-500"/>שיעור {lessonNumber}: {tasksInLesson[0]?.lesson_title || "ללא כותרת"}
                                </h4>
                                {/* Render status badge using the status from the first task */}
                                {renderReportStatus(tasksInLesson[0]?.report_status)}
                             </div>
                             {/* Tasks Table */}
                             <Table className="bg-white text-xs sm:text-sm">
                               <TableHeader>
                                   <TableRow>
                                        <TableHead className="text-right w-[40%] px-2 py-2 sm:px-4">משימה</TableHead>
                                        <TableHead className="text-right hidden sm:table-cell px-2 py-2 sm:px-4">זמן</TableHead>
                                        <TableHead className="text-right hidden sm:table-cell px-2 py-2 sm:px-4">סוג</TableHead>
                                        <TableHead className="text-right px-2 py-2 sm:px-4">תכנון</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                 {/* Sort tasks within the lesson by order_index */}
                                 {tasksInLesson
                                    // .sort((a,b) => a.order_index - b.order_index) // Already sorted in groupTasksByLesson
                                    .map((task) => (
                                     <TableRow key={task.id} className="hover:bg-gray-50">
                                        <TableCell className="py-2 px-2 sm:px-4 align-top"> {/* Align top */}
                                            <div><span className="font-medium">{task.title}</span>{task.description && <p className="text-gray-500 mt-1 hidden md:block text-xs">{task.description}</p>}</div>
                                            <div className="sm:hidden mt-1 space-y-1 text-gray-600 text-xs">
                                                <div><Clock className="h-3 w-3 inline mr-1"/> {task.estimated_duration} דק'</div>
                                                <div>{task.is_mandatory ? <CheckCircle2 className="h-3 w-3 text-red-500 inline mr-1"/> : <Circle className="h-3 w-3 text-gray-400 inline mr-1"/>} {task.is_mandatory ? "חובה" : "רשות"}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 px-2 sm:px-4 hidden sm:table-cell align-top"><div className="flex items-center text-gray-600 whitespace-nowrap"><Clock className="h-4 w-4 mr-1"/> {task.estimated_duration} דק'</div></TableCell>
                                        <TableCell className="py-2 px-2 sm:px-4 hidden sm:table-cell align-top"><Badge variant={task.is_mandatory ? "destructive" : "secondary"} className={`text-xs whitespace-nowrap ${task.is_mandatory ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>{task.is_mandatory ? "חובה" : "רשות"}</Badge></TableCell>
                                        <TableCell className="py-2 px-2 sm:px-4 align-top">
                                           {task.scheduled_start ? (<div className="text-gray-700 whitespace-nowrap text-xs"><div>{formatDateTime(task.scheduled_start)}</div>{task.scheduled_end && <div className="text-gray-500">עד {formatDateTime(task.scheduled_end)}</div>}</div>)
                                           : (<span className="text-gray-400 italic text-xs">לא מתוכנן</span>)}
                                        </TableCell>
                                     </TableRow>
                                   ))}
                               </TableBody>
                             </Table>
                          </div>
                        ))}
                     </div>
                   ) : (
                       <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                           <Circle className="h-8 w-8 text-gray-300 mx-auto mb-2"/>
                           <p>לא נמצאו שיעורים או משימות עבור הקצאה זו.</p>
                       </div>
                   )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Pagination UI */}
         {!loading && totalCount > pageSize && (
           <div className="mt-8">
             <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalCount} pageSize={pageSize} onPageChange={(page) => setCurrentPage(page)} isLoading={loading && paginatedAssignments.length > 0} />
           </div>
         )}


        {/* Dialogs */}
        {deleteTargetAssignment && ( <DeleteConfirmationPopup assignment={deleteTargetAssignment} isOpen={!!deleteTargetAssignment} onClose={() => setDeleteTargetAssignment(null)} onConfirm={() => { handleDeleteConfirm(); setDeleteTargetAssignment(null); }} /> )}
        {hasAdminAccess && showDialog && ( <CourseAssignDialog open={showDialog} onOpenChange={setShowDialog} mode={dialogMode} courseId={selectedCourse?.id} courseName={selectedCourse?.name} instanceId={selectedCourse?.instanceId} editData={dialogMode === 'edit' ? editData : undefined} onAssignmentComplete={handleAssignmentComplete} /> )}

      </main>
    </div>
  );
};
export default CourseAssignments;