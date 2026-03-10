-- Add completed_task_ids column to lesson_reports table
ALTER TABLE public.lesson_reports 
ADD COLUMN completed_task_ids uuid[] DEFAULT '{}';

-- Add a comment to explain the column
COMMENT ON COLUMN public.lesson_reports.completed_task_ids IS 'Array of task IDs that were completed during this lesson';