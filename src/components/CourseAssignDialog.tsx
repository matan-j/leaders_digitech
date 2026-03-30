import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import CourseLessonsSection, { Lesson } from "./course/CourseLessonsSection";
import { Settings,  Layers, Plus } from "lucide-react";
import AddInstitutionModal from "@/components/institutions/AddInstitutionModal";
import { Calendar1, Clock, BookOpen, GripVertical, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  getSystemDefaults,
  getDisabledDatesForCalendar,
  isDateBlocked,
  generatePhysicalSchedulesFromPattern,
  updatePhysicalSchedules
} from "@/utils/scheduleUtils"; // עדכן את הנתיב לפי המיקום הנכון
import { Switch } from "@radix-ui/react-switch";
import { useAuth } from "./auth/AuthProvider";

// --- Interfaces ---
interface Institution {
  id: string;
  name: string;
}

interface Instructor {
  id: string;
  full_name: string;
}

interface TimeSlot {
  day: number;
  start_time: string;
  end_time: string;
  [key: string]: Json | undefined;
}

interface ClassSection {
  grade_level: string;
  days_of_week: number[];
  time_slots: TimeSlot[];
  lesson_duration_minutes: number;
  is_double_lesson: boolean;
}

interface CourseInstanceSchedule {
  days_of_week: number[];
  time_slots: TimeSlot[];
  total_lessons?: number;
  lesson_duration_minutes?: number;
}

interface EditData {
  instance_id: string;
  name: string;
  grade_level: string;
  max_participants: number;
  price_for_customer: number;
  price_for_instructor: number;
  institution_name: string;
  instructor_name: string;
  start_date: string;
  approx_end_date: string;
  is_double_lesson?: boolean;
}

interface CourseAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  courseId?: string;
  courseName?: string;
  instanceId?: string;
  editData?: EditData;
  onAssignmentComplete: () => void;
}

// --- Helper Functions ---
const formatDate = (date: Date, formatString: string) => {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  if (formatString === "dd/MM/yyyy") return `${day}/${month}/${year}`;
  if (formatString === "dd/MM") return `${day}/${month}`;
  return d.toLocaleDateString();
};

const getInitialState = () => ({
  formData: {
    institution_id: "",
    instructor_id: "",
    grade_level: "",
    price_for_customer: "",
    price_for_instructor: "",
    max_participants: "",
    start_date: "",
    end_date: "",
  },
  courseSchedule: {
    days_of_week: [],
    time_slots: [],
    total_lessons: 1,
    lesson_duration_minutes: 45,
    task_duration_minutes: 25,
  },
  instanceLessons: [],
  hasCustomLessons: false,
});


// --- Main Component ---
const CourseAssignDialog = ({
  open,
  onOpenChange,
  mode = 'create',
  courseId,
  courseName,
  instanceId,
  editData,
  onAssignmentComplete,
}: CourseAssignDialogProps) => {
  const { toast } = useToast();
  
  // --- States ---
  const {user}=useAuth();
  const isAdmin = ['admin'].includes(user?.user_metadata?.role);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [showAddInstitution, setShowAddInstitution] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(getInitialState().formData);
  const [showCustomLessonsDialog, setShowCustomLessonsDialog] = useState(false);
  const [templateLessons, setTemplateLessons] = useState<Lesson[]>([]);
  const [instanceLessons, setInstanceLessons] = useState<any[]>([]);
  const [hasCustomLessons, setHasCustomLessons] = useState(false);
  const [courseSchedule, setCourseSchedule] = useState(getInitialState().courseSchedule);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
const [systemDefaults, setSystemDefaults] = useState<any>(null);
//debug
// const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
const [draggedLessonIndex, setDraggedLessonIndex] = useState<number | null>(null);
const [lessonMode, setLessonMode] = useState<'template' | 'custom_only' | 'combined'|'none'>('template');
const [isCombinedMode, setIsCombinedMode] = useState(false);
const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
const [isDoubleLesson, setIsDoubleLesson] = useState(false);
const [classes, setClasses] = useState<ClassSection[]>([
  { grade_level: '', days_of_week: [], time_slots: [], lesson_duration_minutes: 45, is_double_lesson: false }
]);

  const isMounted = useRef(false);
  
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  

  useEffect(() => {
  if (!open) {
    isMounted.current = false;
    return;
  }
  if (isMounted.current) {
    return;
  }

  const initialState = getInitialState();
  setFormData(initialState.formData);
  setCourseSchedule(initialState.courseSchedule);
  setInstanceLessons(initialState.instanceLessons);
  setHasCustomLessons(initialState.hasCustomLessons);
  if (mode !== 'edit') setIsDoubleLesson(false);
  if (mode !== 'edit') setClasses([
    { grade_level: '', days_of_week: [], time_slots: [], lesson_duration_minutes: 45, is_double_lesson: false }
  ]);
  setStep(1);

  // טעינת הגדרות מערכת וקבצים חסומים
  loadSystemConfiguration();

  fetchInstitutions();
  fetchInstructors();

  if (mode === 'create' && courseId) {
    fetchTemplateLessons().then(templates => {
      const lessonList = templates || [];
      if (lessonList.length > 0) {
        setCourseSchedule(prev => ({ ...prev, total_lessons: lessonList.length || 1 }));
      }
    });
  } else if (mode === 'edit' && editData) {
    fetchExistingSchedule();
    loadInstanceLessons();
    if(courseId) fetchTemplateLessons();
  }

  isMounted.current = true;
}, [open]);


useEffect(() => {
  if (templateLessons.length > 0 || instanceLessons.length > 0) {
    const totalLessons = templateLessons.length + instanceLessons.length;
    setCourseSchedule(prev => ({
      ...prev,
      total_lessons: totalLessons || prev.total_lessons || 1
    }));
  }
}, [templateLessons, instanceLessons]); // רק כשהרשימות משתנות, לא כשהערך משתנה


//for debug purposes
// useEffect(() => {
//   const debounceTimer = setTimeout(() => {
//     validateScheduleDates();
//   }, 500);
  
//   return () => clearTimeout(debounceTimer);
// }, [formData.start_date, formData.end_date, courseSchedule.days_of_week, courseSchedule.total_lessons, templateLessons, instanceLessons]);
  // Load system configuration on dialog open
const loadSystemConfiguration = async () => {
  try {
    // Load system defaults
    const defaults = await getSystemDefaults();
    setSystemDefaults(defaults);
    
    // Update course schedule with system defaults
    setCourseSchedule(prev => ({
      ...prev,
      lesson_duration_minutes: defaults.default_lesson_duration,
      task_duration_minutes: defaults.default_task_duration,
    }));
    if (mode !== 'edit') {
      setClasses(prev => prev.map((cls, i) =>
        i === 0 ? { ...cls, lesson_duration_minutes: defaults.default_lesson_duration } : cls
      ));
    }
    
    // Load disabled dates for calendar
    const disabled = await getDisabledDatesForCalendar();
    setDisabledDates(disabled);
    
  } catch (error) {
    console.error('Error loading system configuration:', error);
    toast({
      title: "שגיאה",
      description: "לא ניתן לטעון הגדרות מערכת",
      variant: "destructive",
    });
  }
};

//for debug purposes
// const validateScheduleDates = async () => {
//   if (!formData.start_date || !formData.end_date || courseSchedule.days_of_week.length === 0) {
//     setScheduleWarnings([]);
//     return;
//   }
  
//   const warnings: string[] = [];
  
//   // Generate potential lesson dates
//   const potentialDates: Date[] = [];
//   const startDate = new Date(formData.start_date);
//   const endDate = new Date(formData.end_date);
  
//   let currentDate = new Date(startDate);
//   let lessonCount = 0;
//   const maxLessons = templateLessons.length + instanceLessons.length || 10;
  
//   while (currentDate <= endDate && lessonCount < maxLessons) {
//     const dayOfWeek = currentDate.getDay();
//     if (courseSchedule.days_of_week.includes(dayOfWeek)) {
//       const isBlocked = await isDateBlocked(currentDate);
//       if (isBlocked) {
//         warnings.push(`התאריך ${formatDate(currentDate, "dd/MM/yyyy")} חסום במערכת`);
//       }
//       potentialDates.push(new Date(currentDate));
//       lessonCount++;
//     }
//     currentDate.setDate(currentDate.getDate() + 1);
//   }
  
//   // Check if lesson duration is appropriate
//   if (courseSchedule.lesson_duration_minutes && systemDefaults) {
//     if (courseSchedule.lesson_duration_minutes < 15) {
//       warnings.push('משך השיעור קצר מהמומלץ (15 דקות)');
//     }
//     if (courseSchedule.lesson_duration_minutes > systemDefaults.default_lesson_duration * 2) {
//       warnings.push(`משך השיעור ארוך משמעותית מברירת המחדל (${systemDefaults.default_lesson_duration} דקות)`);
//     }
//   }
  
//   setScheduleWarnings(warnings);
// };

  useEffect(() => {
    if (mode === 'edit' && editData && institutions.length > 0 && instructors.length > 0) {
      const institutionId = findIdByName(institutions, editData.institution_name);
      const instructorId = findIdByName(instructors, editData.instructor_name);
      setFormData({
        institution_id: institutionId,
        instructor_id: instructorId,
        grade_level: editData.grade_level,
        price_for_customer: editData.price_for_customer.toString(),
        price_for_instructor: editData.price_for_instructor.toString(),
        max_participants: editData.max_participants.toString(),
        start_date: editData.start_date || "",
        end_date: editData.approx_end_date || "",
      });
      setIsDoubleLesson(editData.is_double_lesson || false);
    }
  }, [editData, institutions, instructors, mode, open]);

  // --- Data Fetching Functions ---
  const findIdByName = (items: any[], name: string) => items.find(item => item.name === name || item.full_name === name)?.id || "";

  const fetchInstitutions = async () => {
    try {
      const { data, error } = await supabase.from("educational_institutions").select("id, name").order("name");
      if (error) throw error;
      setInstitutions(data || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      toast({ title: "שגיאה", description: "לא ניתן לטעון את רשימת המוסדות", variant: "destructive" });
    }
  };
  
  const fetchInstructors = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "instructor").order("full_name");
      if (error) throw error;
      setInstructors(data || []);
    } catch (error) {
      console.error("Error fetching instructors:", error);
      toast({ title: "שגיאה", description: "לא ניתן לטעון את רשימת המדריכים", variant: "destructive" });
    }
  };

const fetchTemplateLessons = async (idToFetch?: string) => {
      const finalCourseId = idToFetch || courseId; // Use passed ID or prop
  if (!finalCourseId) return;

    try {
      const { data: lessons, error } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          order_index,
          lesson_tasks (
            id,
            title,
            description,
            estimated_duration,
            is_mandatory,
            order_index
          )
        `)
        .eq('course_id', finalCourseId) // Use finalCourseId here
        .is('course_instance_id', null) // רק שיעורי תבנית
        .order('order_index');

      if (error) {
        console.error('Error loading template lessons:', error);
        return;
      }

      const formattedLessons = lessons?.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        order_index: lesson.order_index,
        tasks: lesson.lesson_tasks?.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          estimated_duration: task.estimated_duration,
          is_mandatory: task.is_mandatory,
          order_index: task.order_index
        })).sort((a, b) => a.order_index - b.order_index) || []
      })) || [];

      setTemplateLessons(formattedLessons);
    } catch (error) {
      console.error('Error fetching template lessons:', error);
    }
  };
  const loadInstanceLessons = async () => {
    const actualInstanceId = instanceId || editData?.instance_id;
    if (!actualInstanceId) return;
    try {
      console.log('[loadInstanceLessons] Loading lessons for instance:', actualInstanceId);

      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, description, order_index, course_instance_id, lesson_tasks(*)')
        .eq('course_instance_id', actualInstanceId)
        .order('order_index');

      if (error) throw error;

      console.log('[loadInstanceLessons] Found lessons in DB:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('[loadInstanceLessons] Lesson details:', data.map(l => ({ id: l.id, title: l.title, order_index: l.order_index })));
      }

      if (data && data.length > 0) {
        const formattedLessons = data.map(l => ({
          ...l,
          description: l.description || '',
          tasks: (l.lesson_tasks as any[]) || []
        }));
        setInstanceLessons(formattedLessons);
        setHasCustomLessons(true);
        console.log('[loadInstanceLessons] Set hasCustomLessons = true');
      } else {
        setInstanceLessons([]);
        setHasCustomLessons(false);
        console.log('[loadInstanceLessons] No custom lessons found, set hasCustomLessons = false');
      }
    } catch (error) {
      console.error('[loadInstanceLessons] Error loading instance lessons:', error);
    }
  };
  


// Find this function
const fetchExistingSchedule = async () => {
  if (!editData?.instance_id) return;

  try {
    // START of CHANGE
    const { data: instanceData, error: instanceError } = await supabase
      .from("course_instances")
      .select("course_id, lesson_mode") // Fetch lesson_mode here
      .eq("id", editData.instance_id)
      .single();

    if (instanceError) throw instanceError;

    // Check the mode and fetch template lessons if needed
    if (instanceData) {
      const lessonMode = (instanceData as any).lesson_mode;
      if (lessonMode === 'combined') {
        setIsCombinedMode(true);
      }
      // This is the crucial fix: fetch template lessons for the correct course
      const coursId = (instanceData as any).course_id;
      if (coursId) {
        fetchTemplateLessons(coursId);
      }
    }
    // END of CHANGE

    const { data: scheduleData, error: scheduleError } = await supabase
      .from("course_instance_schedules")
      .select("*")
      .eq("course_instance_id", editData.instance_id)
      .maybeSingle();

    if (scheduleData && !scheduleError) {
      const durMinutes = (scheduleData as any).lesson_duration_minutes;
      const taskDurMinutes = (scheduleData as any).task_duration_minutes;

      // Normalize days_of_week to numbers (might come from DB as strings)
      const normalizedDays = (scheduleData.days_of_week || []).map((day: any) =>
        typeof day === 'string' ? parseInt(day, 10) : day
      );

      // Normalize time_slots days to numbers
      const normalizedTimeSlots = ((scheduleData.time_slots as any[]) || []).map((ts: any) => ({
        ...ts,
        day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
      }));

      setCourseSchedule({
        days_of_week: normalizedDays,
        time_slots: normalizedTimeSlots as TimeSlot[],
        total_lessons: scheduleData.total_lessons || 1,
        lesson_duration_minutes:
          durMinutes ||
          systemDefaults?.default_lesson_duration ||
          45,
        task_duration_minutes:
          taskDurMinutes ||
          systemDefaults?.default_task_duration ||
          25,
      });
    }
  } catch (error) {
    console.error("Error fetching existing schedule:", error);
  }
};

  // --- Logic and Handlers ---
  const handleInstanceLessonsChange = (newLessons: Lesson[]) => {
    setInstanceLessons([...newLessons]);
  };
  // Drag and drop handlers for reordering lessons
const handleDragStart = (e: React.DragEvent, index: number) => {
  setDraggedLessonIndex(index);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  if (draggedLessonIndex === null || draggedLessonIndex === index) return;

  const newLessons = [...instanceLessons];
  const draggedLesson = newLessons[draggedLessonIndex];
  
  newLessons.splice(draggedLessonIndex, 1);
  newLessons.splice(index, 0, draggedLesson);
  
  // Update order_index for all lessons
  const reorderedLessons = newLessons.map((lesson, idx) => ({
    ...lesson,
    order_index: idx
  }));

  setInstanceLessons(reorderedLessons);
  setDraggedLessonIndex(index);
};

const handleDragEnd = async () => {
  if (draggedLessonIndex === null) return;

  try {
    // Save new order to database
    const updates = instanceLessons.map((lesson, index) => ({
      id: lesson.id,
      order_index: index
    }));

    for (const update of updates) {
      await supabase
        .from('lessons')
        .update({ order_index: update.order_index })
        .eq('id', update.id);
    }

    toast({ title: "הצלחה", description: "סדר השיעורים עודכן" });
  } catch (error) {
    console.error('Error updating lesson order:', error);
    toast({ title: "שגיאה", description: "שגיאה בעדכון סדר השיעורים", variant: "destructive" });
  }

  setDraggedLessonIndex(null);
};





  useEffect(() => {
    const fetchLessonMode = async () => {
      const { data, error } = await supabase
        .from("course_instances")
        .select("lesson_mode")
        .eq("id", instanceId)
        .single();

      if (error) {
        console.error("Error fetching lesson mode:", error);
        return;
      }

      if (data) {
        console.log('lesson_mode from db : ',data.lesson_mode)
        setLessonMode(data.lesson_mode);
        setIsCombinedMode(data.lesson_mode === "combined");
      }
    };

    if (!instanceId) return;
    fetchLessonMode();
  }, [instanceId]);
   

const copyTemplateLessonsToInstance = () => {
    if (templateLessons.length === 0) {
      toast({ title: "הודעה", description: "אין שיעורי תבנית להעתקה", variant: "default" });
      return;
    }
    setIsCombinedMode(false)
    // if (lessonMode === 'combined') {
    //   toast({ title: "מוד משולב", description: "במוד זה, שיעורי תבנית מוצגים כפי שהם, ללא העתקה. הוסף ייחודיים.", variant: "default" });
    //   return;
    // }
    
    // העתקה רק ל-'custom_only'
    const copiedLessons = templateLessons.map((lesson, index) => ({
      id: `temp-lesson-${Date.now()}-${index}`,
      title: lesson.title,
      description: lesson.description || '',
      order_index: index,
      tasks: lesson.tasks.map((task, taskIndex) => ({
        id: `temp-task-${Date.now()}-${index}-${taskIndex}`,
        title: task.title,
        description: task.description,
        estimated_duration: task.estimated_duration,
        is_mandatory: task.is_mandatory,
        order_index: task.order_index,
      }))
    }));

    setInstanceLessons(copiedLessons);
    setHasCustomLessons(true);
    setLessonMode('custom_only');
    toast({ title: "הצלחה", description: `${copiedLessons.length} שיעורים הועתקו (custom_only)` });
  };


  const startFromScratch = () => {
  setInstanceLessons([]);
  setHasCustomLessons(true);
  setLessonMode('custom_only'); // *** הוסף את זה ***
  toast({ title: "מוכן", description: "כעת תוכל להוסיף שיעורים חדשים" });
};
// במקום שהפונקציות האחרות (אחרי startFromScratch)
const startCombinedMode = () => {
  setInstanceLessons([]); // מתחיל עם רשימה ריקה של שיעורים ייחודיים
  setHasCustomLessons(true);
  setLessonMode('combined'); // *** המפתח כאן ***
  setIsCombinedMode(true);
  toast({
    title: "מצב משולב",
    description: `כעת תוכל להוסיף שיעורים נוספים ל-${templateLessons.length} שיעורי התבנית הקיימים`,
    variant: "default"
  });
};

const resetInstanceLessons = async () => {
  const actualInstanceId = instanceId || editData?.instance_id;

  if (mode === 'edit' && actualInstanceId) {
    // **במצב עריכה - מחק מה-DB וצור מחדש**
    try {
      console.log('[resetInstanceLessons] Starting reset for instance:', actualInstanceId);

      // Step 1: Delete ALL schedules for this course instance
      const { error: schedulesError } = await supabase
        .from('lesson_schedules')
        .delete()
        .eq('course_instance_id', actualInstanceId);

      if (schedulesError) {
        console.error('[resetInstanceLessons] Error deleting schedules:', schedulesError);
        throw schedulesError;
      }

      console.log('[resetInstanceLessons] All schedules deleted');

      // Step 2: Delete the custom lessons
      const { error: lessonsError } = await supabase
        .from('lessons')
        .delete()
        .eq('course_instance_id', actualInstanceId);

      if (lessonsError) throw lessonsError;

      console.log('[resetInstanceLessons] Custom lessons deleted');

      // Step 3: Update lesson_mode to template
      const { error: updateError } = await supabase
        .from('course_instances')
        .update({ lesson_mode: 'template' })
        .eq('id', actualInstanceId);

      if (updateError) {
        console.error('[resetInstanceLessons] Error updating lesson_mode:', updateError);
        throw updateError;
      }

      console.log('[resetInstanceLessons] Updated lesson_mode to template');

      // Step 4: Regenerate physical schedules with template lessons
      try {
        // Fetch the schedule pattern
        const { data: schedulePattern, error: scheduleError } = await supabase
          .from('course_instance_schedules')
          .select(`
            *,
            course_instances:course_instance_id (
              course_id,
              start_date,
              end_date
            )
          `)
          .eq('course_instance_id', actualInstanceId)
          .single();

        if (scheduleError) throw scheduleError;

        if (schedulePattern && schedulePattern.course_instances) {
          // Fetch template lessons
          const { data: templateLessons } = await supabase
            .from('lessons')
            .select('id, title, course_id, order_index, course_instance_id')
            .eq('course_id', schedulePattern.course_instances.course_id)
            .is('course_instance_id', null)
            .order('order_index');

          console.log('[resetInstanceLessons] Template lessons found:', templateLessons?.length || 0);

          if (templateLessons && templateLessons.length > 0) {
            // Generate new physical schedules with template lessons
            const physicalSchedules = await generatePhysicalSchedulesFromPattern(
              {
                id: schedulePattern.id,
                course_instance_id: actualInstanceId,
                days_of_week: schedulePattern.days_of_week,
                time_slots: schedulePattern.time_slots,
                total_lessons: schedulePattern.total_lessons,
                lesson_duration_minutes: schedulePattern.lesson_duration_minutes,
              },
              templateLessons,
              schedulePattern.course_instances.start_date,
              schedulePattern.course_instances.end_date
            );

            console.log('[resetInstanceLessons] Regenerated physical schedules:', physicalSchedules.length);
          }
        }
      } catch (regenerateError) {
        console.error('[resetInstanceLessons] Error regenerating schedules:', regenerateError);
        // Don't fail the whole operation
      }

      // Update UI state
      console.log('[resetInstanceLessons] BEFORE state update - hasCustomLessons:', hasCustomLessons, 'instanceLessons.length:', instanceLessons.length);
      setInstanceLessons([]);
      setHasCustomLessons(false);
      setLessonMode('template');
      setIsCombinedMode(false);
      console.log('[resetInstanceLessons] AFTER state update - State should now be: hasCustomLessons=false, instanceLessons=[], lessonMode=template');

      toast({
        title: "חזרה לברירת מחדל",
        description: "השיעורים והתזמונים חזרו לברירת המחדל של הקורס",
        variant: "default"
      });

    } catch (error) {
      console.error('[resetInstanceLessons] Error resetting lessons:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה בחזרה לברירת מחדל: " + (error?.message || ''),
        variant: "destructive"
      });
    }
  } else {
    // **במצב יצירה - רק ניקוי state**
    setInstanceLessons([]);
    setHasCustomLessons(false);
    setLessonMode('template');
    setIsCombinedMode(false);
    toast({ title: "נוקה", description: "השיעורים הייחודיים הוסרו (לא נשמר עדיין)" });
  }
};
  
  const handleInputChange = (field: string, value: string) => setFormData(prev => ({...prev, [field]: value}));
  
  const toggleDayOfWeek = (dayIndex: number) => {
    setCourseSchedule(prev => {
      const isSelected = prev.days_of_week.includes(dayIndex);
      if (isSelected) {
        return {
          ...prev,
          days_of_week: prev.days_of_week.filter(d => d !== dayIndex),
          time_slots: prev.time_slots.filter(ts => ts.day !== dayIndex),
        };
      } else {
        return {
          ...prev,
          days_of_week: [...prev.days_of_week, dayIndex].sort(),
          time_slots: [...prev.time_slots, { day: dayIndex, start_time: "08:00", end_time: "08:45" }],
        };
      }
    });
  };

  const updateTimeSlot = (dayIndex: number, field: "start_time" | "end_time", value: string) => {
    setCourseSchedule(prev => ({
      ...prev,
      time_slots: prev.time_slots.map(ts => ts.day === dayIndex ? { ...ts, [field]: value } : ts),
    }));
  };

 
const updateClass = (classIdx: number, field: keyof ClassSection, value: any) => {
  setClasses(prev => prev.map((cls, i) => i === classIdx ? { ...cls, [field]: value } : cls));
};

const toggleClassDayOfWeek = (classIdx: number, dayIndex: number) => {
  setClasses(prev => prev.map((cls, i) => {
    if (i !== classIdx) return cls;
    if (cls.days_of_week.includes(dayIndex)) {
      return { ...cls, days_of_week: cls.days_of_week.filter(d => d !== dayIndex), time_slots: cls.time_slots.filter(ts => ts.day !== dayIndex) };
    }
    return { ...cls, days_of_week: [...cls.days_of_week, dayIndex].sort(), time_slots: [...cls.time_slots, { day: dayIndex, start_time: "08:00", end_time: "08:45" }] };
  }));
};

const updateClassTimeSlot = (classIdx: number, dayIndex: number, field: "start_time" | "end_time", value: string) => {
  setClasses(prev => prev.map((cls, i) =>
    i !== classIdx ? cls : { ...cls, time_slots: cls.time_slots.map(ts => ts.day === dayIndex ? { ...ts, [field]: value } : ts) }
  ));
};

const handleCourseAssignment = async (classData?: ClassSection): Promise<string | null> => {
  const gradeLevel = classData?.grade_level ?? formData.grade_level;
  const daysOfWeek = classData?.days_of_week ?? courseSchedule.days_of_week;
  const timeSlotsData = classData?.time_slots ?? courseSchedule.time_slots;
  const lessonDuration = classData?.lesson_duration_minutes ?? courseSchedule.lesson_duration_minutes;
  const doubleLesson = classData?.is_double_lesson ?? isDoubleLesson;

  const finalSchedule = {
    days_of_week: daysOfWeek,
    time_slots: timeSlotsData,
    total_lessons: hasCustomLessons ? instanceLessons.length : templateLessons.length,
    lesson_duration_minutes: lessonDuration,
  };



  try {
    if (mode === 'create') {
      const { data, error } = await supabase
        .from("course_instances")
        .insert([{
            course_id: courseId,
            institution_id: formData.institution_id,
            instructor_id: formData.instructor_id,
            grade_level: gradeLevel,
            max_participants: parseInt(formData.max_participants) || null,
            price_for_customer: parseFloat(formData.price_for_customer) || null,
            price_for_instructor: parseFloat(formData.price_for_instructor) || null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            days_of_week: finalSchedule.days_of_week,
            lesson_mode: lessonMode,
            is_double_lesson: doubleLesson,
            schedule_pattern: {
              time_slots: finalSchedule.time_slots,
              total_lessons: finalSchedule.total_lessons,
              lesson_duration_minutes: finalSchedule.lesson_duration_minutes,
            },
        }])
        .select()
        .single();
      if (error) throw error;
      return data.id;
    } else {
      const { data, error } = await supabase
        .from("course_instances")
        .update({
          institution_id: formData.institution_id,
          instructor_id: formData.instructor_id,
          grade_level: gradeLevel,
          max_participants: parseInt(formData.max_participants) || null,
          price_for_customer: parseFloat(formData.price_for_customer) || null,
          price_for_instructor: parseFloat(formData.price_for_instructor) || null,
          start_date: formData.start_date,
          end_date: formData.end_date || null,
          days_of_week: finalSchedule.days_of_week,
          lesson_mode: lessonMode,
          is_double_lesson: doubleLesson,
          schedule_pattern: {
            time_slots: finalSchedule.time_slots,
            total_lessons: finalSchedule.total_lessons,
            lesson_duration_minutes: finalSchedule.lesson_duration_minutes,
          },
        })
        .eq("id", editData?.instance_id)
        .select()
        .single();
      if (error) throw error;
      return editData?.instance_id || null;
    }
  } catch (error) {
    console.error("Error with course assignment:", error);
    toast({ 
      title: "שגיאה", 
      description: mode === 'create' ? "שגיאה בשיוך התוכנית" : "שגיאה בעדכון התוכנית", 
      variant: "destructive"
    });
    return null;
  }
};
 
  
const saveCourseInstanceSchedule = async (instanceId: string, classData?: ClassSection) => {
  const daysOfWeek = classData?.days_of_week ?? courseSchedule.days_of_week;
  const timeSlotsInput = classData?.time_slots ?? courseSchedule.time_slots;
  const lessonDuration = classData?.lesson_duration_minutes ?? courseSchedule.lesson_duration_minutes;
  try {
    const { data: existingSchedule } = await supabase
      .from("course_instance_schedules")
      .select("*")
      .eq("course_instance_id", instanceId)
      .maybeSingle();

    const adjustedTimeSlots = timeSlotsInput.map(timeSlot => {
      if (!formData.start_date) return timeSlot;

      const startDate = new Date(formData.start_date + 'T00:00:00');
      let targetDate = new Date(startDate);
      
      while (targetDate.getDay() !== timeSlot.day) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const [hours, minutes] = timeSlot.start_time.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);
      
      if (existingSchedule && timeSlot.first_lesson_date) {
        return timeSlot;
      }
      
      if (targetDate.getTime() <= new Date().getTime()) {
        targetDate.setDate(targetDate.getDate() + 7);
      }
      
      return {
        ...timeSlot,
        first_lesson_date: targetDate.toISOString().split('T')[0],
      };
    });

    // ================= START OF FIX =================
    // Correctly calculate total lessons based on the selected mode
    let totalLessonsCount = 0;
    if (lessonMode === 'template') {
      totalLessonsCount = templateLessons.length;
    } else if (lessonMode === 'custom_only') {
      totalLessonsCount = instanceLessons.length;
    } else if (lessonMode === 'combined') {
      totalLessonsCount = templateLessons.length + instanceLessons.length;
    }
    // ================== END OF FIX ==================

    const scheduleData = {
      course_instance_id: instanceId,
      days_of_week: daysOfWeek,
      time_slots: adjustedTimeSlots,
      total_lessons: totalLessonsCount, // Use the corrected count
      lesson_duration_minutes: lessonDuration,
    };

    const { error } = await supabase
      .from("course_instance_schedules")
      .upsert(scheduleData, { onConflict: 'course_instance_id' });

    if (error) throw error;
  } catch (error) {
    throw error;
  }
};



  const saveInstanceLessons = async (assignmentInstanceId: string) => {
    try {
      console.log(`[saveInstanceLessons] START - Syncing unique lessons for instance ${assignmentInstanceId} with mode: ${lessonMode}`);
      console.log(`[saveInstanceLessons] Current instanceLessons:`, instanceLessons.map(l => ({ id: l.id, title: l.title })));

      // This function ONLY manages the UNIQUE lessons ('instanceLessons').
      // The 'combined' view is a display-time concern handled by the assignments page.

      // 1. Get all lesson IDs currently in the DB for this instance
      const { data: dbLessons, error: fetchError } = await supabase
        .from('lessons')
        .select('id, title')
        .eq('course_instance_id', assignmentInstanceId);
      if (fetchError) throw fetchError;
      const dbLessonIds = new Set(dbLessons?.map(l => l.id) || []);
      console.log(`[saveInstanceLessons] Lessons in DB:`, dbLessons?.length || 0, dbLessons?.map(l => ({ id: l.id, title: l.title })));

      // 2. Get all lesson IDs currently in the UI state (excluding new temporary ones)
      const uiLessonIds = new Set(instanceLessons.map(l => l.id).filter(id => id && !id.toString().startsWith('temp-')));
      console.log(`[saveInstanceLessons] Lessons in UI (non-temp IDs):`, uiLessonIds.size, Array.from(uiLessonIds));

      // 3. Find lessons to DELETE (in DB but not in UI)
      const lessonIdsToDelete = [...dbLessonIds].filter(id => !uiLessonIds.has(id));
      console.log(`[saveInstanceLessons] Lessons to DELETE:`, lessonIdsToDelete.length, lessonIdsToDelete);

      if (lessonIdsToDelete.length > 0) {
        console.log(`[saveInstanceLessons] Deleting ${lessonIdsToDelete.length} lessons...`);

        // *** Step 1: Delete ALL schedules linked to these lessons ***
        const { error: deleteSchedulesError } = await supabase
          .from('lesson_schedules')
          .delete()
          .in('lesson_id', lessonIdsToDelete);

        if (deleteSchedulesError) {
          console.error('[saveInstanceLessons] Error deleting schedules for lessons:', deleteSchedulesError);
          throw deleteSchedulesError;
        }

        console.log('[saveInstanceLessons] Schedules deleted for lessons');

        // *** Step 2: Delete ALL tasks linked to these lessons ***
        const { error: deleteTasksError } = await supabase
          .from('lesson_tasks')
          .delete()
          .in('lesson_id', lessonIdsToDelete);

        if (deleteTasksError) {
          console.error('[saveInstanceLessons] Error deleting tasks for lessons:', deleteTasksError);
          throw deleteTasksError;
        }

        console.log('[saveInstanceLessons] Tasks deleted for lessons');

        // *** Step 3: Now we can safely delete the lessons ***
        const { error: deleteError } = await supabase
          .from('lessons')
          .delete()
          .in('id', lessonIdsToDelete);

        if (deleteError) {
          console.error('[saveInstanceLessons] Error deleting lessons:', deleteError);
          throw deleteError;
        }

        console.log('[saveInstanceLessons] Lessons deleted successfully');
      }

      // 4. Separate lessons into UPDATE (existing UUIDs) and INSERT (new temp IDs)
      if (instanceLessons.length > 0) {
        console.log('[saveInstanceLessons] Processing', instanceLessons.length, 'lessons');

        const lessonsToUpdate: any[] = [];
        const lessonsToInsert: any[] = [];

        instanceLessons.forEach((lesson, index) => {
            const { tasks, lesson_tasks, ...rest } = lesson;

            const lessonData: any = {
                course_id: courseId || editData?.course_id,
                course_instance_id: assignmentInstanceId,
                title: rest.title,
                description: rest.description,
                order_index: (lessonMode === 'combined' ? templateLessons.length : 0) + index,
                scheduled_start: lesson.scheduled_start || new Date().toISOString(),
                scheduled_end: lesson.scheduled_end || new Date().toISOString(),
            };

            // Check if this is an existing lesson (valid UUID) or new lesson (temp ID)
            const isUUID = rest.id && typeof rest.id === 'string' && rest.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

            if (isUUID) {
                // Existing lesson - UPDATE
                lessonData.id = rest.id;
                lessonsToUpdate.push(lessonData);
                console.log(`[saveInstanceLessons] ✅ Lesson ${index} will be UPDATED (UUID: ${rest.id})`);
            } else {
                // New lesson - INSERT (no id field, let DB generate UUID)
                lessonsToInsert.push(lessonData);
                console.log(`[saveInstanceLessons] ✅ Lesson ${index} will be INSERTED (temp id: ${rest.id})`);
            }
        });

        console.log('[saveInstanceLessons] Will UPDATE:', lessonsToUpdate.length, 'lessons');
        console.log('[saveInstanceLessons] Will INSERT:', lessonsToInsert.length, 'lessons');

        let savedLessons: any[] = [];

        // 5a. UPDATE existing lessons
        if (lessonsToUpdate.length > 0) {
          console.log('[saveInstanceLessons] Updating existing lessons...');
          const { data: updatedLessons, error: updateError } = await supabase
            .from('lessons')
            .upsert(lessonsToUpdate, { onConflict: 'id' })
            .select('id, title');

          if (updateError) {
            console.error('[saveInstanceLessons] ❌ UPDATE ERROR:', updateError);
            throw updateError;
          }

          savedLessons.push(...(updatedLessons || []));
          console.log('[saveInstanceLessons] ✅ Updated', updatedLessons?.length, 'lessons');
        }

        // 5b. INSERT new lessons
        if (lessonsToInsert.length > 0) {
          console.log('[saveInstanceLessons] Inserting new lessons...');
          const { data: insertedLessons, error: insertError } = await supabase
            .from('lessons')
            .insert(lessonsToInsert)
            .select('id, title');

          if (insertError) {
            console.error('[saveInstanceLessons] ❌ INSERT ERROR:', insertError);
            throw insertError;
          }

          savedLessons.push(...(insertedLessons || []));
          console.log('[saveInstanceLessons] ✅ Inserted', insertedLessons?.length, 'lessons');
        }

        console.log('[saveInstanceLessons] ✅ Total saved lessons:', savedLessons.length);

        // 6. Sync tasks for the saved lessons
        if (savedLessons && savedLessons.length > 0) {
            const lessonIdMap = new Map(savedLessons.map(l => [l.title, l.id]));
            const allTasksToInsert = [];
            
            // Collect all tasks from the UI
            for (const uiLesson of instanceLessons) {
                const dbLessonId = lessonIdMap.get(uiLesson.title);
                if (dbLessonId && uiLesson.tasks?.length > 0) {
                    uiLesson.tasks.forEach((task, taskIndex) => {
                        const { id, ...restOfTask } = task; // Remove temp ID
                        allTasksToInsert.push({
                            ...restOfTask,
                            lesson_id: dbLessonId,
                            order_index: taskIndex,
                        });
                    });
                }
            }

            // Delete all old tasks for these lessons
            const savedLessonIds = savedLessons.map(l => l.id);
            if (savedLessonIds.length > 0) {
              const { error: deleteTasksError } = await supabase
                  .from('lesson_tasks')
                  .delete()
                  .in('lesson_id', savedLessonIds);
              if (deleteTasksError) throw deleteTasksError;
            }
            
            // Insert the new set of tasks
            if (allTasksToInsert.length > 0) {
                const { error: insertTasksError } = await supabase
                    .from('lesson_tasks')
                    .insert(allTasksToInsert);
                if (insertTasksError) throw insertTasksError;
            }
        }
      }
      console.log(`✅ Successfully synced unique lessons for instance.`);
    } catch (error) {
      console.error('❌ Error in saveInstanceLessons:', error);
      toast({
        title: "שגיאה קריטית",
        description: "לא ניתן היה לסנכרן את השיעורים הייחודיים.",
        variant: "destructive",
      });
      throw error;
    }
  };



const handleFinalSave = async () => {
  setLoading(true);
  try {
    console.log('[handleFinalSave] START - lessonMode:', lessonMode, 'hasCustomLessons:', hasCustomLessons, 'instanceLessons.length:', instanceLessons.length);

    const runForClass = async (classData?: ClassSection) => {
      // שלב 1: שמור/עדכן את ההקצאה
      const newInstanceId = await handleCourseAssignment(classData);
      if (!newInstanceId) throw new Error("Failed to create or update course instance.");
      console.log("[handleFinalSave] Course instance saved with ID:", newInstanceId, "lesson_mode:", lessonMode);

      // שלב 2: שמור את לוח הזמנים
      await saveCourseInstanceSchedule(newInstanceId, classData);

      // *** שלב 2.5: טיפול בשיעורים ייחודיים ***
      console.log('[handleFinalSave] Checking lesson mode - lessonMode:', lessonMode, 'hasCustomLessons:', hasCustomLessons, 'instanceLessons.length:', instanceLessons.length);

      if (lessonMode === 'template') {
        // אם המצב הוא 'template', מחק את כל השיעורים הייחודיים (אם קיימים)
        console.log('[handleFinalSave] Mode is TEMPLATE - ensuring no custom lessons exist in DB');
        try {
          const { data: existingLessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('course_instance_id', newInstanceId);

          if (existingLessons && existingLessons.length > 0) {
            console.log('[handleFinalSave] Found', existingLessons.length, 'custom lessons to delete for template mode');
            const lessonIds = existingLessons.map(l => l.id);
            await supabase.from('lesson_schedules').delete().in('lesson_id', lessonIds);
            await supabase.from('lesson_tasks').delete().in('lesson_id', lessonIds);
            await supabase.from('lessons').delete().eq('course_instance_id', newInstanceId);
            console.log('[handleFinalSave] ✅ Deleted all custom lessons for template mode');
          } else {
            console.log('[handleFinalSave] ✅ No custom lessons to delete (already clean)');
          }
        } catch (error) {
          console.error('[handleFinalSave] Error cleaning custom lessons for template mode:', error);
        }
      } else if (hasCustomLessons && instanceLessons.length > 0) {
        console.log('[handleFinalSave] ✅ WILL SAVE instance lessons. Lessons:', instanceLessons.map(l => ({ id: l.id, title: l.title })));
        await saveInstanceLessons(newInstanceId);
        console.log('[handleFinalSave] Instance lessons saved successfully');
      } else {
        console.log('[handleFinalSave] ❌ No instance lessons to save');
      }

      // שלב 3: Generate/Update physical schedules (אחרי שהשיעורים נשמרו!)
      try {
        const { data: schedulePattern, error: scheduleError } = await supabase
          .from('course_instance_schedules')
          .select(`
            *,
            course_instances:course_instance_id (
              course_id,
              start_date,
              end_date,
              lesson_mode
            )
          `)
          .eq('course_instance_id', newInstanceId)
          .maybeSingle();

        if (scheduleError) throw scheduleError;

        if (schedulePattern) {
          const currentLessonMode = schedulePattern.course_instances.lesson_mode || lessonMode;

          const { data: instLessons } = await supabase
            .from('lessons')
            .select('id, title, course_id, order_index, course_instance_id')
            .eq('course_instance_id', newInstanceId)
            .order('order_index');

          const { data: templLessons } = await supabase
            .from('lessons')
            .select('id, title, course_id, order_index, course_instance_id')
            .eq('course_id', schedulePattern.course_instances.course_id)
            .is('course_instance_id', null)
            .order('order_index');

          console.log('[CourseAssignDialog] Fetched lessons - instLessons:', instLessons?.length || 0, 'templLessons:', templLessons?.length || 0);

          let lessonsForScheduling: any[] = [];
          switch (currentLessonMode) {
            case 'custom_only':
              lessonsForScheduling = instLessons || [];
              console.log('[CourseAssignDialog] Using custom_only lessons:', lessonsForScheduling.length);
              break;
            case 'combined':
              lessonsForScheduling = [...(templLessons || []), ...(instLessons || [])]
                .sort((a, b) => a.order_index - b.order_index);
              console.log('[CourseAssignDialog] Using combined lessons:', lessonsForScheduling.length);
              break;
            case 'template':
            default:
              lessonsForScheduling = templLessons || [];
              console.log('[CourseAssignDialog] Using template lessons:', lessonsForScheduling.length);
              break;
          }

          if (lessonsForScheduling.length > 0) {
            if (mode === 'edit') {
              console.log('[CourseAssignDialog] Updating physical schedules...');
              const result = await updatePhysicalSchedules(schedulePattern.id, newInstanceId);
              console.log('[CourseAssignDialog] Update result:', result.message);
            } else {
              console.log('[CourseAssignDialog] Generating physical schedules...');
              const physicalSchedules = await generatePhysicalSchedulesFromPattern(
                {
                  id: schedulePattern.id,
                  course_instance_id: newInstanceId,
                  days_of_week: schedulePattern.days_of_week,
                  time_slots: schedulePattern.time_slots,
                  total_lessons: schedulePattern.total_lessons,
                  lesson_duration_minutes: schedulePattern.lesson_duration_minutes,
                },
                lessonsForScheduling,
                schedulePattern.course_instances.start_date,
                schedulePattern.course_instances.end_date
              );
              console.log('[CourseAssignDialog] Generated physical schedules:', physicalSchedules.length);
            }
          } else {
            console.warn('[CourseAssignDialog] No lessons found for scheduling! lessonMode:', currentLessonMode);
          }
        }
      } catch (physicalScheduleError) {
        console.error('[CourseAssignDialog] Error with physical schedules:', physicalScheduleError);
        toast({
          title: "אזהרה",
          description: "לוח הזמנים נשמר אך היה שגיאה ביצירת לוחות הזמנים הפיזיים",
          variant: "destructive"
        });
      }
    };

    if (mode === 'edit') {
      await runForClass();
    } else {
      for (const cls of classes) {
        await runForClass(cls);
      }
    }

    // שלב 4: הודעת הצלחה
    if (hasCustomLessons && instanceLessons.length > 0) {
      toast({
        title: "הצלחה",
        description: `ההקצאה נשמרה עם ${instanceLessons.length} שיעורים ייחודיים!`,
        variant: "default"
      });
    } else {
      toast({
        title: "הצלחה",
        description: mode === 'edit' ? "התוכנית עודכנה בהצלחה!" : classes.length > 1 ? `נוצרו ${classes.length} הקצאות בהצלחה!` : "התוכנית נוצרה בהצלחה!",
        variant: "default"
      });
    }

    onAssignmentComplete();
    onOpenChange(false);
  } catch (error) {
    console.error("Error saving:", error);
    toast({
      title: "שגיאה",
      description: "אירעה שגיאה בשמירה",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};





  const renderCourseAssignmentStep = () => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const missingFields = [];
        if (!formData.institution_id) missingFields.push("מוסד");
        if (!formData.instructor_id) missingFields.push("מדריך");
        if (mode === 'edit' && !formData.grade_level.trim()) missingFields.push("כיתה");
        if (missingFields.length > 0) {
          toast({ title: "שגיאה בטופס", description: `חסרים שדות חובה: ${missingFields.join(", ")}`, variant: "destructive" });
          return;
        }
        setStep(2);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="institution">מוסד חינוכי</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setShowAddInstitution(true)}
            >
              + הוסף מוסד
            </Button>
          </div>
          <Select value={formData.institution_id} onValueChange={(value) => handleInputChange("institution_id", value)}>
            <SelectTrigger><SelectValue placeholder="בחר מוסד חינוכי" /></SelectTrigger>
            <SelectContent>
              {institutions.map((institution) => (<SelectItem key={institution.id} value={institution.id}>{institution.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructor">מדריך</Label>
          <Select value={formData.instructor_id} onValueChange={(value) => handleInputChange("instructor_id", value)}>
            <SelectTrigger><SelectValue placeholder="בחר מדריך" /></SelectTrigger>
            <SelectContent>
              {instructors.map((instructor) => (<SelectItem key={instructor.id} value={instructor.id}>{instructor.full_name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {mode === 'edit' && (
          <div className="space-y-2">
            <Label htmlFor="grade_level">כיתה</Label>
            <Input id="grade_level" value={formData.grade_level} onChange={(e) => handleInputChange("grade_level", e.target.value)} placeholder="למשל: כיתה ז'"/>
          </div>
        )}
{isAdmin &&<>  
        <div className="space-y-2">
          <Label htmlFor="price_for_customer">מחיר ללקוח</Label>
          <Input id="price_for_customer" type="number" disabled={!isAdmin} value={formData.price_for_customer} onChange={(e) => handleInputChange("price_for_customer", e.target.value)} placeholder="מחיר בשקלים"/>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price_for_instructor">מחיר למדריך</Label>
          <Input id="price_for_instructor" type="number"  disabled={!isAdmin} value={formData.price_for_instructor} onChange={(e) => handleInputChange("price_for_instructor", e.target.value)} placeholder="מחיר בשקלים"/>
        </div>
            </>}



     <div className="space-y-2">
  <Label htmlFor="start_date">תאריך התחלה</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className="w-full justify-start text-right font-normal"
      >
        <CalendarIcon className="ml-2 h-4 w-4" />
        {formData.start_date ? (
          formatDate(new Date(formData.start_date), "dd/MM/yyyy")
        ) : (
          <span>בחר תאריך התחלה</span>
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={formData.start_date ? new Date(formData.start_date) : undefined}
        onSelect={(date) => {
          if (date) {
            handleInputChange("start_date", date.toLocaleDateString('en-CA'));
          }
        }}
        disabled={(date) => {
  const formatDate = (d: Date) => {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  };

  const dateStr = formatDate(date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return  disabledDates.some(disabledDate =>
    formatDate(disabledDate) === dateStr
  );
}}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>
      <div className="space-y-2">
  <Label htmlFor="end_date">תאריך סיום</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className="w-full justify-start text-right font-normal"
      >
        <CalendarIcon className="ml-2 h-4 w-4" />
        {formData.end_date ? (
          formatDate(new Date(formData.end_date), "dd/MM/yyyy")
        ) : (
          <span>בחר תאריך סיום</span>
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={formData.end_date ? new Date(formData.end_date) : undefined}
        onSelect={(date) => {
          if (date) {
            handleInputChange("end_date", date.toLocaleDateString('en-CA'));
          }
        }}
        disabled={(date) => {
          const dateStr = date.toISOString().split('T')[0];
          const startDate = formData.start_date ? new Date(formData.start_date) : new Date();
          
          return  disabledDates.some(disabledDate => 
            disabledDate.toISOString().split('T')[0] === dateStr
          );
        }}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>
</div>
      <DialogFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
        <Button type="submit" disabled={loading}>{loading ? (mode === 'edit' ? "מעדכן..." : "משייך...") : "המשך לתזמון"}</Button>
      </DialogFooter>
    </form>
  );


// Replace the existing renderSchedulingStep function with this one
const renderSchedulingStep = () => {
    // Logic to determine which lessons to display based on the mode
    const lessonsToDisplay = isCombinedMode
      ? [...templateLessons, ...instanceLessons]
      : (hasCustomLessons ? instanceLessons : templateLessons);

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600 mb-4">
          הגדר את לוח הזמנים הכללי עבור התוכנית "{courseName}"
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900 mb-2">שיעורים ייחודיים להקצאה</h3>
              <p className="text-sm text-purple-700 mb-3">
                {hasCustomLessons
                  ? `יש ${instanceLessons.length} שיעורים ייחודיים להקצאה זו`
                  : "השתמש בשיעורי התבנית או צור שיעורים ייחודיים להקצאה זו"
                }
              </p>
              <div className="flex items-center gap-2">
                {hasCustomLessons ? (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200"><Settings className="h-3 w-3 mr-1" />שיעורים מותאמים</Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100 text-gray-700"><BookOpen className="h-3 w-3 mr-1" />תבנית סטנדרטית</Badge>
                )}
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowCustomLessonsDialog(true)} className="border-purple-300 text-purple-700 hover:bg-purple-100">
              <Settings className="h-4 w-4 mr-2" />
              נהל שיעורים
            </Button>
          </div>

          {/* Switch for Combined Mode - Conditionally rendered */}
          {hasCustomLessons && (
            <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-purple-200" dir="rtl">
              {/* <Label htmlFor="combined-mode-switch" className="mr-2 text-purple-800">הצג במצב משולב (עם התבנית)</Label> */}
              <Switch
                id="combined-mode-switch"
                checked={false}
                onCheckedChange={setIsCombinedMode}
              />
            </div>
          )}
        </div>

        {lessonsToDisplay.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
            <h3 className="font-semibold text-blue-900 mb-3">
              שיעורים בתוכנית ({lessonsToDisplay.length})
            </h3>
            <div className="space-y-4">
              {lessonsToDisplay.map((lesson, index) => (
                <div key={lesson.id || `lesson-${index}`} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-blue-800">
                      <span className="font-medium">{index + 1}.</span> {lesson.title}
                    </div>
                    {lesson.tasks && lesson.tasks.length > 0 && (
                      <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded">{lesson.tasks.length} משימות</span>
                    )}
                  </div>
                  {lesson.tasks && lesson.tasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {lesson.tasks.sort((a, b) => a.order_index - b.order_index).map((task, taskIndex) => (
                        <div key={task.id || `task-${taskIndex}`} className="bg-gray-50 p-2 rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-700">{task.title}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{task.estimated_duration} דק'</span>
                              {task.is_mandatory ? (<span className="bg-red-100 text-red-600 px-1 py-0.5 rounded text-xs">חובה</span>) : (<span className="bg-gray-100 text-gray-600 px-1 py-0.5 rounded text-xs">רשות</span>)}
                            </div>
                          </div>
                          {task.description && (<p className="text-gray-600 text-xs">{task.description}</p>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {formData.start_date && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">תקופת הקורס:</span>{" "}
              {formatDate(new Date(formData.start_date), "dd/MM/yyyy")}
              {formData.end_date && ` - ${formatDate(new Date(formData.end_date), "dd/MM/yyyy")}`}
            </div>
          </div>
        )}

        {mode === 'edit' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ימים בשבוע</Label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox id={`day-${index}`} checked={courseSchedule.days_of_week.includes(index)} onCheckedChange={() => toggleDayOfWeek(index)} />
                    <Label htmlFor={`day-${index}`} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </div>
            {courseSchedule.days_of_week.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">זמנים לכל יום:</Label>
                {courseSchedule.days_of_week.sort().map((dayIndex) => {
                  const timeSlot = courseSchedule.time_slots.find(ts => ts.day === dayIndex);
                  return (
                    <div key={dayIndex} className="border rounded p-3 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <span className="min-w-[60px] text-sm font-medium">{dayNames[dayIndex]}:</span>
                        <div className="flex gap-2 flex-1">
                          <div className="flex-1">
                            <Label className="text-xs">התחלה</Label>
                            <Input type="time" value={timeSlot?.start_time || ""} onChange={(e) => updateTimeSlot(dayIndex, "start_time", e.target.value)} className="text-sm" />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">סיום</Label>
                            <Input type="time" value={timeSlot?.end_time || ""} onChange={(e) => updateTimeSlot(dayIndex, "end_time", e.target.value)} className="text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_lessons">מספר מפגשים כולל</Label>
                <Input id="total_lessons" type="number" value={lessonsToDisplay.length} readOnly className="bg-gray-100 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson_duration">משך שיעור (דקות)</Label>
                <Input id="lesson_duration" type="number" min="15" step="15" value={courseSchedule.lesson_duration_minutes || ""} onChange={(e) => setCourseSchedule(prev => ({ ...prev, lesson_duration_minutes: parseInt(e.target.value) }))} placeholder="45" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="is_double_lesson" checked={isDoubleLesson} onCheckedChange={(val) => setIsDoubleLesson(!!val)} />
                <Label htmlFor="is_double_lesson" className="cursor-pointer">שיעור כפול (90 דקות)</Label>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map((cls, classIdx) => (
              <div key={classIdx} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">כיתה {classIdx + 1}</span>
                  {classes.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-6 px-2"
                      onClick={() => setClasses(prev => prev.filter((_, i) => i !== classIdx))}>×</Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>שם כיתה</Label>
                  <Input value={cls.grade_level} onChange={(e) => updateClass(classIdx, 'grade_level', e.target.value)} placeholder="כיתה ז'" />
                </div>
                <div className="space-y-2">
                  <Label>ימים בשבוע</Label>
                  <div className="flex flex-wrap gap-2">
                    {dayNames.map((day, dayIdx) => (
                      <div key={dayIdx} className="flex items-center space-x-2">
                        <Checkbox id={`cls-${classIdx}-day-${dayIdx}`} checked={cls.days_of_week.includes(dayIdx)} onCheckedChange={() => toggleClassDayOfWeek(classIdx, dayIdx)} />
                        <Label htmlFor={`cls-${classIdx}-day-${dayIdx}`} className="text-sm">{day}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                {cls.days_of_week.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">זמנים לכל יום:</Label>
                    {cls.days_of_week.slice().sort().map(dayIdx => {
                      const timeSlot = cls.time_slots.find(ts => ts.day === dayIdx);
                      return (
                        <div key={dayIdx} className="border rounded p-3 bg-gray-50">
                          <div className="flex items-center gap-4">
                            <span className="min-w-[60px] text-sm font-medium">{dayNames[dayIdx]}:</span>
                            <div className="flex gap-2 flex-1">
                              <div className="flex-1">
                                <Label className="text-xs">התחלה</Label>
                                <Input type="time" value={timeSlot?.start_time || ""} onChange={(e) => updateClassTimeSlot(classIdx, dayIdx, "start_time", e.target.value)} className="text-sm" />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">סיום</Label>
                                <Input type="time" value={timeSlot?.end_time || ""} onChange={(e) => updateClassTimeSlot(classIdx, dayIdx, "end_time", e.target.value)} className="text-sm" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מספר מפגשים כולל</Label>
                    <Input type="number" value={lessonsToDisplay.length} readOnly className="bg-gray-100 cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label>משך שיעור (דקות)</Label>
                    <Input type="number" min="15" step="15" value={cls.lesson_duration_minutes || ""} placeholder="45"
                      onChange={(e) => updateClass(classIdx, 'lesson_duration_minutes', parseInt(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox id={`cls-${classIdx}-double`} checked={cls.is_double_lesson}
                      onCheckedChange={(val) => updateClass(classIdx, 'is_double_lesson', !!val)} />
                    <Label htmlFor={`cls-${classIdx}-double`} className="cursor-pointer">שיעור כפול (90 דקות)</Label>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full"
              onClick={() => setClasses(prev => {
                const first = prev[0];
                return [...prev, {
                  grade_level: '',
                  days_of_week: first.days_of_week,
                  time_slots: first.days_of_week.map(day => ({
                    day,
                    start_time: "08:00",
                    end_time: "08:45",
                  })),
                  lesson_duration_minutes: first.lesson_duration_minutes,
                  is_double_lesson: false,
                }];
              })}>
              + הוסף כיתה
            </Button>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>חזור</Button>
          <Button onClick={handleFinalSave} disabled={loading}>{loading ? "יוצר..." : "צור הקצאה "}</Button>
        </DialogFooter>
      </div>
    );
};




const renderCustomLessonsDialog = () => (
  <Dialog open={showCustomLessonsDialog} onOpenChange={setShowCustomLessonsDialog}>
    <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>ניהול שיעורים ייחודיים להקצאה</DialogTitle>
        <DialogDescription>
          צור או ערוך שיעורים ומשימות ייחודיים עבור הקצאה זו. השינויים לא ישפיעו על תבנית הקורס המקורית.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Header with lesson mode info */}
        <div className="flex justify-between items-center bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              {hasCustomLessons ? "שיעורים ייחודיים פעילים" : "אין שיעורים ייחודיים"}
            </h3>
            <p className="text-sm text-blue-700">
              {hasCustomLessons 
                ? `יש ${instanceLessons.length} שיעורים ייחודיים להקצאה זו` 
                : "בחר אחת מהאפשרויות להתחלה"}
            </p>
          </div>
          <div className="flex gap-2">
            {hasCustomLessons && (
              <>
                   <Button type="button"  onClick={() => { setLessonMode("template");
                    setHasCustomLessons(false); setStep(2); setShowCustomLessonsDialog(false); console.log("lessonMode",lessonMode);}}>
            חזרה לברירת מחדל    
            </Button>
                <Button type="button" variant="destructive" onClick={() =>  {setShowDeleteConfirmation(true) }}>
                  מחק הכל
                </Button>
            
                {/* כפתור למצב משולב */}
                <Button 
                  type="button" 
                  variant={lessonMode === 'combined' ? 'default' : 'outline'}
                  onClick={() => {
                    console.log('lessonMODE',lessonMode)
                    if (lessonMode === 'combined') {
                      setLessonMode('custom_only');
                      setIsCombinedMode(false);
                      toast({ 
                        title: "מצב ייחודי", 
                        description: "מוצגים רק שיעורים ייחודיים" 
                      });
                    } else {
                      setLessonMode('combined');
                      setIsCombinedMode(true);
                      toast({ 
                        title: "מצב משולב", 
                        description: "מוצגים גם שיעורי תבנית וגם שיעורים ייחודיים" 
                      });
                    }
                  }}
                  className={lessonMode === 'combined' ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-500 text-purple-700'}
                >
                  {lessonMode === 'combined' ? '✓ מצב משולב פעיל' : 'שלב עם תבנית'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* אינדיקטור למצב משולב */}
        {lessonMode === 'combined' && (
          <Alert className="bg-purple-50 border-purple-200">
            <AlertDescription className="text-purple-900">
              <strong>מצב משולב פעיל:</strong> בתזמון יוצגו גם {templateLessons.length} שיעורי תבנית וגם {instanceLessons.length} שיעורים ייחודיים (סה"כ {templateLessons.length + instanceLessons.length} שיעורים)
            </AlertDescription>
          </Alert>
        )}

        {hasCustomLessons ? (
          <div className="space-y-4">
            {/* Drag and Drop Reorder Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">סדר השיעורים הייחודיים (גרור לשינוי)</h4>
              <div className="space-y-2">
                {instanceLessons.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-move hover:border-blue-400 transition-colors ${
                      draggedLessonIndex === index ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {index + 1}. {lesson.title}
                      </div>
                      {lesson.description && (
                        <div className="text-sm text-gray-600">{lesson.description}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {lesson.tasks.length} משימות
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lesson Management Section */}
            <CourseLessonsSection 
              instanceId={instanceId} 
              lessons={instanceLessons} 
              onLessonsChange={handleInstanceLessonsChange} 
              courseStartDate={formData.start_date} 
              courseEndDate={formData.end_date} 
            />
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">התחל ליצור שיעורים ייחודיים</h3>
            <p className="text-gray-600 mb-6">בחר אחת משלוש האפשרויות:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {/* אפשרות 1: העתקה מלאה */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-green-400 transition-colors">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">העתק מתבנית </h4>
                  <p className="text-sm text-gray-600 text-center">
                    העתק את כל שיעורי התבנית כנקודת התחלה לעריכה
                  </p>
                  <Button 
                    type="button" 
                    onClick={copyTemplateLessonsToInstance}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    העתק מתבנית
                  </Button>
                </div>
              </div>

              {/* אפשרות 2: התחלה מאפס */}
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Plus className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">התחל מאפס</h4>
                  <p className="text-sm text-gray-600 text-center">
                    צור שיעורים חדשים לחלוטין ללא קשר לתבנית
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={startFromScratch}
                    className="w-full border-blue-500 text-blue-700 hover:bg-blue-50"
                  >
                    התחל מאפס
                  </Button>
                </div>
              </div>

              {/* אפשרות 3: הוספה לתבנית - החדש! */}
              <div className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 transition-colors">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Layers className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">הוסף לתבנית</h4>
                  <p className="text-sm text-gray-600 text-center">
                    שמור על {templateLessons.length} שיעורי תבנית והוסף שיעורים ייחודיים
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={startCombinedMode}
                    className="w-full border-purple-500 text-purple-700 hover:bg-purple-50"
                  >
                    הוסף לתבנית
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCustomLessonsDialog(false)}
        >
          שמור שינויים
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
  return (
    <>
    {/* debug */}
      {/* {scheduleWarnings.length > 0 && (
  <Alert variant="destructive" className="mb-4">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      <div className="space-y-1">
        <p className="font-medium">בעיות בלוח הזמנים:</p>
        {scheduleWarnings.map((warning, index) => (
          <p key={index} className="text-sm">• {warning}</p>
        ))}
      </div>
    </AlertDescription>
  </Alert>
)} */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 1 ? (mode === 'edit' ? "עריכת הקצאת תוכנית" : "שיוך תוכנית לימוד") : "הגדרת לוח זמנים"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? (mode === 'edit' ? `עריכת הקצאת התוכנית "${editData?.name || courseName}"` : `שיוך התוכנית "${courseName}" למדריך, כיתה ומוסד לימודים`) : `הגדרת לוח הזמנים הכללי עבור התוכנית "${courseName}"`}
            </DialogDescription>
          </DialogHeader>
          {step === 1 ? renderCourseAssignmentStep() : renderSchedulingStep()}
        </DialogContent>
      </Dialog>
      {renderCustomLessonsDialog()}
      <AddInstitutionModal
        open={showAddInstitution}
        onOpenChange={setShowAddInstitution}
        onSaved={async (newInstitution) => {
          await fetchInstitutions();
          handleInputChange("institution_id", newInstitution.id);
        }}
      />
    </>
  );
};

export default CourseAssignDialog;