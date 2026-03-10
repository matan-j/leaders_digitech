import { createClient } from "jsr:@supabase/supabase-js"
import { corsHeaders } from '../_shared/cors.ts'

interface PostponePayload {
  scheduleId: string;
  reportId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[postponeSchedule] URL:', SUPABASE_URL ? 'OK' : 'MISSING');
    console.log('[postponeSchedule] KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'MISSING');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const payload: PostponePayload = await req.json();
    if (!payload.scheduleId || !payload.reportId) {
      throw new Error("Missing scheduleId or reportId in payload.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('[postponeSchedule] Starting postpone for schedule:', payload.scheduleId);

    // 1. Fetch the original schedule with all related data
    const { data: originalSchedule, error: fetchError } = await supabase
      .from('lesson_schedules')
      .select(`
        *,
        course_instances:course_instance_id (
          id,
          start_date,
          end_date,
          course_instance_schedules (
            id,
            days_of_week,
            time_slots,
            total_lessons,
            lesson_duration_minutes
          )
        ),
        lessons:lesson_id (
          id,
          title,
          order_index
        )
      `)
      .eq('id', payload.scheduleId)
      .single();

    if (fetchError || !originalSchedule) {
      console.error('[postponeSchedule] Error fetching schedule:', fetchError);
      throw new Error('לא נמצא תזמון');
    }

    console.log('[postponeSchedule] Original schedule:', originalSchedule);

    const originalStartDate = new Date(originalSchedule.scheduled_start);
    console.log('[postponeSchedule] Original start date:', originalStartDate.toISOString());

    const courseInstance = originalSchedule.course_instances;
    let pattern = courseInstance?.course_instance_schedules?.[0];

    if (!pattern || !pattern.days_of_week || !pattern.time_slots) {
      console.log('[postponeSchedule] Trying to fetch pattern directly from DB...');
      const { data: directPattern, error: directError } = await supabase
        .from('course_instance_schedules')
        .select('*')
        .eq('course_instance_id', originalSchedule.course_instance_id)
        .single();

      if (directPattern && directPattern.days_of_week && directPattern.time_slots) {
        console.log('[postponeSchedule] ✅ Using direct pattern instead');
        pattern = directPattern;
      } else {
        throw new Error('לא נמצא תבנית תזמון');
      }
    }

    console.log('[postponeSchedule] Final pattern to use:', pattern);

    // Normalize days
    const normalizedDays = (pattern.days_of_week || []).map((day: any) =>
      typeof day === 'string' ? parseInt(day, 10) : day
    ).sort();

    const normalizedTimeSlots = (pattern.time_slots || []).map((ts: any) => ({
      ...ts,
      day: typeof ts.day === 'string' ? parseInt(ts.day, 10) : ts.day
    }));

    console.log('[postponeSchedule] Pattern days:', normalizedDays);
    console.log('[postponeSchedule] Time slots:', normalizedTimeSlots);

    // ✅ Get blocked dates
    const { data: blockedDatesData, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('*')
     

    if (blockedError) {
      console.error('[postponeSchedule] Error fetching blocked dates:', blockedError);
    }

    console.log('[postponeSchedule] Raw blocked dates data:', JSON.stringify(blockedDatesData, null, 2));

    const blockedDateSet = new Set<string>();
    
    (blockedDatesData || []).forEach(blockedDate => {
      console.log('[postponeSchedule] Processing blocked date:', blockedDate);
      
      if (blockedDate.date) {
        // תאריך בודד
        const dateStr = blockedDate.date.split('T')[0]; // קח רק את החלק של התאריך
        blockedDateSet.add(dateStr);
        console.log('[postponeSchedule] Added single blocked date:', dateStr);
      } else if (blockedDate.start_date && blockedDate.end_date) {
        // טווח תאריכים
        const start = new Date(blockedDate.start_date);
        const end = new Date(blockedDate.end_date);
        const current = new Date(start);
        
        console.log('[postponeSchedule] Processing date range:', blockedDate.start_date, 'to', blockedDate.end_date);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          blockedDateSet.add(dateStr);
          console.log('[postponeSchedule] Added blocked date from range:', dateStr);
          current.setDate(current.getDate() + 1);
        }
      }
    });

    console.log('[postponeSchedule] Total blocked dates:', blockedDateSet.size);
    console.log('[postponeSchedule] Blocked dates list:', Array.from(blockedDateSet).sort());

    // ✅ פונקציה למציאת התאריך הבא הזמין
    const findNextAvailableDate = (startDate: Date): Date => {
      let nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + 1);

      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        const dateStr = nextDate.toISOString().split('T')[0];
        const dayOfWeek = nextDate.getDay();
        
        console.log(`[postponeSchedule] Checking date: ${dateStr}, day: ${dayOfWeek}`);
        
        // בדוק אם היום תואם לתבנית
        if (normalizedDays.includes(dayOfWeek)) {
          console.log(`[postponeSchedule] Date ${dateStr} matches pattern (day ${dayOfWeek})`);
          
          // בדוק אם התאריך לא חסום
          if (!blockedDateSet.has(dateStr)) {
            console.log(`[postponeSchedule] ✅ Date ${dateStr} is AVAILABLE!`);
            return nextDate;
          } else {
            console.log(`[postponeSchedule] ❌ Date ${dateStr} is BLOCKED, skipping...`);
          }
        } else {
          console.log(`[postponeSchedule] Date ${dateStr} does NOT match pattern (day ${dayOfWeek} not in ${normalizedDays})`);
        }
        
        nextDate.setDate(nextDate.getDate() + 1);
        attempts++;
      }

      throw new Error('לא נמצא תאריך זמין ב-60 הימים הקרובים');
    };

    // 2. מצא את התאריך הזמין הבא
    const nextDate = findNextAvailableDate(originalStartDate);

    // 3. Find the time slot for the new day
    const nextDayOfWeek = nextDate.getDay();
    const timeSlot = normalizedTimeSlots.find(ts => ts.day === nextDayOfWeek);

    if (!timeSlot || !timeSlot.start_time || !timeSlot.end_time) {
      throw new Error('לא נמצא slot זמן עבור היום הבא');
    }

    // 4. Calculate new start and end times
    const [startHour, startMinute] = timeSlot.start_time.split(':').map(Number);
    const [endHour, endMinute] = timeSlot.end_time.split(':').map(Number);

    const newStart = new Date(nextDate);
    newStart.setHours(startHour, startMinute, 0, 0);

    const newEnd = new Date(nextDate);
    newEnd.setHours(endHour, endMinute, 0, 0);

    console.log('[postponeSchedule] New schedule date:', newStart.toISOString());

    // 5. Update the existing schedule
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('lesson_schedules')
      .update({
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString()
      })
      .eq('id', payload.scheduleId)
      .select()
      .single();

    if (updateError || !updatedSchedule) {
      console.error('[postponeSchedule] Error updating schedule:', updateError);
      throw new Error('שגיאה בעדכון תזמון');
    }

    console.log('[postponeSchedule] Updated schedule:', updatedSchedule.id, 'to', newStart.toISOString());

    // 6. Chain all subsequent schedules
    const { data: subsequentSchedules, error: fetchSubError } = await supabase
      .from('lesson_schedules')
      .select('*')
      .eq('course_instance_id', originalSchedule.course_instance_id)
      .gt('scheduled_start', originalStartDate.toISOString())
      .neq('id', payload.scheduleId)
      .order('scheduled_start', { ascending: true });

    console.log(`[postponeSchedule] Found ${subsequentSchedules?.length || 0} schedules to chain`);

    if (!fetchSubError && subsequentSchedules && subsequentSchedules.length > 0) {
      console.log(`[postponeSchedule] Chaining ${subsequentSchedules.length} subsequent schedules`);

      for (const schedule of subsequentSchedules) {
        const scheduleDate = new Date(schedule.scheduled_start);
        console.log(`[postponeSchedule] Processing schedule ${schedule.id} originally at ${scheduleDate.toISOString()}`);

        try {
          const shiftedDate = findNextAvailableDate(scheduleDate);

          const shiftedDayOfWeek = shiftedDate.getDay();
          const shiftedTimeSlot = normalizedTimeSlots.find(ts => ts.day === shiftedDayOfWeek);

          if (shiftedTimeSlot && shiftedTimeSlot.start_time && shiftedTimeSlot.end_time) {
            const [shiftStartHour, shiftStartMinute] = shiftedTimeSlot.start_time.split(':').map(Number);
            const [shiftEndHour, shiftEndMinute] = shiftedTimeSlot.end_time.split(':').map(Number);

            const shiftedStart = new Date(shiftedDate);
            shiftedStart.setHours(shiftStartHour, shiftStartMinute, 0, 0);

            const shiftedEnd = new Date(shiftedDate);
            shiftedEnd.setHours(shiftEndHour, shiftEndMinute, 0, 0);

            const { error: chainUpdateError } = await supabase
              .from('lesson_schedules')
              .update({
                scheduled_start: shiftedStart.toISOString(),
                scheduled_end: shiftedEnd.toISOString()
              })
              .eq('id', schedule.id);

            if (chainUpdateError) {
              console.error(`[postponeSchedule] Error updating schedule ${schedule.id}:`, chainUpdateError);
            } else {
              console.log(`[postponeSchedule] ✅ Shifted schedule ${schedule.id} from ${scheduleDate.toISOString()} to ${shiftedStart.toISOString()}`);
            }
          } else {
            console.error(`[postponeSchedule] Could not find time slot for schedule ${schedule.id}`);
          }
        } catch (dateError) {
          console.error(`[postponeSchedule] Error finding next date for schedule ${schedule.id}:`, dateError);
        }
      }
    } else {
      console.log('[postponeSchedule] No subsequent schedules found to chain');
    }

    const message = `התזמון נדחה ליום ${nextDate.toLocaleDateString('he-IL')} ו-${subsequentSchedules?.length || 0} תזמונים נשרשרו קדימה`;

    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[postponeSchedule] Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});