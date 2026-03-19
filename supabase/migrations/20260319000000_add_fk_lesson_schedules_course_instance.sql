ALTER TABLE lesson_schedules
ADD CONSTRAINT fk_lesson_schedules_course_instance
FOREIGN KEY (course_instance_id) REFERENCES course_instances(id);
