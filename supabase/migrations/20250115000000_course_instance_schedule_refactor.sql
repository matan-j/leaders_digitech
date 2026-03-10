-- Refactor course scheduling architecture
-- Add schedule-related fields to course_instances table
-- Create course_instance_schedules table for storing course-wide schedule patterns

-- Add schedule fields to course_instances table (using existing start_date/end_date)
ALTER TABLE public.course_instances 
ADD COLUMN IF NOT EXISTS days_of_week INTEGER[], -- Array of day indices (0=Sunday, 1=Monday, etc.)
ADD COLUMN IF NOT EXISTS schedule_pattern JSONB; -- Store flexible schedule patterns

-- Create course_instance_schedules table for more complex scheduling
CREATE TABLE IF NOT EXISTS public.course_instance_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_instance_id UUID REFERENCES public.course_instances(id) ON DELETE CASCADE,
    days_of_week INTEGER[] NOT NULL, -- Array of day indices (0=Sunday, 1=Monday, etc.)
    time_slots JSONB NOT NULL, -- Array of time slots per day: [{"day": 0, "start_time": "09:00", "end_time": "10:30"}, ...]
    total_lessons INTEGER,
    lesson_duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_instance_schedules_course_instance_id 
ON public.course_instance_schedules(course_instance_id);

CREATE INDEX IF NOT EXISTS idx_course_instance_schedules_start_date 
ON public.course_instance_schedules(start_date);

CREATE INDEX IF NOT EXISTS idx_course_instance_schedules_days_of_week 
ON public.course_instance_schedules USING GIN(days_of_week);

-- Enable RLS on the new table
ALTER TABLE public.course_instance_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for course_instance_schedules
CREATE POLICY "Users can view course_instance_schedules" ON public.course_instance_schedules
    FOR SELECT USING (true);

CREATE POLICY "Admins and managers can insert course_instance_schedules" ON public.course_instance_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'pedagogical_manager')
        )
    );

CREATE POLICY "Admins and managers can update course_instance_schedules" ON public.course_instance_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'pedagogical_manager')
        )
    );

CREATE POLICY "Admins and managers can delete course_instance_schedules" ON public.course_instance_schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'pedagogical_manager')
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_course_instance_schedules_updated_at 
    BEFORE UPDATE ON public.course_instance_schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment explaining the new architecture
COMMENT ON TABLE public.course_instance_schedules IS 'Stores course-wide scheduling patterns instead of individual lesson schedules. Each course instance has one schedule pattern that defines when all lessons occur. Uses course_instances start_date/end_date for the schedule period.';
COMMENT ON COLUMN public.course_instance_schedules.days_of_week IS 'Array of day indices where 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
COMMENT ON COLUMN public.course_instance_schedules.time_slots IS 'JSON array of time slots: [{"day": 0, "start_time": "09:00", "end_time": "10:30"}, {"day": 2, "start_time": "14:00", "end_time": "15:30"}]';