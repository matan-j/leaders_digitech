// Calendar.tsx - Progressive loading version
import  { useEffect, useState, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import MobileNavigation from "@/components/layout/MobileNavigation";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { WeeklyCalendar } from "@/components/ui/WeeklyCalendar";
import { fetchSchedulesByDateRange } from "@/utils/scheduleUtils";

const Calendar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

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
                  lessons={lessons}
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