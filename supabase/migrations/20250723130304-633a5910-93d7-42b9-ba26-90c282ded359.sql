-- Move fields from courses table to course_instances table for better separation
-- Add new fields to course_instances table for assignment-specific data
ALTER TABLE public.course_instances 
ADD COLUMN IF NOT EXISTS price_for_customer NUMERIC,
ADD COLUMN IF NOT EXISTS price_for_instructor NUMERIC,
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Remove fields from courses table that are now assignment-specific
ALTER TABLE public.courses 
DROP COLUMN IF EXISTS price_per_lesson,
DROP COLUMN IF EXISTS max_participants,
DROP COLUMN IF EXISTS instructor_id,
DROP COLUMN IF EXISTS institution_id,
DROP COLUMN IF EXISTS grade_level,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS approx_end_date;