-- Add is_completed column to lesson_reports table
-- This field tracks whether the lesson actually took place

ALTER TABLE lesson_reports 
ADD COLUMN is_completed BOOLEAN DEFAULT true;

-- Add comment to explain the field
COMMENT ON COLUMN lesson_reports.is_completed IS 'Indicates whether the lesson actually took place. Default is true for backward compatibility.';

-- Update existing records to set is_completed = true where it's null
UPDATE lesson_reports SET is_completed = true WHERE is_completed IS NULL;