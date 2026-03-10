import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Check, Plus, FastForward } from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { postponeScheduleToNextDay } from "@/utils/scheduleUtils";
import { useToast } from "@/hooks/use-toast";
import { fetchInstructors } from "@/services/apiService";

interface LessonCardProps {
  id: string;
  title: string;
  instructorName?: string;
  time: string;
  location: string;
  participants: number;
  statusLabel: string;
  color?: "blue" | "green" | "purple"; // הפך ל־אופציונלי
  buttonLabel: string;
  onClick: () => void;
}

interface DailyLessonsCardProps {
  dateLabel: string;
  lessons: LessonCardProps[];
  onAddLesson?: () => void;
}

const statusColors = {
  blue: {
    bg: "from-blue-50 to-blue-100",
    border: "border-blue-500",
    text: "text-blue-600",
    badgeBg: "bg-yellow-100",
    badgeText: "text-yellow-800",
  },
  green: {
    bg: "from-green-50 to-green-100",
    border: "border-green-500",
    text: "text-green-600",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  purple: {
    bg: "from-purple-50 to-purple-100",
    border: "border-purple-500",
    text: "text-purple-600",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
};

// צבעים זמינים לבחירה
const availableColors = ["blue", "green", "purple"] as const;

// בוחר צבע עקבי לפי מזהה
function getColorById(id: string): (typeof availableColors)[number] {
  let sum = 0;
  for (let i = 0; i < id.length; i++) {
    sum += id.charCodeAt(i);
  }
  return availableColors[sum % availableColors.length];
}

export const DailyLessonsCard: React.FC<any> = ({
  dateLabel,
  lessons,
  onAddLesson,
}) => {
  const { toast } = useToast();
  const [postponingScheduleId, setPostponingScheduleId] = useState<
    string | null
  >(null);

  const [reportedScheduleIds, setReportedScheduleIds] = useState<Set<string>>(
    new Set()
  );
  const [reportStatusMap, setReportStatusMap] = useState<
    Map<
      string,
      {
        isCompleted: boolean;
        isLessonOk: boolean;
        reportId?: string; // ⬅️ הוסף את זה!
        scheduleId?: string; // ⬅️ נוסיף גם את schedule ID
      }
    >
  >(new Map());

  useEffect(() => {
    async function fetchReportedSchedules() {
      const { data: lessonReports, error } = await supabase.from(
        "lesson_reports"
      ).select(`
      id,
      is_completed,
      is_lesson_ok,
      lesson_schedule_id
    `);

      if (error) {
        console.error("Failed to fetch lesson reports:", error);
        return;
      }

      const reportedIds = new Set<string>();
      const statusMap = new Map<
        string,
        {
          isCompleted: boolean;
          isLessonOk: boolean;
          reportId: string;
        }
      >();

      lessonReports?.forEach((report) => {
        if (!report.lesson_schedule_id) return;

        reportedIds.add(report.lesson_schedule_id);
        statusMap.set(report.lesson_schedule_id, {
          isCompleted: report.is_completed ?? false,
          isLessonOk: report.is_lesson_ok ?? false,
          reportId: report.id,
        });
      });

      setReportedScheduleIds(reportedIds);
      setReportStatusMap(statusMap);
    }
    fetchReportedSchedules();
  }, []);

  function getLessonKey(lesson: any) {
    return lesson.id || null; // scheduleId בלבד
  }

  const filteredClasses = (lessons ?? []).filter((c) => {
    console.log("DATE", c.scheduled_start);
    if (!c.scheduled_start) return true;

    const classDate = new Date(c.scheduled_start);
    const selected = new Date(Date.now());
    // -*24 * 60 * 60 * 1000
    // Normalize both dates to YYYY-MM-DD strings
    const classDateStr = classDate.toISOString().split("T")[0];
    const selectedDateStr = selected.toISOString().split("T")[0];

    return classDateStr === selectedDateStr;
  });

  // Remove duplicates based on course_instance_id and lesson_id
  const uniqueClasses = filteredClasses.filter((lesson, index, self) => {
    const key = `${lesson.course_instance_id}_${
      lesson.lesson?.id || lesson.lesson_id
    }`;
    return (
      index ===
      self.findIndex((l) => {
        const lKey = `${l.course_instance_id}_${l.lesson?.id || l.lesson_id}`;
        return lKey === key;
      })
    );
  });

  const sortedClasses = uniqueClasses.sort((a, b) => {
    const timeA = new Date(a.scheduled_start).getTime();
    const timeB = new Date(b.scheduled_start).getTime();
    return timeA - timeB;
  });
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const nav = useNavigate();
  const [instructors, setInstructors] = useState<
    { id: string; full_name: string }[]
  >([]);
  const { user } = useAuth();
  // Fetch instructors once using apiService function
  useEffect(() => {
    const loadInstructors = async () => {
      try {
        const data = await fetchInstructors();
        setInstructors(data || []);
      } catch (error) {
        console.error("Error fetching instructors:", error);
      }
    };

    loadInstructors();
  }, []);

  // Create a lookup map for fast access
  const instructorMap = useMemo(() => {
    const map = new Map<string, string>();
    instructors.forEach((instr) => map.set(instr.id, instr.full_name));

    return map;
  }, [instructors, lessons]);

  return (
    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl">
            <Calendar className="h-8 w-6 mr-3" />
            יומן יומי - {dateLabel}
          </CardTitle>
          {onAddLesson && user.user_metadata.role !== "instructor" && (
            <Button
              size="sm"
              onClick={onAddLesson}
              className="bg-green-600 hover:bg-green-700 text-white shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              צור תכנית לימוד חדשה
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {sortedClasses.map((lesson) => {
          const instructorName = lesson.instructor_id
            ? instructorMap.get(lesson.instructor_id) || "" // empty string if not found
            : "";

          const renderStatusBadge = () => {
            const key = getLessonKey(lesson);

            // consistent lookup for both "isReported" and "lessonStatus"
            const isReported = key ? reportedScheduleIds.has(key) : false;
            const lessonStatus = key ? reportStatusMap.get(key) : undefined;

            const canEdit = ["admin", "pedagogical_manager"].includes(
              user.user_metadata.role
            );

            const canReport = [
              "instructor",
              "admin",
              "pedagogical_manager",
            ].includes(user.user_metadata.role);

            // ✅ Case 1: Lesson completed successfully
            if (
              isReported &&
              lessonStatus?.isCompleted &&
              lessonStatus?.isLessonOk
            ) {
              return (
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="bg-green-400 rounded-full px-4 py-3 flex items-center font-bold cursor-default text-base"
                  >
                    <Check className="w-6 h-6 ml-2" />
                    דווח
                  </button>
                  {lessonStatus.reportId && (
                    <button
                      onClick={() =>
                        nav(
                          `/lesson-report/${lesson.lesson_id}?scheduleId=${lesson.id}&courseInstanceId=${lesson.course_instance_id}&editReportId=${lessonStatus.reportId}&instructorId=${lesson.instructor_id}`,
                          { state: { selectedDate: new Date().toISOString() } }
                        )
                      }
                      className="bg-orange-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors hover:bg-orange-600 shadow-md"
                    >
                      ✏️ ערוך
                    </button>
                  )}
                </div>
              );
            }

            // ✅ Case 2: Lesson not reported yet
            if (!isReported) {
              return canReport ? (
                <button
                  onClick={() =>
                    nav(
                      `/lesson-report/${lesson.lesson_id}?scheduleId=${lesson.id}&courseInstanceId=${lesson.course_instance_id}&instructorId=${lesson.instructor_id}`,
                      { state: { selectedDate: new Date().toISOString() } }
                    )
                  }
                  className="bg-blue-500 text-white rounded-full px-4 py-3 font-bold text-base transition-colors hover:bg-blue-600 shadow-md"
                >
                  📋 דווח על השיעור
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 text-base font-bold text-gray-600 bg-gray-100 px-4 py-2 rounded-full">
                  📋 טרם דווח
                </span>
              );
            }

            // ✅ Case 3: Lesson did not occur
            if (lessonStatus?.isCompleted === false) {
              return (
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="rounded-full px-4 py-3 flex items-center font-bold cursor-default text-base text-white"
                    style={{ backgroundColor: "#FFA500" }}
                  >
                    ❌ לא התקיים
                  </button>
                  {lessonStatus.reportId && (
                    <button
                      onClick={() =>
                        nav(
                          `/lesson-report/${lesson.lesson_id}?scheduleId=${lesson.id}&courseInstanceId=${lesson.course_instance_id}&editReportId=${lessonStatus.reportId}&instructorId=${lesson.instructor_id}`
                        )
                      }
                      className="bg-orange-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors hover:bg-orange-600 shadow-md"
                    >
                      ✏️ ערוך
                    </button>
                  )}
                </div>
              );
            }

            // ✅ Case 4: Lesson occurred but not ok
            if (
              lessonStatus?.isCompleted &&
              lessonStatus?.isLessonOk === false
            ) {
              return (
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="rounded-full px-4 py-3 flex items-center font-bold cursor-default text-base text-white"
                    style={{ backgroundColor: "#FF0000" }}
                  >
                    ⚠️ לא התנהל כשורה
                  </button>
                  {lessonStatus.reportId && (
                    <button
                      onClick={() =>
                        nav(
                          `/lesson-report/${lesson.lesson_id}?courseInstanceId=${lesson.course_instance_id}&editReportId=${lessonStatus.reportId}&instructorId=${lesson.instructor_id}`
                        )
                      }
                      className="bg-orange-500 text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors hover:bg-orange-600 shadow-md"
                    >
                      ✏️ ערוך
                    </button>
                  )}
                </div>
              );
            }

            // ✅ Default fallback (shouldn’t normally be reached)
            return (
              <button
                disabled
                className="bg-green-400 rounded-full px-4 py-3 flex items-center font-bold cursor-default text-base"
              >
                <Check className="w-6 h-6 ml-2" />
                דווח
              </button>
            );
          };

          return (
            <div
              key={lesson.lesson_id}
              className="p-4 rounded-2xl shadow bg-white border text-right space-y-1"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-2">
                    📘 {lesson.course_name} – שיעור מס׳ {lesson.lesson_number}
                  </h3>
                  <p className="text-base mb-1">
                    <span className="font-semibold">📖 שם השיעור:</span>{" "}
                    {lesson.title}
                  </p>
                  <p className="text-base mb-1">
                    <span className="font-semibold">🏫 מוסד:</span>{" "}
                    {lesson.institution_name}
                  </p>
                  <p className="text-base mb-1">
                    <span className="font-semibold">📚 כיתה:</span>{" "}
                    {lesson.grade_level}
                  </p>
                  <p className="text-base mb-1">
                    <span className="font-semibold">👨‍🏫 מדריך:</span>{" "}
                    {instructorName}
                  </p>
                  {/* )} */}
                  <p className="text-base font-medium text-gray-900 mt-3">
                    🕐 {formatTime(lesson.scheduled_start)} -{" "}
                    {formatTime(lesson.scheduled_end)}
                  </p>
                </div>

                <div className="text-left">{renderStatusBadge()}</div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
