import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUnreportedLessons = (userId: string | undefined, isInstructor: boolean) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !isInstructor) return;

    const fetch = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from('lesson_schedules')
        .select(`
          id,
          course_instances!lesson_schedules_course_instance_id_fkey!inner (instructor_id),
          lesson_reports (id)
        `)
        .lt('scheduled_end', new Date().toISOString())
        .gt('scheduled_end', thirtyDaysAgo.toISOString())
        .eq('course_instances.instructor_id', userId);

      const unreported = (data || []).filter(s => s.lesson_reports.length === 0);
      setCount(unreported.length);
    };

    fetch();
  }, [userId, isInstructor]);

  return count;
};
