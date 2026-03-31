// Calendar.tsx - Progressive loading version
import  { useEffect, useState, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { WeeklyCalendar } from "@/components/ui/WeeklyCalendar";
import { fetchSchedulesByDateRange } from "@/utils/scheduleUtils";

const Calendar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  const role = user?.user_metadata?.role;
  const isAdminOrManager = ['admin', 'pedagogical_manager'].includes(role);

  // Initialize selectedDate from location state or default to today
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (location.state?.selectedDate) {
      return new Date(location.state.selectedDate);
    }
    return new Date();
  });

  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState<'initial' | 'loading-more' | 'complete'>('initial');
  const loadedRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const [selectedInstructor, setSelectedInstructor] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedInstitution, setSelectedInstitution] = useState('all');

  /**
   * Progressive loading strategy:
   * 1. Load ±1 month from current date (fast, immediate results)
   * 2. Then load ±2 months (background)
   * 3. Continue expanding until we have enough data
   */
  const fetchLessonsData = useCallback(async (expandMonths = 1) => {
    if (!user) return;

    try {
      console.log(`[Calendar] Progressive loading: ±${expandMonths} months`);

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - expandMonths, 1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(now.getFullYear(), now.getMonth() + expandMonths + 1, 0);
      endDate.setHours(23, 59, 59, 999);

      console.log(`[Calendar] Loading range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
        let combinedSchedules;
        if ( user.user_metadata.role==='instructor' ){
    combinedSchedules=await fetchSchedulesByDateRange(startDate,endDate,undefined, user);
    }
      else{ combinedSchedules= await fetchSchedulesByDateRange(startDate, endDate);}

      console.log(`[Calendar] Loaded ${combinedSchedules.length} schedules`);

      setLessons(combinedSchedules);
      loadedRangeRef.current = { start: startDate, end: endDate };

      // Progressive expansion: load more data in background
      if (expandMonths === 1 && combinedSchedules.length > 0) {
        setLoadingState('loading-more');
        // Wait a bit to let the UI update, then load more
        setTimeout(() => {
          fetchLessonsData(2).then(() => {
            // After loading ±2 months, load ±3 months
            setTimeout(() => {
              fetchLessonsData(3).then(() => {
                setLoadingState('complete');
              });
            }, 1000);
          });
        }, 500);
      }
    } catch (error) {
      console.error("[Calendar] Error fetching lessons:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoadingState('initial');
      fetchLessonsData(1); // Start with ±1 month for fast initial load
    }
  }, []);

  // Derive unique options from fetched lessons
  const instructorOptions = isAdminOrManager
    ? Array.from(
        new Map(
          lessons
            .map(l => l.course_instances?.instructor)
            .filter(Boolean)
            .map(i => [i.id, i])
        ).values()
      ).sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'))
    : [];

  const courseOptions = isAdminOrManager
    ? Array.from(
        new Map(
          lessons
            .map(l => l.course_instances?.course)
            .filter(Boolean)
            .map(c => [c.id, c])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : [];

  const institutionOptions = isAdminOrManager
    ? Array.from(
        new Map(
          lessons
            .map(l => l.course_instances?.institution)
            .filter(Boolean)
            .map(i => [i.id, i])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : [];

  const filteredLessons = lessons.filter(lesson => {
    const ci = lesson.course_instances;
    if (selectedInstructor !== 'all' && ci?.instructor?.id !== selectedInstructor) return false;
    if (selectedCourse !== 'all' && ci?.course?.id !== selectedCourse) return false;
    if (selectedInstitution !== 'all' && ci?.institution?.id !== selectedInstitution) return false;
    return true;
  });

  // Auto-refresh calendar data every 2 minutes
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      console.log('[Calendar] Auto-refresh triggered');
      fetchLessonsData(1); // Refresh with ±1 month
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);




  return (
    <div className="min-h-screen bg-gray-50 p-0 sm:p-6 ">
      <div className="md:hidden">
        <MobileNavigation />
      </div>
      <div className="mb-4 sm:mb-8 px-3 sm:px-0 py-4 ">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">יומן אישי</h1>
            <p className="text-sm sm:text-base text-gray-600">צפייה במערכת השעות והשיעורים הקרובים</p>
          </div>
          
          <div className="flex items-center space-x-2">
        
            <button
              onClick={() => {
                console.log('[Calendar] Manual refresh button clicked');
                setLoadingState('initial');
                fetchLessonsData(1);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors shadow-md flex items-center"
              disabled={loadingState === 'initial'}
            >
              <CalendarIcon className="h-4 w-4 ml-2" />
              {loadingState === 'initial' ? 'טוען...' : 'רענן יומן'}
            </button>
          </div>
        </div>
      </div>

      {isAdminOrManager && (
        <div dir="rtl" className="flex flex-wrap gap-3 px-3 sm:px-0 mb-4">
          <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue>
                {selectedInstructor === 'all' ? 'סנן לפי מדריך' : instructorOptions.find(i => i.id === selectedInstructor)?.full_name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              {instructorOptions.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue>
                {selectedCourse === 'all' ? 'סנן לפי תכנית' : courseOptions.find(c => c.id === selectedCourse)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              {courseOptions.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue>
                {selectedInstitution === 'all' ? 'סנן לפי בית ספר' : institutionOptions.find(i => i.id === selectedInstitution)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              {institutionOptions.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto">
        <div className="w-full">
          <Card className="w-full rounded-none border-0 shadow-none sm:rounded-xl sm:border sm:shadow">
            <CardHeader className="p-0 sm:p-6">
              <div className="w-full">
                <div className="hidden sm:flex items-center gap-2 mb-4">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                  <span className="text-sm sm:text-base">בחר תאריך:</span>
                </div>

                <WeeklyCalendar
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  lessons={filteredLessons}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0" />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calendar;