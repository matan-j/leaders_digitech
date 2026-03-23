CREATE OR REPLACE FUNCTION public.report_work_hour(p_lessons_count INTEGER DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET
    current_work_hours = COALESCE(current_work_hours, 0) + p_lessons_count,
    updated_at = now()
  WHERE
    id = auth.uid();
END;
$$;
