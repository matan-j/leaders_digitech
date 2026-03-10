-- Add reported_by field to track who actually created/edited the report
-- instructor_id remains to show which instructor the lesson belongs to

ALTER TABLE public.lesson_reports 
ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES auth.users(id);

-- Set existing reports' reported_by to their instructor_id (backfill)
UPDATE public.lesson_reports 
SET reported_by = instructor_id 
WHERE reported_by IS NULL;

-- Update RLS policies to allow admins to manage all reports

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Instructors can create their own lesson_reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "Instructors can update their own lesson_reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "Instructors can delete their own lesson_reports" ON public.lesson_reports;
DROP POLICY IF EXISTS "Instructors can view their own lesson_reports" ON public.lesson_reports;

-- Create new flexible policies

-- SELECT: Admins see all, instructors see their own
CREATE POLICY "Anyone can view relevant lesson_reports"
ON public.lesson_reports
FOR SELECT
USING (
  -- Admins and managers can see everything
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'pedagogical_manager')
  ))
  OR
  -- Instructors can see their own lessons
  (instructor_id = auth.uid())
  OR
  -- Or reports they created
  (reported_by = auth.uid())
);

-- INSERT: Instructors can create for their lessons, admins can create for anyone
CREATE POLICY "Instructors and admins can create lesson_reports"
ON public.lesson_reports
FOR INSERT
WITH CHECK (
  -- Admins and managers can create for anyone
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'pedagogical_manager')
  ))
  OR
  -- Instructors can only create for their own lessons
  (instructor_id = auth.uid() AND reported_by = auth.uid())
);

-- UPDATE: Admins can update any, instructors can update their own
CREATE POLICY "Instructors and admins can update lesson_reports"
ON public.lesson_reports
FOR UPDATE
USING (
  -- Admins and managers can update anything
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'pedagogical_manager')
  ))
  OR
  -- Instructors can update their own
  (instructor_id = auth.uid())
  OR
  -- Or reports they created
  (reported_by = auth.uid())
);

-- DELETE: Admins can delete any, instructors can delete their own
CREATE POLICY "Instructors and admins can delete lesson_reports"
ON public.lesson_reports
FOR DELETE
USING (
  -- Admins and managers can delete anything
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'pedagogical_manager')
  ))
  OR
  -- Instructors can delete their own
  (instructor_id = auth.uid() AND reported_by = auth.uid())
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lesson_reports_reported_by ON public.lesson_reports(reported_by);

-- Add comment for documentation
COMMENT ON COLUMN public.lesson_reports.reported_by IS 'User who actually created/edited this report. May differ from instructor_id if admin reported on behalf of instructor.';