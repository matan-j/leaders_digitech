// useCourseSubmit.ts
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { Lesson } from './CourseLessonsSection';

export function useCourseSubmit(onCourseCreated: () => void, onClose: (open: boolean) => void) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: any, lessons: Lesson[], editCourseId?: string) => {
    setLoading(true);
    try {
      let courseId: string;

      if (editCourseId) {
        // Update the course name and school_type directly using the course_id
        const { error: courseError } = await supabase
          .from('courses')
          .update({
            name: formData.name,
            school_type: formData.school_type,
            presentation_link: formData.presentation_link || null,
            program_link: formData.program_link || null,
          })
          .eq('id', editCourseId);

        if (courseError) throw courseError;
        
        courseId = editCourseId;
        await updateExistingLessonsAndTasks(courseId, lessons);
      } else {
        // Create new course
        const { data: savedCourse, error: courseError } = await supabase
          .from('courses')
          .insert({
            name: formData.name,
            school_type: formData.school_type,
            presentation_link: formData.presentation_link || null,
            program_link: formData.program_link || null,
          })
          .select('id')
          .single();

        if (courseError) throw courseError;
        courseId = savedCourse.id;

        await createNewLessonsAndTasks(courseId, lessons);
      }

      onCourseCreated();
      onClose(false);
    } catch (error) {
      console.error('Error saving course and tasks:', error);
      alert('אירעה שגיאה בשמירת הקורס והמשימות.');
    } finally {
      setLoading(false);
    }
  };

  const updateExistingLessonsAndTasks = async (courseId: string, lessons: Lesson[]) => {
    const { data: existingLessons } = await supabase
      .from('lessons')
      .select(`id, title, order_index, lesson_tasks (id, title, description, estimated_duration, is_mandatory, order_index)`)  
      .eq('course_id', courseId)
      .order('order_index');

    // Create a map of existing lessons by ID for matching
    const existingLessonsMap = new Map(existingLessons.map(lesson => [lesson.id, lesson]));
    const processedLessonIds = new Set<string>();

    for (const lesson of lessons) {
      // Check if this lesson has a real database ID (not a temporary one)
      const isExistingLesson = lesson.id && 
        !lesson.id.startsWith('lesson-') && 
        !lesson.id.startsWith('fallback-lesson-') && 
        existingLessonsMap.has(lesson.id);
      const existingLesson = isExistingLesson ? existingLessonsMap.get(lesson.id) : null;
      
      if (existingLesson) {
        // Update existing lesson
        processedLessonIds.add(existingLesson.id);
        await supabase.from('lessons').update({ title: lesson.title }).eq('id', existingLesson.id);
        await updateTasksForLesson(existingLesson.id, lesson.tasks, existingLesson.lesson_tasks);
      } else {
        // Create new lesson
        const { data: savedLesson, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            course_id: courseId,
            title: lesson.title,
            description: lesson.description || null,
            scheduled_start: new Date().toISOString(),
            scheduled_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            status: 'scheduled',
            order_index: lesson.order_index || 0,
          })
          .select('id')
          .single();

        if (lessonError) throw lessonError;

        if (lesson.tasks.length > 0) {
          const tasksToInsert = lesson.tasks.map(task => ({
            lesson_id: savedLesson.id,
            title: task.title,
            description: task.description,
            estimated_duration: task.estimated_duration,
            is_mandatory: task.is_mandatory,
            order_index: task.order_index,
          }));
          
          console.log('Inserting tasks for new lesson:', tasksToInsert);
          const { data: insertedTasks, error: tasksError } = await supabase.from('lesson_tasks').insert(tasksToInsert);
          
          if (tasksError) {
            console.error('Error inserting tasks for new lesson:', tasksError);
            throw tasksError;
          }
          console.log('Tasks for new lesson inserted successfully:', insertedTasks);
        }
      }
    }

    // Check which lessons have schedules before deleting
    const lessonsToDelete = existingLessons
      .filter(lesson => !processedLessonIds.has(lesson.id))
      .map(lesson => lesson.id);

    if (lessonsToDelete.length > 0) {
      // Check if any of these lessons have associated schedules
      const { data: scheduledLessons, error: scheduleCheckError } = await supabase
        .from('lesson_schedules')
        .select('lesson_id')
        .in('lesson_id', lessonsToDelete);

      if (scheduleCheckError) {
        console.error('Error checking lesson schedules:', scheduleCheckError);
        throw scheduleCheckError;
      }

      const scheduledLessonIds = new Set(scheduledLessons?.map(s => s.lesson_id) || []);
      
      // Only delete lessons that don't have schedules
      const lessonsToActuallyDelete = lessonsToDelete.filter(id => !scheduledLessonIds.has(id));
      
      if (lessonsToActuallyDelete.length > 0) {
        await supabase.from('lesson_tasks').delete().in('lesson_id', lessonsToActuallyDelete);
        await supabase.from('lessons').delete().in('id', lessonsToActuallyDelete);
      }

      // For lessons with schedules that were removed from the course, just keep them 
      // The schedules will remain intact but the lesson content will be outdated
      // This preserves the scheduled times while allowing course content updates
      if (scheduledLessonIds.size > 0) {
        console.log(`Preserved ${scheduledLessonIds.size} lessons with existing schedules`);
      }
    }
  };

  const updateTasksForLesson = async (lessonId: string, newTasks: any[], existingTasks: any[]) => {
    const existingTasksMap = new Map(existingTasks.map(task => [task.id, task]));
    const processedTaskIds = new Set<string>();

    for (const newTask of newTasks) {
      // Check if this task has a real database ID (not a temporary one)
      const isExistingTask = newTask.id && !newTask.id.startsWith('task-') && existingTasksMap.has(newTask.id);
      const existingTask = isExistingTask ? existingTasksMap.get(newTask.id) : null;
      
      if (existingTask) {
        // Update existing task
        processedTaskIds.add(existingTask.id);
        await supabase
          .from('lesson_tasks')
          .update({
            title: newTask.title,
            description: newTask.description,
            estimated_duration: newTask.estimated_duration,
            is_mandatory: newTask.is_mandatory,
            order_index: newTask.order_index,
          })
          .eq('id', existingTask.id);
      } else {
        // Create new task
        console.log('Inserting new task for lesson:', lessonId, newTask);
        const { data: insertedTask, error: insertError } = await supabase.from('lesson_tasks').insert({
          lesson_id: lessonId,
          title: newTask.title,
          description: newTask.description,
          estimated_duration: newTask.estimated_duration,
          is_mandatory: newTask.is_mandatory,
          order_index: newTask.order_index,
        });
        
        if (insertError) {
          console.error('Error inserting new task:', insertError);
          throw insertError;
        }
        console.log('New task inserted successfully:', insertedTask);
      }
    }

    // Delete tasks that are no longer in the updated list
    const tasksToDelete = existingTasks
      .filter(task => !processedTaskIds.has(task.id))
      .map(task => task.id);

    if (tasksToDelete.length > 0) {
      await supabase.from('lesson_tasks').delete().in('id', tasksToDelete);
    }
  };

  const createNewLessonsAndTasks = async (courseId: string, lessons: Lesson[]) => {
    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const { data: savedLesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          course_id: courseId,
          title: lesson.title,
          description: lesson.description || null,
          scheduled_start: new Date().toISOString(),
          scheduled_end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          status: 'scheduled',
          order_index: lesson.order_index || i,
        })
        .select('id')
        .single();

      if (lessonError) throw lessonError;

      if (lesson.tasks.length > 0) {
        const tasksToInsert = lesson.tasks.map(task => ({
          lesson_id: savedLesson.id,
          title: task.title,
          description: task.description,
          estimated_duration: task.estimated_duration,
          is_mandatory: task.is_mandatory,
          order_index: task.order_index,
        }));
        
        console.log('Inserting tasks:', tasksToInsert);
        const { data: insertedTasks, error: tasksError } = await supabase
          .from('lesson_tasks')
          .insert(tasksToInsert);
          
        if (tasksError) {
          console.error('Error inserting tasks:', tasksError);
          throw tasksError;
        }
        console.log('Tasks inserted successfully:', insertedTasks);
      }
    }
  };

  return { loading, handleSubmit };
}