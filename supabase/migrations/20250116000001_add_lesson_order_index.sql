-- Add order_index field to lessons table for proper lesson sequencing
ALTER TABLE public.lessons 
ADD COLUMN order_index INTEGER DEFAULT 0;

-- Update existing lessons to have proper order_index based on their current order
-- We'll use a window function to assign order numbers within each course
UPDATE public.lessons 
SET order_index = lesson_order.row_num - 1
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at) as row_num
    FROM public.lessons
) AS lesson_order
WHERE public.lessons.id = lesson_order.id;

-- Add a comment to explain the column
COMMENT ON COLUMN public.lessons.order_index IS 'Defines the order/sequence of lessons within a course (0-based index)';