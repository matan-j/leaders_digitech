import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { scheduleId, reportId } = await req.json()
    if (!scheduleId || !reportId) {
      throw new Error('Missing scheduleId or reportId')
    }

    // 1. Fetch the postponed schedule
    const { data: schedule, error: fetchError } = await supabase
      .from('lesson_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (fetchError || !schedule) throw new Error('לא נמצא תזמון')
    if (!schedule.original_scheduled_start) throw new Error('השיעור לא נדחה — אין תאריך מקורי לשחזור')

    // 2. Restore the primary schedule
    const { error: restoreError } = await supabase
      .from('lesson_schedules')
      .update({
        scheduled_start: schedule.original_scheduled_start,
        scheduled_end: schedule.original_scheduled_end,
        original_scheduled_start: null,
        original_scheduled_end: null,
      })
      .eq('id', scheduleId)

    if (restoreError) throw new Error('שגיאה בשחזור התזמון')

    // 3. Restore all subsequent chained schedules for this course instance
    const { data: subsequentSchedules } = await supabase
      .from('lesson_schedules')
      .select('id, original_scheduled_start, original_scheduled_end')
      .eq('course_instance_id', schedule.course_instance_id)
      .neq('id', scheduleId)
      .not('original_scheduled_start', 'is', null)
      .gt('scheduled_start', schedule.scheduled_start)

    if (subsequentSchedules && subsequentSchedules.length > 0) {
      for (const s of subsequentSchedules) {
        await supabase
          .from('lesson_schedules')
          .update({
            scheduled_start: s.original_scheduled_start,
            scheduled_end: s.original_scheduled_end,
            original_scheduled_start: null,
            original_scheduled_end: null,
          })
          .eq('id', s.id)
      }
    }

    // 4. Delete the lesson report so lesson returns to "unreported" status
    const { error: reportError } = await supabase
      .from('lesson_reports')
      .delete()
      .eq('id', reportId)

    if (reportError) throw new Error('שגיאה במחיקת הדיווח')

    return new Response(JSON.stringify({
      success: true,
      message: `השיעור שוחזר${subsequentSchedules?.length ? ` ו-${subsequentSchedules.length} תזמונים הוחזרו` : ''}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[undoPostpone] Error:', error)
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
