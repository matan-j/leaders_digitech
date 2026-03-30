import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CourseDetailsForm from './course/CourseDetailsForm';
import CourseLessonsSection, { Lesson } from './course/CourseLessonsSection';
import { useCourseSubmit } from './course/useCourseSubmit';
import { supabase } from '@/integrations/supabase/client';

interface CourseCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCourseCreated: () => void;
  editCourse?: {
    id: string;
    instance_id:string;
    name: string;
    grade_level: string;
    max_participants: number;
    price_per_lesson: number;
    tasks: any[];
    start_date:string;
    approx_end_date:string;
    school_type?: string;
  } | null;
  
}

const CourseCreateDialog = ({ open, onOpenChange, onCourseCreated, editCourse }: CourseCreateDialogProps) => {
  const { loading, handleSubmit } = useCourseSubmit(onCourseCreated, onOpenChange);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    school_type: '',
    presentation_link: '',
    program_link: '',
    color: '#574a7a',
  });

  useEffect(() => {
    if (open) {
      if (editCourse) {
        // Pre-fill form with existing course data
        setFormData({
          name: editCourse.name,
          school_type: editCourse.school_type || '',
          presentation_link: (editCourse as any).presentation_link || '',
          program_link: (editCourse as any).program_link || '',
          color: (editCourse as any).color || '#574a7a',
        });
        
        loadExistingLessons(editCourse.id);
      } else {
        // Reset form for new course
        setFormData({
          name: '',
          school_type: '',
          presentation_link: '',
          program_link: '',
          color: '#574a7a',
        });
        setLessons([]);
      }
    }
  }, [open, editCourse]);

  const loadExistingLessons = async (courseId: string) => {
    try {
      // Try to load lessons directly using the courseId first (it might be a course_id already)
      let actualCourseId = courseId;
      
      // If that fails, try getting the course_id from course_instances
      let { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          order_index,
          description,
          lesson_tasks (
            id,
            title,
            description,
            estimated_duration,
            is_mandatory,
            order_index
          )
        `)
        .eq('course_id', actualCourseId)
         .is('course_instance_id', null)  
        .order('order_index');

      // If no lessons found, try to get course_id from instance_id
      if (!lessonsData || lessonsData.length === 0) {
        const { data: instanceData, error: instanceError } = await supabase
          .from('course_instances')
          .select('course_id')
          .eq('id', courseId)
          .single();

        if (!instanceError && instanceData) {
          actualCourseId = instanceData.course_id;
          
          const { data: retryLessonsData, error: retryLessonsError } = await supabase
            .from('lessons')
            .select(`
              id,
              title,
              order_index,
              description,
              lesson_tasks (
                id,
                title,
                description,
                estimated_duration,
                is_mandatory,
                order_index
              )
            `)
            .eq('course_id', actualCourseId)
            .order('order_index');
            
          lessonsData = retryLessonsData;
          lessonsError = retryLessonsError;
        }
      }

      if (lessonsError) throw lessonsError;

      const formattedLessons = lessonsData.map(lesson => ({
        id: lesson.id, // Preserve real database IDs
        title: lesson.title,
         description: lesson.description,
        tasks: lesson.lesson_tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          estimated_duration: task.estimated_duration,
          is_mandatory: task.is_mandatory,
          order_index: task.order_index
        })).sort((a, b) => a.order_index - b.order_index)
      }));

      console.log('Successfully loaded lessons with real IDs:', formattedLessons);
      setLessons(formattedLessons);
    } catch (error) {
      console.error('Error loading existing lessons:', error);
      // Only use fallback if we have no other choice AND tasks have real lesson_ids
      if (editCourse?.tasks) {
        console.warn('Using fallback lesson loading - this may cause duplication issues');
        const lessonsMap = new Map();

        editCourse.tasks.forEach(task => {
          // Only use task.lesson_id if it exists and is a real database ID (not temporary)
          const lessonId = (task.lesson_id && !task.lesson_id.startsWith('lesson-')) 
            ? task.lesson_id 
            : `fallback-lesson-${task.lesson_number}`;

          if (!lessonsMap.has(lessonId)) {
            lessonsMap.set(lessonId, {
              id: lessonId,
              title: task.lesson_title || `שיעור ${task.lesson_number}`,
              tasks: []
            });
          }

          lessonsMap.get(lessonId).tasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            estimated_duration: task.estimated_duration,
            is_mandatory: task.is_mandatory,
            order_index: task.order_index
          });
        });

        const formattedLessons = Array.from(lessonsMap.values());
        setLessons(formattedLessons);
      } else {
        // If all else fails, set empty lessons array
        console.warn('No lessons could be loaded for course:', courseId);
        setLessons([]);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      alert('נא להזין שם תוכנית לימוד');
      return;
    }
    
    if (!formData.school_type) {
      alert('נא לבחור סוג בית ספר');
      return;
    }
    
    await handleSubmit(formData, lessons, editCourse?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editCourse ? 'עריכת תוכנית לימוד' : 'יצירת תוכנית לימוד חדשה'}</DialogTitle>
          <DialogDescription>{editCourse ? 'ערוך את פרטי תוכנית הלימוד' : 'מלא את הפרטים כדי ליצור תוכנית לימוד חדשה'}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lessons">שיעורים ומשימות</TabsTrigger>
               <TabsTrigger value="details">פרטי התוכנית</TabsTrigger>

            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <CourseDetailsForm
                formData={formData}
                onInputChange={handleInputChange}
              />
            </TabsContent>

            <TabsContent value="lessons" className="space-y-4">
              <CourseLessonsSection lessons={lessons} onLessonsChange={setLessons} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (editCourse ? 'מעדכן...' : 'יוצר...') : (editCourse ? 'עדכן תוכנית לימוד' : 'צור תוכנית לימוד')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CourseCreateDialog;