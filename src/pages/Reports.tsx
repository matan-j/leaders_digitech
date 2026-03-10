import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Calendar, DollarSign, TrendingUp, Download, FileText, Users, BookOpen, CheckCircle, X, Filter, CalendarDays, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { fetchCombinedSchedules, filterSchedulesByDateRange } from '@/utils/scheduleUtils';

interface MonthlyReport {
  month: string;
  monthKey: string;
  date: Date;
  totalLessons: number;
  totalScheduledLessons: number;
  totalHours: number;
  totalEarnings: number;
  completedLessons: number;
  cancelledLessons: number;
  completionRate: number;
  instructorData?: InstructorReport[];
  institutionData?: InstitutionReport[];
  isLoaded?: boolean;
  isLoading?: boolean;
}

interface InstructorReport {
  id: string;
  full_name: string;
  hourly_rate: number | null;
  total_reports: number;
  total_hours: number;
  total_salary: number;
  reports: LessonReportDetail[];
}

interface LessonReportDetail {
  id: string;
  lesson_title: string;
  course_name: string;
  institution_name: string;
  lesson_number: number;
  participants_count: number;
  total_students: number;
  is_lesson_ok: boolean;
  is_completed: boolean;
  hourly_rate: number;
  created_at: string;
  attendanceData: AttendanceRecord[];
  course_instance_id?: string;
  scheduled_date?: string;
  lesson_status: 'completed' | 'reported_issues' | 'not_reported';
  schedule_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_hours?: number;
}

interface AttendanceRecord {
  id: string;
  name: string;
  attended: boolean;
}

interface InstitutionReport {
  id: string;
  name: string;
  total_lessons: number;
  total_revenue: number;
  total_students: number;
  courses: CourseDetail[];
}

interface CourseDetail {
  id: string;
  course_name: string;
  instructor_name: string;
  lesson_count: number;
  student_count: number;
  price_per_lesson: number;
  lesson_details: LessonReportDetail[];
  scheduled_in_month?: number;
  completion_percentage?: number;
}

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'instructors' | 'institutions'>('instructors');
  const [monthlyReports, setMonthlyReports] = useState<Map<string, MonthlyReport>>(new Map());
  const [selectedMonth, setSelectedMonth] = useState<string>('current');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedInstitution, setSelectedInstitution] = useState<string>('all');
  const [instructorsList, setInstructorsList] = useState<any[]>([]);
  const [institutionsList, setInstitutionsList] = useState<any[]>([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [totalSystemStudents, setTotalSystemStudents] = useState(0);
  // Cache for schedules data
  const [schedulesCache, setSchedulesCache] = useState<any>(null);

  // Helper function to calculate hours between two timestamps
  const calculateLessonHours = (scheduledStart: string, scheduledEnd: string): number => {
    try {
      const start = new Date(scheduledStart);
      const end = new Date(scheduledEnd);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60); // Convert milliseconds to hours
      return Math.max(0, diffHours); // Ensure non-negative
    } catch (error) {
      console.error('Error calculating lesson hours:', error);
      return 1.5; // Default fallback
    }
  };

  // Generate months list (current month + 12 months forward)
  const monthsList = useMemo(() => {
    const months = [];
    for (let i = 0; i <= 12; i++) {
      const monthDate = addMonths(new Date(), i);
      months.push({
        key: i === 0 ? 'current' : `month-${i}`,
        label: i === 0 ? 'החודש הנוכחי' : format(monthDate, 'MMMM yyyy', { locale: he }),
        date: monthDate,
        startDate: startOfMonth(monthDate),
        endDate: endOfMonth(monthDate)
      });
    }
    return months;
  }, []);

  const yearsList = useMemo(() => {
    const uniqueYears = Array.from(new Set(monthsList.map(m => m.date.getFullYear())));
    return uniqueYears.map(y => ({ key: String(y), label: String(y) }));
  }, [monthsList]);

  const filteredMonthsByYear = useMemo(() => {
    return monthsList.filter(m => selectedYear === 'all' || m.date.getFullYear() === parseInt(selectedYear));
  }, [monthsList, selectedYear]);

  // Ensure selected month belongs to selected year
  useEffect(() => {
    const allowed = monthsList.filter(m => selectedYear === 'all' || m.date.getFullYear() === parseInt(selectedYear));
    if (!allowed.some(m => m.key === selectedMonth)) {
      if (allowed.length > 0) {
        setSelectedMonth(allowed[0].key);
      }
    }
  }, [selectedYear, monthsList]);

  // Get filtered data for selected month
// Get filtered data for selected month
  const filteredMonthData = useMemo(() => { // <--- הורדתי את ה-async
    const selectedMonthData = monthlyReports.get(selectedMonth);
    let totalStudents;

    if (!selectedMonthData) {
      return {
        totalEarnings: 0,
        totalLessons: 0,
        totalScheduledLessons: 0,
        completionRate: 0,
        totalStudents: 0,
        detailData: []
      };
    }

    if (reportType === 'instructors') {
      const filteredInstructors = selectedInstructor === 'all' 
        ? selectedMonthData.instructorData || []
        : (selectedMonthData.instructorData || []).filter(instructor => instructor.id === selectedInstructor);

      const totalEarnings = filteredInstructors.reduce((sum, instructor) => sum + instructor.total_salary, 0);
      const totalLessons = filteredInstructors.reduce((sum, instructor) => sum + instructor.total_reports, 0);
      const completedLessons = filteredInstructors.reduce((sum, instructor) => 
        sum + instructor.reports.filter(report => report.lesson_status === 'completed').length, 0);
      
      // כאן התיקון: במקום await supabase, אנחנו משתמשים בנתון שכבר יש לנו
      totalStudents = totalSystemStudents;

      const totalScheduledLessons = selectedInstructor === 'all' 
        ? selectedMonthData.totalScheduledLessons 
        : selectedMonthData.totalScheduledLessons;

      return {
        totalEarnings,
        totalLessons,
        totalScheduledLessons,
        completionRate: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
        totalStudents,
        detailData: filteredInstructors
      };
    } else {
      const filteredInstitutions = selectedInstitution === 'all' 
        ? selectedMonthData.institutionData || []
        : (selectedMonthData.institutionData || []).filter(institution => institution.id === selectedInstitution);

      const totalEarnings = filteredInstitutions.reduce((sum, institution) => sum + institution.total_revenue, 0);
      const totalLessons = filteredInstitutions.reduce((sum, institution) => sum + institution.total_lessons, 0);
       totalStudents = filteredInstitutions.reduce((sum, institution) => sum + institution.total_students, 0);
      
      const allLessonDetails = filteredInstitutions.flatMap(inst => 
        inst.courses.flatMap(course => course.lesson_details)
      );
      const completedLessons = allLessonDetails.filter(lesson => lesson.lesson_status === 'completed').length;

      const totalScheduledLessons = selectedInstitution === 'all' 
        ? selectedMonthData.totalScheduledLessons 
        : selectedMonthData.totalScheduledLessons;

      return {
        totalEarnings,
        totalLessons,
        totalScheduledLessons,
        completionRate: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
        totalStudents,
        detailData: filteredInstitutions
      };
    }
  }, [monthlyReports, selectedMonth, reportType, selectedInstructor, selectedInstitution, totalSystemStudents]); // הוספתי את totalSystemStudents לתלויות
  // Toggle row expansion
  const toggleRowExpansion = useCallback((id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Fetch lists once on mount

  useEffect(() => {
    const fetchStudentCount = async () => {
      const { count } = await supabase
        .from("students")
        .select("count", { count: 'exact', head: true });
      setTotalSystemStudents(count ); 
    };
    fetchStudentCount();
  }, []);
  useEffect(() => {
    const fetchLists = async () => {
      const [instructorsRes, institutionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'instructor')
          .order('full_name'),
        supabase
          .from('educational_institutions')
          .select('id, name')
          .order('name')
      ]);
      
      setInstructorsList(instructorsRes.data || []);
      setInstitutionsList(institutionsRes.data || []);
    };

    fetchLists();
  }, []);

  // Fetch schedules cache once
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        // Pass includeHidden: true to get ALL schedules including hidden course instances
        const schedules = await fetchCombinedSchedules(undefined, true);
        setSchedulesCache(schedules);
      } catch (error) {
        console.error('Error fetching schedules:', error);
      }
    };

    fetchSchedules();
  }, []);

  // Load current month data immediately, then load others in background
  useEffect(() => {
    if (!user || !schedulesCache) return;

    const loadCurrentMonth = async () => {
      setLoading(true);
      try {
        const currentMonthData = monthsList.find(m => m.key === 'current');
        if (currentMonthData) {
          const monthData = await fetchMonthData(currentMonthData.startDate, currentMonthData.endDate, currentMonthData.key);
          
          setMonthlyReports(prev => new Map(prev).set('current', {
            month: currentMonthData.label,
            monthKey: currentMonthData.key,
            date: currentMonthData.date,
            isLoaded: true,
            isLoading: false,
            ...monthData
          }));
        }
      } catch (error) {
        console.error('Error fetching current month:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentMonth();
  }, [user, schedulesCache, monthsList]);

  // Load other months in background
  useEffect(() => {
    if (!user || !schedulesCache || loading) return;

    const loadOtherMonths = async () => {
      setBackgroundLoading(true);
      try {
        // Load other months one by one to avoid overwhelming the database
        for (const month of monthsList.filter(m => m.key !== 'current')) {
          const monthData = await fetchMonthData(month.startDate, month.endDate, month.key);
          
          setMonthlyReports(prev => new Map(prev).set(month.key, {
            month: month.label,
            monthKey: month.key,
            date: month.date,
            isLoaded: true,
            isLoading: false,
            ...monthData
          }));

          // Small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error loading background months:', error);
      } finally {
        setBackgroundLoading(false);
      }
    };

    // Start background loading after a short delay
    const timer = setTimeout(loadOtherMonths, 1000);
    return () => clearTimeout(timer);
  }, [user, schedulesCache, loading, monthsList]);

  // Load specific month data on demand
  const loadMonthOnDemand = useCallback(async (monthKey: string) => {
    const month = monthsList.find(m => m.key === monthKey);
    if (!month || monthlyReports.has(monthKey)) return;

    // Mark as loading
    setMonthlyReports(prev => new Map(prev).set(monthKey, {
      month: month.label,
      monthKey: month.key,
      date: month.date,
      isLoaded: false,
      isLoading: true,
      totalLessons: 0,
      totalScheduledLessons: 0,
      totalHours: 0,
      totalEarnings: 0,
      completedLessons: 0,
      cancelledLessons: 0,
      completionRate: 0,
      instructorData: [],
      institutionData: []
    }));

    try {
      const monthData = await fetchMonthData(month.startDate, month.endDate, month.key);
      
      setMonthlyReports(prev => new Map(prev).set(monthKey, {
        month: month.label,
        monthKey: month.key,
        date: month.date,
        isLoaded: true,
        isLoading: false,
        ...monthData
      }));
    } catch (error) {
      console.error('Error loading month on demand:', error);
      // Remove loading state on error
      setMonthlyReports(prev => {
        const newMap = new Map(prev);
        newMap.delete(monthKey);
        return newMap;
      });
    }
  }, [monthsList, monthlyReports]);

  // Handle month selection - load on demand if not loaded
  const handleMonthChange = useCallback((monthKey: string) => {
    setSelectedMonth(monthKey);
    if (!monthlyReports.has(monthKey)) {
      loadMonthOnDemand(monthKey);
    }
  }, [monthlyReports, loadMonthOnDemand]);

  // Optimized fetchMonthData with better queries
  const fetchMonthData = async (startDate: Date, endDate: Date, monthKey: string) => {
    try {
      // Use cached schedules
      const monthSchedules = schedulesCache ? 
        filterSchedulesByDateRange(schedulesCache, startDate, endDate) : [];
      
      const scheduledCountByInstance = new Map<string, number>();
      for (const s of monthSchedules) {
        const instanceId = s?.course_instances?.id || s?.course_instance_id;
        if (!instanceId) continue;
        scheduledCountByInstance.set(instanceId, (scheduledCountByInstance.get(instanceId) || 0) + 1);
      }
      
      const totalScheduledLessons = Array.from(scheduledCountByInstance.values()).reduce((a, b) => a + b, 0);

      // Optimized data fetching with better joins
      const [instructorData, institutionData] = await Promise.all([
        fetchInstructorDataOptimized(startDate, endDate),
        fetchInstitutionDataOptimized(startDate, endDate)
      ]);

      // Add unreported lessons using cached schedules
      await Promise.all([
        addUnreportedLessonsOptimized(instructorData, monthSchedules, 'instructor'),
        addUnreportedLessonsOptimized(institutionData, monthSchedules, 'institution')
      ]);

      // Attach completion info for institutions
      for (const inst of institutionData) {
        for (const course of inst.courses) {
          const scheduledInMonth = scheduledCountByInstance.get(course.id) || 0;
          const completedLessons = course.lesson_details.filter(lesson => lesson.lesson_status === 'completed').length;
          course.scheduled_in_month = scheduledInMonth;
          course.completion_percentage = scheduledInMonth > 0 ? (completedLessons / scheduledInMonth) * 100 : 0;
        }
      }

      const totalReportedLessons = instructorData.reduce((sum, instructor) => sum + instructor.total_reports, 0);
      const totalActualHours = instructorData.reduce((sum, instructor) => sum + instructor.total_hours, 0);
      const completedLessons = instructorData.reduce((sum, instructor) => 
        sum + instructor.reports.filter(report => report.lesson_status === 'completed').length, 0);

      const completionRate = totalScheduledLessons > 0 ? (completedLessons / totalScheduledLessons) * 100 : 0; // מתוך השיעורים המתוכננים

      return {
        totalLessons: totalReportedLessons,
        totalScheduledLessons,
        totalHours: totalActualHours,
        totalEarnings: instructorData.reduce((sum, instructor) => sum + instructor.total_salary, 0),
        completedLessons,
        cancelledLessons: totalScheduledLessons - totalReportedLessons,
        completionRate,
        instructorData,
        institutionData
      };
    } catch (error) {
      console.error('Error fetching month data:', error);
      return {
        totalLessons: 0,
        totalScheduledLessons: 0,
        totalHours: 0,
        totalEarnings: 0,
        completedLessons: 0,
        cancelledLessons: 0,
        completionRate: 0,
        instructorData: [],
        institutionData: []
      };
    }
  };

  // Optimized instructor data fetching with single query
  const fetchInstructorDataOptimized = async (startDate: Date, endDate: Date) => {
    try {
      const { data: reports, error } = await supabase
        .from('lesson_reports')
        .select(`
          id,
          lesson_title,
          participants_count,
          is_lesson_ok,
          is_completed,
          created_at,
          instructor_id,
          course_instance_id,
          lesson_schedule_id,
          instructor:instructor_id (
            id,
            full_name,
            hourly_rate
          ),
          reported_lesson_instances (
            lesson_number
          ),
          lesson_attendance (
            student_id,
            attended,
            students (
              id,
              full_name
            )
          ),
          lessons:lesson_id (
            id,
            order_index,
            courses:course_id (
              name
            )
          ),
          course_instances (
            id,
            price_for_instructor,
            students (id),
            educational_institutions (name)
          ),
          lesson_schedules (
            id,
            scheduled_start,
            scheduled_end,
            course_instances (
              id,
              price_for_instructor,
              students (id),
              educational_institutions (name)
            )
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const instructorMap = new Map<string, InstructorReport>();

      for (const report of reports || []) {
        const instructorId = report.instructor_id;
        const instructor = report.instructor;
        
        if (!instructor || !instructorId) continue;

        // Get institution info and course instance data from the joined data
        let institutionName = 'לא זמין';
        let totalStudents = 0;
        let hourlyRate = instructor.hourly_rate || 0;
        let courseInstanceId: string | undefined = report.course_instance_id || undefined;
        let scheduledStart: string | undefined;
        let scheduledEnd: string | undefined;
        let actualHours = 1; // Default fallback

        if (report.course_instances) {
          totalStudents = report.course_instances.students?.length || 0;
          hourlyRate = report.course_instances.price_for_instructor || instructor.hourly_rate || 0;
          institutionName = report.course_instances.educational_institutions?.name || 'לא זמין';
        } else if (report.lesson_schedules?.course_instances) {
          const courseInstance = report.lesson_schedules.course_instances;
          totalStudents = courseInstance.students?.length || 0;
          hourlyRate = courseInstance.price_for_instructor || instructor.hourly_rate || 0;
          institutionName = courseInstance.educational_institutions?.name || 'לא זמין';
          courseInstanceId = courseInstance.id;
        }

        // Get scheduled times and calculate actual hours
        if (report.lesson_schedules) {
          scheduledStart = report.lesson_schedules.scheduled_start;
          scheduledEnd = report.lesson_schedules.scheduled_end;
          
          if (scheduledStart && scheduledEnd) {
            actualHours = calculateLessonHours(scheduledStart, scheduledEnd);
          }
        }

        // Process attendance data
        const attendanceData: AttendanceRecord[] = [];
        if (report.lesson_attendance) {
          for (const attendance of report.lesson_attendance) {
            if (attendance.students) {
              attendanceData.push({
                id: attendance.students.id,
                name: attendance.students.full_name,
                attended: attendance.attended
              });
            }
          }
        }

        const lessonStatus: 'completed' | 'reported_issues' | 'not_reported' = 
          report.is_completed !== false ? 'completed' : 'reported_issues';

        const lessonDetail: LessonReportDetail = {
          id: report.id,
          lesson_title: report.lesson_title,
          course_name: report.lessons?.courses?.name || 'לא זמין',
          institution_name: institutionName,
          lesson_number: report.reported_lesson_instances?.[0]?.lesson_number || (report.lessons?.order_index ? report.lessons.order_index + 1 : 1),
          participants_count: report.participants_count || 0,
          total_students: totalStudents,
          is_lesson_ok: report.is_lesson_ok || false,
          is_completed: report.is_completed !== false,
          hourly_rate: report.is_completed !== false ? hourlyRate : 0, // 0 שקל אם השיעור לא התקיים
          created_at: report.created_at,
          attendanceData,
          course_instance_id: courseInstanceId,
          lesson_status: lessonStatus,
          schedule_id: report.lesson_schedule_id,
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
          actual_hours: actualHours,
        };

        if (!instructorMap.has(instructorId)) {
          instructorMap.set(instructorId, {
            id: instructorId,
            full_name: instructor.full_name,
            hourly_rate: instructor.hourly_rate,
            total_reports: 0,
            total_hours: 0,
            total_salary: 0,
            reports: []
          });
        }

        const instructorReport = instructorMap.get(instructorId)!;
        instructorReport.reports.push(lessonDetail);
        instructorReport.total_reports += 1;
        instructorReport.total_hours += actualHours; // Use actual calculated hours
        instructorReport.total_salary += lessonDetail.hourly_rate; // כבר 0 אם השיעור לא התקיים
      }

      return Array.from(instructorMap.values());
    } catch (error) {
      console.error('Error fetching instructor data:', error);
      return [];
    }
  };

  // Optimized institution data fetching
  const fetchInstitutionDataOptimized = async (startDate: Date, endDate: Date) => {
    try {
      const { data: courseInstances, error } = await supabase
        .from('course_instances')
        .select(`
          id,
          price_for_customer,
          price_for_instructor,
          educational_institutions!inner (
            id,
            name
          ),
          courses (
            id,
            name
          ),
          instructor:instructor_id (
            id,
            full_name
          ),
          students (
            id,
            full_name
          ),
          lesson_reports!inner (
            id,
            lesson_title,
            participants_count,
            is_lesson_ok,
            is_completed,
            created_at,
            lesson_schedule_id,
            lesson_attendance (
              student_id,
              attended,
              students (
                id,
                full_name
              )
            ),
            reported_lesson_instances (
              lesson_number
            )
          )
        `)
        .gte('lesson_reports.created_at', startDate.toISOString())
        .lte('lesson_reports.created_at', endDate.toISOString());

      if (error) throw error;

      const institutionMap = new Map<string, InstitutionReport>();

      for (const instance of courseInstances || []) {
        if (!instance.educational_institutions) continue;

        const institutionId = instance.educational_institutions.id;
        const institutionName = instance.educational_institutions.name;

        if (!institutionMap.has(institutionId)) {
          institutionMap.set(institutionId, {
            id: institutionId,
            name: institutionName,
            total_lessons: 0,
            total_revenue: 0,
            total_students: 0,
            courses: []
          });
        }

        const institutionReport = institutionMap.get(institutionId)!;

        const lessonsWithAttendance = (instance.lesson_reports || []).map(report => {
          const attendanceData: AttendanceRecord[] = [];
          if (report.lesson_attendance) {
            for (const attendance of report.lesson_attendance) {
              if (attendance.students) {
                attendanceData.push({
                  id: attendance.students.id,
                  name: attendance.students.full_name,
                  attended: attendance.attended
                });
              }
            }
          }

          const lessonStatus: 'completed' | 'reported_issues' | 'not_reported' = 
            report.is_completed !== false ? 'completed' : 'reported_issues';

          return {
            id: report.id,
            lesson_title: report.lesson_title,
            course_name: instance.courses?.name || 'לא זמין',
            institution_name: institutionName,
            lesson_number: report.reported_lesson_instances?.[0]?.lesson_number || 1,
            participants_count: report.participants_count || 0,
            total_students: instance.students?.length || 0,
            is_lesson_ok: report.is_lesson_ok || false,
            is_completed: report.is_completed !== false,
            hourly_rate: report.is_completed !== false ? (instance.price_for_customer || 0) : 0, // 0 שקל אם השיעור לא התקיים
            created_at: report.created_at,
            attendanceData,
            lesson_status: lessonStatus,
            schedule_id: report.lesson_schedule_id,
          };
        });

        if (lessonsWithAttendance.length > 0) {
          const courseDetail: CourseDetail = {
            id: instance.id,
            course_name: instance.courses?.name || 'לא זמין',
            instructor_name: instance.instructor?.full_name || 'לא זמין',
            lesson_count: lessonsWithAttendance.length,
            student_count: instance.students?.length || 0,
            price_per_lesson: instance.price_for_customer || 0,
            lesson_details: lessonsWithAttendance
          };

          institutionReport.courses.push(courseDetail);
          institutionReport.total_lessons += lessonsWithAttendance.length;
          
          // סכום ההכנסות - כבר כולל 0 אם השיעור לא התקיים
          const totalRevenue = lessonsWithAttendance.reduce((sum, lesson) => sum + lesson.hourly_rate, 0);
          institutionReport.total_revenue += totalRevenue;
          
          const uniqueStudents = new Set();
          (instance.students || []).forEach(student => uniqueStudents.add(student.id));
          institutionReport.total_students = Math.max(institutionReport.total_students, uniqueStudents.size);
        }
      }

      return Array.from(institutionMap.values());
    } catch (error) {
      console.error('Error fetching institution data:', error);
      return [];
    }
  };

  // Optimized unreported lessons processing using cached schedules
  const addUnreportedLessonsOptimized = async (data: any[], monthSchedules: any[], type: 'instructor' | 'institution') => {
    try {
      const reportedScheduleIds = new Set();
      
      if (type === 'instructor') {
        data.forEach(instructor => {
          instructor.reports.forEach((report: any) => {
            if (report.schedule_id) {
              reportedScheduleIds.add(report.schedule_id);
            }
          });
        });
      } else {
        data.forEach(institution => {
          institution.courses.forEach((course: any) => {
            course.lesson_details.forEach((lesson: any) => {
              if (lesson.schedule_id) {
                reportedScheduleIds.add(lesson.schedule_id);
              }
            });
          });
        });
      }

      const unreportedSchedules = monthSchedules.filter(schedule => !reportedScheduleIds.has(schedule.id));

      // Batch fetch instructor details if needed
      const neededInstructorIds = new Set();
      if (type === 'instructor') {
        unreportedSchedules.forEach(schedule => {
          const instructorId = schedule.course_instances?.instructor_id;
          if (instructorId && !data.find(inst => inst.id === instructorId)) {
            neededInstructorIds.add(instructorId);
          }
        });
      }

      let instructorDetails = new Map();
      if (neededInstructorIds.size > 0) {
        const { data: instructors } = await supabase
          .from('profiles')
          .select('id, full_name, hourly_rate')
          .in('id', Array.from(neededInstructorIds));
        
        instructors?.forEach(instructor => {
          instructorDetails.set(instructor.id, instructor);
        });
      }

      // Process unreported lessons
      for (const schedule of unreportedSchedules) {
        const courseInstance = schedule.course_instances;
        if (!courseInstance) continue;

        if (type === 'instructor') {
          const instructorId = courseInstance.instructor_id;
          if (!instructorId) continue;

          let instructor = data.find(inst => inst.id === instructorId);
          if (!instructor) {
            const instructorData = instructorDetails.get(instructorId);
            if (!instructorData) continue;
            
            instructor = {
              id: instructorId,
              full_name: instructorData.full_name,
              hourly_rate: instructorData.hourly_rate,
              total_reports: 0,
              total_hours: 0,
              total_salary: 0,
              reports: []
            };
            data.push(instructor);
          }

          // Calculate actual hours for unreported lesson
          const actualHours = schedule.scheduled_start && schedule.scheduled_end 
            ? calculateLessonHours(schedule.scheduled_start, schedule.scheduled_end)
            : 1; // Default fallback

          const unreportedLesson: LessonReportDetail = {
            id: `schedule-${schedule.id}`,
            lesson_title: schedule.lesson?.title || 'שיעור מתוכנן',
            course_name: courseInstance.courses?.name || 'לא זמין',
            institution_name: courseInstance.educational_institutions?.name || 'לא זמין',
            lesson_number: schedule.lesson?.order_index ? schedule.lesson.order_index + 1 : 1,
            participants_count: 0,
            total_students: courseInstance.students?.length || 0,
            is_lesson_ok: false,
            hourly_rate: courseInstance.price_for_instructor || instructor.hourly_rate || 0,
            created_at: schedule.scheduled_date,
            attendanceData: [],
            course_instance_id: courseInstance.id,
            scheduled_date: schedule.scheduled_date,
            lesson_status: 'not_reported',
            schedule_id: schedule.id,
            scheduled_start: schedule.scheduled_start,
            scheduled_end: schedule.scheduled_end,
            actual_hours: actualHours,
          };

          instructor.reports.push(unreportedLesson);
          // לא מוסיפים שעות לשיעורים שלא התקיימו
        } else {
          // Institution processing
          const institutionId = courseInstance.educational_institutions?.id;
          if (!institutionId) continue;

          let institution = data.find(inst => inst.id === institutionId);
          if (!institution) {
            institution = {
              id: institutionId,
              name: courseInstance.educational_institutions.name,
              total_lessons: 0,
              total_revenue: 0,
              total_students: 0,
              courses: []
            };
            data.push(institution);
          }

          let course = institution.courses.find((c: any) => c.id === courseInstance.id);
          if (!course) {
            course = {
              id: courseInstance.id,
              course_name: courseInstance.courses?.name || 'לא זמין',
              instructor_name: courseInstance.instructor?.full_name || 'לא זמין',
              lesson_count: 0,
              student_count: courseInstance.students?.length || 0,
              price_per_lesson: courseInstance.price_for_customer || 0,
              lesson_details: []
            };
            institution.courses.push(course);
          }

          // Calculate actual hours for unreported lesson
          const actualHours = schedule.scheduled_start && schedule.scheduled_end 
            ? calculateLessonHours(schedule.scheduled_start, schedule.scheduled_end)
            : 1; // Default fallback

          const unreportedLesson: LessonReportDetail = {
            id: `schedule-${schedule.id}`,
            lesson_title: schedule.lesson?.title || 'שיעור מתוכנן',
            course_name: courseInstance.courses?.name || 'לא זמין',
            institution_name: courseInstance.educational_institutions.name,
            lesson_number: schedule.lesson?.order_index ? schedule.lesson.order_index + 1 : 1,
            participants_count: 0,
            total_students: courseInstance.students?.length || 0,
            is_lesson_ok: false,
            hourly_rate: courseInstance.price_for_customer || 0,
            created_at: schedule.scheduled_date,
            attendanceData: [],
            course_instance_id: courseInstance.id,
            scheduled_date: schedule.scheduled_date,
            lesson_status: 'not_reported',
            schedule_id: schedule.id,
            scheduled_start: schedule.scheduled_start,
            scheduled_end: schedule.scheduled_end,
            actual_hours: actualHours,
          };

          course.lesson_details.push(unreportedLesson);
        }
      }
    } catch (error) {
      console.error('Error adding unreported lessons:', error);
    }
  };

  const clearFilters = useCallback(() => {
    setSelectedInstructor('all');
    setSelectedInstitution('all');
    setSelectedMonth('current');
    setSelectedYear('all');
  }, []);

  // Get current month data for rendering, with loading state
  const currentMonthReport = monthlyReports.get(selectedMonth);
  const isSelectedMonthLoading = currentMonthReport?.isLoading || (!currentMonthReport && selectedMonth !== 'current');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען נתוני החודש הנוכחי...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-primary ml-3" />
              <h1 className="text-xl font-semibold text-gray-900">דוחות ושכר</h1>
              {backgroundLoading && (
                <Badge variant="secondary" className="mr-3">
                  טוען נתונים נוספים...
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                className="flex items-center space-x-2"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="h-4 w-4" />
                <span>יומן</span>
              </Button>
              <Button className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>ייצוא דוח</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">סיכום חודשי</h2>
          <p className="text-gray-600">צפייה בדוחות ביצועים וחישוב שכר חודשי</p>
        </div>

        {/* Report Type Selection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>בחר סוג דוח</CardTitle>
            <CardDescription>בחר בין דוח מדריכים או דוח מוסדות חינוך</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={reportType} onValueChange={(value: 'instructors' | 'institutions') => setReportType(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instructors">דוח מדריכים</SelectItem>
                <SelectItem value="institutions">דוח מוסדות חינוך</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Current Month Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">₪{filteredMonthData.totalEarnings.toLocaleString()}</p>
                  <p className="text-gray-600 font-medium">
                    {reportType === 'instructors' ? 'משכורות ' : 'הכנסות '}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredMonthData.totalLessons}
                    <span className="text-sm text-gray-500">/{filteredMonthData.totalScheduledLessons}</span>
                  </p>
                  <p className="text-gray-600 font-medium">דווחו / מתוכננים</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
<p className="text-2xl font-bold text-purple-600">
  {((filteredMonthData.totalLessons / filteredMonthData.totalScheduledLessons) * 100).toFixed(1)}%
</p>                  <p className="text-gray-600 font-medium">אחוז השלמה</p>
                </div>
                <div className="p-3 rounded-full bg-purple-500">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="mt-2">
                <Progress 
                  value={(filteredMonthData.totalLessons / filteredMonthData.totalScheduledLessons) * 100} 
                  className="w-full h-2" 
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{filteredMonthData.totalStudents}</p>
                  <p className="text-gray-600 font-medium">
                    {reportType === 'instructors' ? 'תלמידים פעילים' : 'סה"כ תלמידים'}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-orange-500">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 ml-2" />
              סינונים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>שנה</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל השנים</SelectItem>
                    {yearsList.map((y) => (
                      <SelectItem key={y.key} value={y.key}>
                        {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>חודש</Label>
                <Select value={selectedMonth} onValueChange={handleMonthChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMonthsByYear.map((month) => (
                      <SelectItem key={month.key} value={month.key}>
                        {month.label}
                        {monthlyReports.get(month.key)?.isLoading && ' (טוען...)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {reportType === 'instructors' ? (
                <div>
                  <Label>מדריך</Label>
                  <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל המדריכים</SelectItem>
                      {instructorsList.map(instructor => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>מוסד חינוכי</Label>
                  <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל המוסדות</SelectItem>
                      {institutionsList.map(institution => (
                        <SelectItem key={institution.id} value={institution.id}>
                          {institution.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  נקה סינונים
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Reports Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>דוח חודשי מפורט</CardTitle>
            <CardDescription>סיכום פעילות ורווחים לכל החודשים - לחץ על חודש לצפייה מפורטת</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right">
                    <th className="py-3 px-4 font-medium text-gray-900">חודש</th>
                    <th className="py-3 px-4 font-medium text-gray-900">דווחו</th>
                    <th className="py-3 px-4 font-medium text-gray-900">מתוכננים</th>
                    <th className="py-3 px-4 font-medium text-gray-900">שעות</th>
                    <th className="py-3 px-4 font-medium text-gray-900">הושלמו</th>
                    <th className="py-3 px-4 font-medium text-gray-900">לא הושלמו</th>
                    <th className="py-3 px-4 font-medium text-gray-900">הכנסות</th>
                    <th className="py-3 px-4 font-medium text-gray-900">אחוז השלמה</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthsList.filter(m => selectedYear === 'all' || m.date.getFullYear() === parseInt(selectedYear)).map((month) => {
                    const report = monthlyReports.get(month.key);
                    const isLoading = report?.isLoading;
                    const isLoaded = report?.isLoaded;
                    
                    if (!report && month.key !== selectedMonth) {
                      return (
                        <tr 
                          key={month.key}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleMonthChange(month.key)}
                        >
                          <td className="py-3 px-4 font-medium">{month.label}</td>
                          <td colSpan={7} className="py-3 px-4 text-gray-500 text-center">
                            לחץ לטעינת נתונים
                          </td>
                        </tr>
                      );
                    }

                    if (isLoading) {
                      return (
                        <tr key={month.key} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{month.label}</td>
                          <td colSpan={7} className="py-3 px-4 text-gray-500 text-center">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              טוען...
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    if (!report) return null;

                    const monthEarnings = reportType === 'instructors' 
                      ? report.totalEarnings
                      : report.institutionData?.reduce((sum, inst) => sum + inst.total_revenue, 0) || 0;
                    
                    return (
                      <tr 
                        key={month.key}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedMonth === report.monthKey ? 'bg-blue-50' : ''}`}
                        onClick={() => handleMonthChange(report.monthKey)}
                      >
                        <td className="py-3 px-4 font-medium">{report.month}</td>
                        <td className="py-3 px-4 font-bold text-blue-600">{report.totalLessons}</td>
                        <td className="py-3 px-4 text-gray-600">{report.totalScheduledLessons}</td>
                        <td className="py-3 px-4">{report.totalHours.toFixed(1)}</td>
                        <td className="py-3 px-4">
                          <span className="text-green-600 font-medium">{report.completedLessons}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-red-600 font-medium">{report.cancelledLessons}</span>
                        </td>
                        <td className="py-3 px-4 font-bold">₪{monthEarnings.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          {report.totalScheduledLessons > 0 ? (
                            <div className="flex items-center gap-2">
                              <Badge variant={report.completionRate > 80 ? "default" : report.completionRate > 50 ? "secondary" : "destructive"}>
                                {report.completionRate.toFixed(0)}%
                              </Badge>
                              <Progress 
                                value={report.completionRate} 
                                className="w-16 h-2" 
                              />
                            </div>
                          ) : (
                            <Badge variant="outline">אין מתוכננים</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Selected Month Detailed Data */}
        <Card>
          <CardHeader>
            <CardTitle>פירוט נתונים - {monthsList.find(m => m.key === selectedMonth)?.label}</CardTitle>
            <CardDescription>
              נתונים מפורטים על {reportType === 'instructors' ? 'מדריכים' : 'מוסדות'} בחודש שנבחר - כולל כל השיעורים המתוכננים והמדווחים
              {(selectedInstructor !== 'all' || selectedInstitution !== 'all') && ' (מסונן)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSelectedMonthLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">טוען נתוני החודש...</p>
              </div>
            ) : reportType === 'instructors' ? (
              <div className="space-y-6">
                {filteredMonthData.detailData.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">אין נתוני מדריכים</h3>
                      <p className="text-gray-600">לא נמצאו נתונים עבור החודש והמדריך שנבחרו</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredMonthData.detailData.map((instructor) => (
                    <Card key={instructor.id} className="overflow-hidden">
                      <CardHeader className="bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl">{instructor.full_name}</CardTitle>
                            <CardDescription>
                              שיעורים דווחו: {instructor.total_reports} | 
                              שעות: {instructor.total_hours.toFixed(1)} | 
                              שכר: ₪{instructor.total_salary.toLocaleString()} |
                              אחוז השלמה: {(() => {
                                const totalScheduled = instructor.reports.length;
                                const totalCompleted = instructor.reports.filter(report => report.lesson_status === 'completed').length;
                                return totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
                              })()}%
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className="text-lg font-bold">
                              ₪{instructor.total_salary.toLocaleString()}
                            </Badge>
                            <Badge variant={(() => {
                              const totalScheduled = instructor.reports.length;
                              const totalCompleted = instructor.reports.filter(report => report.lesson_status === 'completed').length;
                              return totalScheduled > 0 && (totalCompleted / totalScheduled) > 0.8 ? "default" : "secondary";
                            })()}>
                              {(() => {
                                const totalScheduled = instructor.reports.length;
                                const totalCompleted = instructor.reports.filter(report => report.lesson_status === 'completed').length;
                                return `${totalCompleted}/${totalScheduled} הושלמו`;
                              })()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-right py-3 px-4 font-medium">שיעור מס'</th>
                                <th className="text-right py-3 px-4 font-medium">נושא השיעור</th>
                                <th className="text-right py-3 px-4 font-medium">קורס</th>
                                <th className="text-right py-3 px-4 font-medium">מוסד</th>
                                <th className="text-right py-3 px-4 font-medium">נוכחות</th>
                                <th className="text-right py-3 px-4 font-medium">שעות</th>
                                <th className="text-right py-3 px-4 font-medium">שכר לשיעור</th>
                                <th className="text-right py-3 px-4 font-medium">סטטוס השיעור</th>
                                <th className="text-right py-3 px-4 font-medium">תאריך</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {instructor.reports
                                .sort((a, b) => {
                                  if (a.lesson_status === 'not_reported' && b.lesson_status !== 'not_reported') return 1;
                                  if (a.lesson_status !== 'not_reported' && b.lesson_status === 'not_reported') return -1;
                                  return a.lesson_number - b.lesson_number;
                                })
                                .map((report) => (
                                <React.Fragment key={report.id}>
                                  <tr className={`hover:bg-gray-50 ${report.lesson_status === 'not_reported' ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                                    <td className="py-3 px-4 font-medium text-blue-600">
                                      שיעור {report.lesson_number}
                                    </td>
                                    <td className="py-3 px-4 font-medium">
                                      <div className="flex items-center gap-2">
                                        {report.lesson_status === 'not_reported' && (
                                          <span className="text-yellow-600 text-xs font-medium">⚠️ טרם דווח</span>
                                        )}
                                        {report.lesson_title}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant="outline">{report.course_name}</Badge>
                                    </td>
                                    <td className="py-3 px-4">
                                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                        {report.institution_name}
                                      </Badge>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-4 w-4 text-gray-500" />
                                          <span className="font-medium">
                                            {report.lesson_status === 'not_reported' 
                                              ? `0 מתוך ${report.total_students} (מתוכנן)`
                                              : `${report.participants_count} מתוך ${report.total_students}`
                                            }
                                          </span>
                                        </div>
                                        {report.attendanceData.length > 0 && report.lesson_status !== 'not_reported' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleRowExpansion(report.id)}
                                            className="flex items-center gap-1"
                                          >
                                            <span className="text-xs">רשימת נוכחות</span>
                                            {expandedRows.has(report.id) ? 
                                              <ChevronUp className="h-3 w-3" /> : 
                                              <ChevronDown className="h-3 w-3" />
                                            }
                                          </Button>
                                        )}
                                        {report.lesson_status === 'not_reported' && (
                                          <span className="text-xs text-yellow-600 font-medium">טרם דווח</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-medium">
                                      <div className="flex items-center gap-2">
                                        {report.lesson_status === 'not_reported' ? (
                                          <span className="text-yellow-600 font-medium">טרם דווח</span>
                                        ) : (
                                          <>
                                            <span className="text-blue-600 font-bold">
                                              {report.actual_hours?.toFixed(1) || '1'} ש'
                                            </span>
                                            {report.scheduled_start && report.scheduled_end && (
                                              <span className="text-xs text-gray-500">
                                                {new Date(report.scheduled_start).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                -
                                                {new Date(report.scheduled_end).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-bold">
                                      {report.lesson_status === 'not_reported' ? (
                                        <span className="text-yellow-600 font-medium">טרם דווח</span>
                                      ) : (
                                        <span className="text-green-600">₪{report.hourly_rate.toLocaleString()}</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
                                      {report.lesson_status === 'completed' ? (
                                        report.is_lesson_ok ? (
                                          <Badge className="bg-green-100 text-green-800">
                                            <CheckCircle className="h-3 w-3 ml-1" />
                                            הושלם בהצלחה
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive">
                                            <X className="h-3 w-3 ml-1" />
                                            לא התנהל כשורה
                                          </Badge>
                                        )
                                      ) : report.lesson_status === 'reported_issues' ? (
                                        report.is_completed === false ? (
                                          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                                            <X className="h-3 w-3 ml-1" />
                                            לא התקיים
                                          </Badge>
                                        ) : (
                                          <Badge variant="destructive">
                                            <X className="h-3 w-3 ml-1" />
                                            לא התנהל כשורה
                                          </Badge>
                                        )
                                      ) : (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                          <Calendar className="h-3 w-3 ml-1" />
                                          טרם דווח - דרוש דיווח!
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-gray-600">
                                      {report.lesson_status === 'not_reported' 
                                        ? (
                                          <div className="flex flex-col">
                                            <span className="text-yellow-600 font-medium">מתוכנן ל:</span>
                                            <span>{new Date(report.scheduled_date || '').toLocaleDateString('he-IL')}</span>
                                          </div>
                                        )
                                        : new Date(report.created_at).toLocaleDateString('he-IL')
                                      }
                                    </td>
                                  </tr>
                                  {/* Expandable attendance row */}
                                  {expandedRows.has(report.id) && (
                                    <tr>
                                      <td colSpan={8} className="bg-gray-50 p-4">
                                        <div className="grid grid-cols-2 gap-6">
                                          <div>
                                            <h4 className="font-semibold text-green-700 mb-2 flex items-center">
                                              <CheckCircle className="h-4 w-4 ml-1" />
                                              נוכחים ({report.attendanceData.filter(s => s.attended).length})
                                            </h4>
                                            <div className="space-y-1">
                                              {report.attendanceData.filter(s => s.attended).map(student => (
                                                <div key={student.id} className="text-sm text-gray-700 flex items-center">
                                                  <span className="w-2 h-2 bg-green-500 rounded-full ml-2"></span>
                                                  {student.name}
                                                </div>
                                              ))}
                                              {report.attendanceData.filter(s => s.attended).length === 0 && (
                                                <span className="text-gray-500 text-sm">אין תלמידים נוכחים</span>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <h4 className="font-semibold text-red-700 mb-2 flex items-center">
                                              <X className="h-4 w-4 ml-1" />
                                              נעדרים ({report.attendanceData.filter(s => !s.attended).length})
                                            </h4>
                                            <div className="space-y-1">
                                              {report.attendanceData.filter(s => !s.attended).map(student => (
                                                <div key={student.id} className="text-sm text-gray-700 flex items-center">
                                                  <span className="w-2 h-2 bg-red-500 rounded-full ml-2"></span>
                                                  {student.name}
                                                </div>
                                              ))}
                                              {report.attendanceData.filter(s => !s.attended).length === 0 && (
                                                <span className="text-gray-500 text-sm">כל התלמידים נוכחים</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredMonthData.detailData.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">אין נתוני מוסדות</h3>
                      <p className="text-gray-600">לא נמצאו נתונים עבור החודש והמוסד שנבחרו</p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredMonthData.detailData.map((institution) => (
                    <Card key={institution.id} className="overflow-hidden">
                      <CardHeader className="bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl flex items-center">
                              <Building2 className="h-5 w-5 ml-2" />
                              {institution.name}
                            </CardTitle>
                            <CardDescription>
                              שיעורים דווחו: {institution.total_lessons} | 
                              תלמידים: {institution.total_students} | 
                              הכנסות: ₪{institution.total_revenue.toLocaleString()} |
                              אחוז השלמה: {(() => {
                                const totalScheduled = institution.courses.reduce((sum, course) => sum + course.lesson_details.length, 0);
                                const totalCompleted = institution.courses.reduce((sum, course) => sum + course.lesson_details.filter(l => l.lesson_status === 'completed').length, 0);
                                return totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
                              })()}%
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className="text-lg font-bold">
                              ₪{institution.total_revenue.toLocaleString()}
                            </Badge>
                            <Badge variant={(() => {
                              const totalScheduled = institution.courses.reduce((sum, course) => sum + course.lesson_details.length, 0);
                              const totalCompleted = institution.courses.reduce((sum, course) => sum + course.lesson_details.filter(l => l.lesson_status === 'completed').length, 0);
                              return totalScheduled > 0 && (totalCompleted / totalScheduled) > 0.8 ? "default" : "secondary";
                            })()}>
                              {(() => {
                                const totalScheduled = institution.courses.reduce((sum, course) => sum + course.lesson_details.length, 0);
                                const totalCompleted = institution.courses.reduce((sum, course) => sum + course.lesson_details.filter(l => l.lesson_status === 'completed').length, 0);
                                return `${totalCompleted}/${totalScheduled} הושלמו`;
                              })()}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-0">
                        {institution.courses.map((course) => (
                          <div key={course.id} className="border-b border-gray-200 last:border-b-0">
                            <div className="bg-gray-100 px-4 py-3 flex justify-between items-center cursor-pointer"
                                 onClick={() => toggleRowExpansion(course.id)}>
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-100 rounded-full">
                                  <BookOpen className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900">{course.course_name}</h4>
                                  <p className="text-sm text-gray-600">
                                    מדריך: {course.instructor_name} | 
                                    {course.lesson_details.length} שיעורים מתוכננים | 
                                    {course.lesson_details.filter(l => l.lesson_status !== 'not_reported').length} דווחו | 
                                    {course.student_count} תלמידים
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {course.lesson_details.filter(l => l.lesson_status !== 'not_reported').length}/{course.lesson_details.length} דווחו
                                  </Badge>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    ₪{(course.price_per_lesson * course.lesson_details.filter(l => l.lesson_status === 'completed').length).toLocaleString()}
                                  </Badge>
                                </div>
                                {expandedRows.has(course.id) ? 
                                  <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                }
                              </div>
                            </div>
                            
                            {expandedRows.has(course.id) && (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-right py-3 px-4 font-medium">שיעור מס'</th>
                                      <th className="text-right py-3 px-4 font-medium">נושא השיעור</th>
                                      <th className="text-right py-3 px-4 font-medium">נוכחות</th>
                                      <th className="text-right py-3 px-4 font-medium">מחיר ללקוח</th>
                                      <th className="text-right py-3 px-4 font-medium">סטטוס השיעור</th>
                                      <th className="text-right py-3 px-4 font-medium">תאריך</th>
                                      <th className="text-right py-3 px-4 font-medium">פרטי נוכחות</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {course.lesson_details.map((lesson) => (
                                      <React.Fragment key={lesson.id}>
                                        <tr className="hover:bg-gray-50">
                                          <td className="py-3 px-4 font-medium text-blue-600">
                                            שיעור {lesson.lesson_number}
                                          </td>
                                          <td className="py-3 px-4 font-medium">{lesson.lesson_title}</td>
                                          <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                              <Users className="h-4 w-4 text-gray-500" />
                                              <span className="font-medium">
                                                {lesson.lesson_status === 'not_reported' 
                                                  ? `0 מתוך ${lesson.total_students} (מתוכנן)`
                                                  : `${lesson.participants_count} מתוך ${lesson.total_students}`
                                                }
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 font-bold text-green-600">
                                            {lesson.lesson_status === 'not_reported' ? (
                                              <span className="text-gray-400">לא דווח</span>
                                            ) : (
                                              `₪${lesson.hourly_rate.toLocaleString()}`
                                            )}
                                          </td>
                                          <td className="py-3 px-4">
                                            {lesson.lesson_status === 'completed' ? (
                                              lesson.is_lesson_ok ? (
                                                <Badge className="bg-green-100 text-green-800">
                                                  <CheckCircle className="h-3 w-3 ml-1" />
                                                  הושלם בהצלחה
                                                </Badge>
                                              ) : (
                                                <Badge variant="destructive">
                                                  <X className="h-3 w-3 ml-1" />
                                                  לא התנהל כשורה
                                                </Badge>
                                              )
                                            ) : lesson.lesson_status === 'reported_issues' ? (
                                              lesson.is_completed === false ? (
                                                <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                                                  <X className="h-3 w-3 ml-1" />
                                                  לא התקיים
                                                </Badge>
                                              ) : (
                                                <Badge variant="destructive">
                                                  <X className="h-3 w-3 ml-1" />
                                                  לא התנהל כשורה
                                                </Badge>
                                              )
                                            ) : (
                                              <Badge variant="outline" className="bg-gray-50 text-gray-600">
                                                <Calendar className="h-3 w-3 ml-1" />
                                                לא דווח
                                              </Badge>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-gray-600">
                                            {lesson.lesson_status === 'not_reported' 
                                              ? `מתוכנן ל: ${new Date(lesson.scheduled_date || '').toLocaleDateString('he-IL')}`
                                              : new Date(lesson.created_at).toLocaleDateString('he-IL')
                                            }
                                          </td>
                                          <td className="py-3 px-4">
                                            {lesson.attendanceData.length > 0 && lesson.lesson_status !== 'not_reported' && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleRowExpansion(lesson.id)}
                                                className="flex items-center gap-1"
                                              >
                                                <span className="text-xs">הצג נוכחות</span>
                                                {expandedRows.has(lesson.id) ? 
                                                  <ChevronUp className="h-3 w-3" /> : 
                                                  <ChevronDown className="h-3 w-3" />
                                                }
                                              </Button>
                                            )}
                                            {lesson.lesson_status === 'not_reported' && (
                                              <span className="text-xs text-gray-500">לא זמין</span>
                                            )}
                                          </td>
                                        </tr>
                                        {/* Attendance details */}
                                        {expandedRows.has(lesson.id) && (
                                          <tr>
                                            <td colSpan={7} className="bg-gray-50 p-4">
                                              <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                  <h4 className="font-semibold text-green-700 mb-2 flex items-center">
                                                    <CheckCircle className="h-4 w-4 ml-1" />
                                                    נוכחים ({lesson.attendanceData.filter(s => s.attended).length})
                                                  </h4>
                                                  <div className="space-y-1">
                                                    {lesson.attendanceData.filter(s => s.attended).map(student => (
                                                      <div key={student.id} className="text-sm text-gray-700 flex items-center">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full ml-2"></span>
                                                        {student.name}
                                                      </div>
                                                    ))}
                                                    {lesson.attendanceData.filter(s => s.attended).length === 0 && (
                                                      <span className="text-gray-500 text-sm">אין תלמידים נוכחים</span>
                                                    )}
                                                  </div>
                                                </div>
                                                <div>
                                                  <h4 className="font-semibold text-red-700 mb-2 flex items-center">
                                                    <X className="h-4 w-4 ml-1" />
                                                    נעדרים ({lesson.attendanceData.filter(s => !s.attended).length})
                                                  </h4>
                                                  <div className="space-y-1">
                                                    {lesson.attendanceData.filter(s => !s.attended).map(student => (
                                                      <div key={student.id} className="text-sm text-gray-700 flex items-center">
                                                        <span className="w-2 h-2 bg-red-500 rounded-full ml-2"></span>
                                                        {student.name}
                                                      </div>
                                                    ))}
                                                    {lesson.attendanceData.filter(s => !s.attended).length === 0 && (
                                                      <span className="text-gray-500 text-sm">כל התלמידים נוכחים</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Reports;