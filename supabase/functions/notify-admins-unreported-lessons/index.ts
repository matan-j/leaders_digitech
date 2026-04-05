import { createClient } from 'jsr:@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
console.log('[debug] BREVO_API_KEY loaded:', BREVO_API_KEY ? `YES (length: ${BREVO_API_KEY.length}, first 8 chars: ${BREVO_API_KEY.substring(0, 8)})` : 'MISSING')

Deno.serve(async (req) => {
  console.log(`=== UNREPORTED LESSONS NOTIFICATION START ===`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find lesson_schedules where scheduled_end is between now()-48h and now()-24h
    // embedding lesson_reports to detect unreported ones
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const upperBound = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: schedules, error: scheduleError } = await supabase
      .from('lesson_schedules')
      .select(`
        id,
        scheduled_end,
        lesson_reports (id),
        course_instances!lesson_schedules_course_instance_id_fkey (
          grade_level,
          educational_institutions:institution_id (name),
          instructor:instructor_id (full_name),
          course:course_id (name)
        )
      `)
      .lt('scheduled_end', cutoff)
      .gt('scheduled_end', upperBound)
      .is('admin_notified_at', null)

    if (scheduleError) {
      console.error('❌ Failed to query lesson_schedules:', scheduleError)
      return new Response(JSON.stringify({ error: scheduleError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const unreported = (schedules || []).filter(s => s.lesson_reports.length === 0)
    console.log(`📋 Total overdue schedules: ${schedules?.length}, Unreported: ${unreported.length}`)

    if (unreported.length === 0) {
      console.log('✅ No unreported lessons — skipping email')
      return new Response(JSON.stringify({ message: 'No unreported lessons' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Fetch admin emails
    const { data: adminEmailsData, error: adminError } = await supabase.rpc('get_admin_emails')
    if (adminError) {
      console.error('❌ Failed to get admin emails:', adminError)
      return new Response(JSON.stringify({ error: adminError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const adminEmails = adminEmailsData?.map((row: { email: string }) => row.email) || []
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No admin emails configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Build email content
    const rows = unreported.map(s => {
      const ci = s.course_instances as any
      const instructor = ci?.instructor?.full_name || 'לא ידוע'
      const course = ci?.course?.name || 'לא ידוע'
      const institution = ci?.educational_institutions?.name || 'לא ידוע'
      const grade = ci?.grade_level || ''
      const date = s.scheduled_end
        ? new Date(s.scheduled_end).toLocaleDateString('he-IL')
        : 'לא ידוע'
      return { instructor, course, institution, grade, date }
    })

    const rowsHtml = rows.map(r =>
      `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.date}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.instructor}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.course}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.institution}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${r.grade}</td>
      </tr>`
    ).join('')

    const rowsText = rows.map(r =>
      `- ${r.date} | ${r.instructor} | ${r.course} | ${r.institution} ${r.grade}`
    ).join('\n')

    const subject = `התראה: ${unreported.length} שיעורים ללא דיווח (מעל 24 שעות)`

    const textContent = `שלום,\n\nהשיעורים הבאים טרם דווחו ועברו 24 שעות:\n\n${rowsText}\n\nבברכה,\nמערכת Leaders`

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body dir="rtl" style="font-family:Arial,sans-serif;direction:rtl;color:#333">
  <div style="max-width:650px;margin:0 auto;padding:20px">
    <div style="background:#e53935;color:white;padding:15px;border-radius:5px;margin-bottom:20px">
      <h2 style="margin:0">התראה: שיעורים ללא דיווח</h2>
    </div>
    <p>שלום,</p>
    <p>השיעורים הבאים טרם דווחו ועברו יותר מ-24 שעות:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;direction:rtl">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd">תאריך</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd">מדריך</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd">קורס</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd">מוסד</th>
          <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #ddd">כיתה</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin-top:20px;color:#666;font-size:12px">מערכת Leaders</p>
  </div>
</body></html>`

    const emailResults: any[] = []

    for (const email of adminEmails) {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Leaders Admin System', email: 'fransesguy1@gmail.com' },
            to: [{ email, name: 'Admin' }],
            subject,
            textContent,
            htmlContent,
          }),
        })
        if (res.ok) {
          const result = await res.json()
          console.log(`✅ Email sent to ${email} | ID: ${result.messageId}`)
          emailResults.push({ email, status: 'sent' })
        } else {
          const errText = await res.text()
          console.error(`❌ Email to ${email} failed: ${res.status} ${errText}`)
          emailResults.push({ email, status: 'failed', error: errText })
        }
      } catch (err) {
        console.error(`💥 Exception sending to ${email}:`, err)
        emailResults.push({ email, status: 'failed', error: err.message })
      }
    }

    const successCount = emailResults.filter(r => r.status === 'sent').length

    if (successCount > 0) {
      const notifiedIds = unreported.map((s: { id: string }) => s.id)
      await supabase
        .from('lesson_schedules')
        .update({ admin_notified_at: new Date().toISOString() })
        .in('id', notifiedIds)
    }

    console.log(`=== UNREPORTED LESSONS NOTIFICATION END | sent: ${successCount}/${adminEmails.length} ===`)

    return new Response(JSON.stringify({ message: `Sent: ${successCount}`, unreportedCount: unreported.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('💥 Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
