ALTER TABLE course_instances
ADD COLUMN is_double_lesson BOOLEAN DEFAULT false;

UPDATE course_instances ci
SET is_double_lesson = true
FROM course_instance_schedules cis
WHERE cis.course_instance_id = ci.id
AND cis.lesson_duration_minutes = 90;
