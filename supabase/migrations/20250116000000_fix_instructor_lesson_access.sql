-- Fix instructor access to lessons for their assigned course instances
-- This allows instructors to see lessons for courses they're assigned to via course_instances

-- First, enable RLS on lessons table if not already enabled
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Instructors can view lessons for assigned courses" ON public.lessons;
DROP POLICY IF EXISTS "Admins can view all lessons" ON public.lessons;
DROP POLICY IF EXISTS "Anyone can view lessons" ON public.lessons;

-- Create policy for admins and pedagogical managers (full access)
CREATE POLICY "Admins and pedagogical managers can view all lessons"
ON public.lessons
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- Create policy for instructors (access to lessons for their assigned courses)
CREATE POLICY "Instructors can view lessons for assigned courses"
ON public.lessons
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = 'instructor' AND
  course_id IN (
    SELECT ci.course_id
    FROM public.course_instances ci
    WHERE ci.instructor_id = auth.uid()
  )
);

-- Also enable RLS on lesson_tasks and create similar policies
ALTER TABLE public.lesson_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Instructors can view tasks for assigned lessons" ON public.lesson_tasks;
DROP POLICY IF EXISTS "Admins can view all lesson tasks" ON public.lesson_tasks;
DROP POLICY IF EXISTS "Anyone can view lesson tasks" ON public.lesson_tasks;

-- Create policy for admins and pedagogical managers (full access to tasks)
CREATE POLICY "Admins and pedagogical managers can view all lesson tasks"
ON public.lesson_tasks
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() IN ('admin', 'pedagogical_manager')
);

-- Create policy for instructors (access to tasks for lessons in their assigned courses)
CREATE POLICY "Instructors can view tasks for assigned lessons"
ON public.lesson_tasks
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = 'instructor' AND
  lesson_id IN (
    SELECT l.id
    FROM public.lessons l
    JOIN public.course_instances ci ON l.course_id = ci.course_id
    WHERE ci.instructor_id = auth.uid()
  )
);