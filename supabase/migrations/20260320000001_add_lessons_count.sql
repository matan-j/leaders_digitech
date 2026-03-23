ALTER TABLE lesson_reports
ADD COLUMN lessons_count SMALLINT DEFAULT 1;

UPDATE lesson_reports lr
SET lessons_count = 2
FROM course_instances ci
JOIN course_instance_schedules cis ON cis.course_instance_id = ci.id
WHERE lr.course_instance_id = ci.id
AND cis.lesson_duration_minutes = 90;
