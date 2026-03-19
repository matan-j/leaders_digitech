// supabase/functions/notify-admins-low-attendance/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!



Deno.serve(async (req) => {
  console.log(`=== LOW ATTENDANCE NOTIFICATION START ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Request method: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const payload = await req.json();
    console.log('✅ Request payload parsed:', payload);

    const {
      lessonReportId,
      attendanceCount,
      totalStudents,
      attendancePercentage,
      teacherName,
      courseName,
      gradeLevel,
      lessonTitle,
      lessonDate
    } = payload;

    // Validate required fields
    if (attendanceCount === undefined || totalStudents === undefined || !teacherName) {
      console.error('❌ Missing required fields in payload');
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        received: payload,
        required: ['attendanceCount', 'totalStudents', 'teacherName']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client created');

    // // For testing - replace with your actual email
    // console.log('📧 Using test email for debugging');
    // const adminEmails = ['fransesguy1@gmail.com'];
    
    
    // Original code for production - uncomment when ready
    console.log('📞 Fetching admin emails from get_admin_emails()');
    const { data: adminEmailsData, error: adminError } = await supabase
      .rpc('get_admin_emails');

    if (adminError) {
      console.error('❌ Failed to get admin emails:', adminError);
      return new Response(JSON.stringify({ error: 'Failed to fetch admin emails', details: adminError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const adminEmails = adminEmailsData?.map((row: { email: string }) => row.email) || [];
  

    console.log(`📬 Admin emails found: ${adminEmails.length}`, adminEmails);
    
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No admin emails configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Use the data passed from client - no need to query database
    const displayGradeLevel = gradeLevel || 'לא ידוע';
    const displayCourseName = courseName || 'לא ידוע';

    console.log('✅ Using provided data - Grade Level:', displayGradeLevel, 'Course Name:', displayCourseName);

    const subject = `התראה: נוכחות נמוכה בשיעור - כיתה ${displayGradeLevel}`;
    const textContent = `
שלום,

ברצוננו להודיע על נוכחות נמוכה בשיעור:

פרטי השיעור:
- קורס: ${displayCourseName}
- כיתה: ${displayGradeLevel}
- נושא השיעור: ${lessonTitle || 'לא ידוע'}
- מורה: ${teacherName}
- תאריך: ${lessonDate}
- נוכחו: ${attendanceCount} מתוך ${totalStudents} תלמידים
- אחוז נוכחות: ${attendancePercentage?.toFixed(1) ?? 'N/A'}%

הנוכחות נמוכה מ-70% והדבר דורש תשומת לב.

מזהה דיווח: ${lessonReportId}

בברכה,
מערכת ניהול החינוך
    `;

    const emailResults: any[] = [];

    for (const email of adminEmails) {
      try {
        console.log(`📤 Attempting to send email to: ${email}`);

        const emailPayload = {
          sender: {
            name: "Leaders Admin System",
            email: "fransesguy1@gmail.com"
          },
          to: [{ email, name: "Admin" }],
          subject,
          textContent
        };

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });

        console.log(`📤 Brevo API response status: ${res.status}`);

        if (res.ok) {
          const result = await res.json();
          console.log(`✅ Email sent to ${email} | ID: ${result.messageId}`);
          emailResults.push({
            email,
            status: 'sent',
            messageId: result.messageId
          });
        } else {
          const errorText = await res.text();
          console.error(`❌ Email to ${email} failed. Status: ${res.status}, Response: ${errorText}`);
          emailResults.push({
            email,
            status: 'failed',
            error: `Status ${res.status}: ${errorText}`
          });
        }
      } catch (err) {
        console.error(`💥 Exception sending email to ${email}:`, err);
        emailResults.push({
          email,
          status: 'failed',
          error: err.message
        });
      }
    }

    const successCount = emailResults.filter(r => r.status === 'sent').length;
    const failureCount = emailResults.filter(r => r.status === 'failed').length;

    console.log(`✅ Email processing complete. Success: ${successCount}, Failed: ${failureCount}`);
    console.log('=== LOW ATTENDANCE NOTIFICATION END ===');

    return new Response(JSON.stringify({
      message: `Emails processed. Success: ${successCount}, Failed: ${failureCount}`,
      results: emailResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});