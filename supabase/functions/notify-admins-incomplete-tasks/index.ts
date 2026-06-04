// supabase/functions/notify-admins-incomplete-tasks/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
export const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
export const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL');
export const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'Leaders Digitech';
export const BREVO_REPLY_TO_EMAIL = Deno.env.get('BREVO_REPLY_TO_EMAIL');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
  throw new Error('Missing required Edge Function secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, and BREVO_SENDER_EMAIL.');
}

Deno.serve(async (req) => {
  console.log(`=== INCOMPLETE TASKS NOTIFICATION START ===`);
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
      courseName,
      gradeLevel,
      lessonTitle,
      lessonNumber,
      teacherName,
      lessonDate,
      completedTasksCount,
      totalTasksCount,
      incompleteTasks,
      notes
    } = payload;

    // Validate required fields
    if (!teacherName || completedTasksCount === undefined || totalTasksCount === undefined) {
      console.error('❌ Missing required fields in payload');
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        received: payload,
        required: ['teacherName', 'completedTasksCount', 'totalTasksCount']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client created');

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

    const displayGradeLevel = gradeLevel || 'לא ידוע';
    const displayCourseName = courseName || 'לא ידוע';
    const displayLessonNumber = lessonNumber || 'לא ידוע';

    // Create the incomplete tasks list
    let incompleteTasksList = '';
    if (incompleteTasks && incompleteTasks.length > 0) {
      incompleteTasksList = incompleteTasks.map((task: any, index: number) => {
        const mandatoryLabel = task.is_mandatory ? '(חובה)' : '(רשות)';
        return `${index + 1}. ${task.title} ${mandatoryLabel}`;
      }).join('\n');
    } else {
      incompleteTasksList = 'לא צוין';
    }

    const subject = `התראה: משימות לא בוצעו בשיעור - ${displayCourseName}, כיתה ${displayGradeLevel}`;
    
    const textContent = `
שלום,

ברצוננו להודיע שלא כל המשימות בוצעו בשיעור הבא:

פרטי השיעור:
- קורס: ${displayCourseName}
- כיתה: ${displayGradeLevel}
- שיעור מספר: ${displayLessonNumber}
- נושא השיעור: ${lessonTitle || 'לא ידוע'}
- מורה: ${teacherName}
- תאריך: ${lessonDate || new Date().toLocaleDateString('he-IL')}

ביצוע משימות:
- בוצעו: ${completedTasksCount} מתוך ${totalTasksCount} משימות
- משימות שלא בוצעו (${totalTasksCount - completedTasksCount}):

${incompleteTasksList}

הערות המדריך:
${notes || 'לא נוספו הערות'}

מזהה דיווח: ${lessonReportId || 'לא זמין'}

בברכה,
מערכת ניהול החינוך
    `;

    // HTML content with RTL support
 // HTML content with STRONG RTL support
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <style>
        * {
            direction: rtl !important;
            text-align: right !important;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
            text-align: right;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
            direction: rtl;
        }
        .header {
            background-color: #ff9800;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: right;
            direction: rtl;
        }
        .header h2 {
            margin: 0;
            text-align: right;
            direction: rtl;
        }
        .content {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            direction: rtl;
            text-align: right;
        }
        .content p {
            text-align: right;
            direction: rtl;
        }
        .section {
            margin-bottom: 20px;
            direction: rtl;
            text-align: right;
        }
        .section-title {
            font-weight: bold;
            color: #ff9800;
            margin-bottom: 10px;
            font-size: 16px;
            text-align: right;
            direction: rtl;
        }
        .detail-line {
            margin: 5px 0;
            padding-right: 10px;
            text-align: right;
            direction: rtl;
        }
        .tasks-list {
            background-color: #fff3e0;
            padding: 15px;
            border-right: 4px solid #ff9800;
            border-left: none;
            margin: 10px 0;
            white-space: pre-line;
            text-align: right;
            direction: rtl;
        }
        .notes {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
            font-style: italic;
            text-align: right;
            direction: rtl;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
            direction: rtl;
        }
        .stats {
            background-color: #fff3e0;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            color: #e65100;
            text-align: right;
            direction: rtl;
        }
        table {
            direction: rtl;
            text-align: right;
        }
        td, th {
            direction: rtl;
            text-align: right;
        }
    </style>
</head>
<body dir="rtl">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl">
        <tr>
            <td align="right" dir="rtl">
                <div class="container" dir="rtl">
                    <div class="header" dir="rtl">
                        <h2 dir="rtl">התראה: משימות לא בוצעו בשיעור</h2>
                    </div>
                    
                    <div class="content" dir="rtl">
                        <p dir="rtl">שלום,</p>
                        <p dir="rtl">ברצוננו להודיע שלא כל המשימות בוצעו בשיעור הבא:</p>
                        
                        <div class="section" dir="rtl">
                            <div class="section-title" dir="rtl">פרטי השיעור:</div>
                            <div class="detail-line" dir="rtl">קורס: <strong>${displayCourseName}</strong></div>
                            <div class="detail-line" dir="rtl">כיתה: <strong>${displayGradeLevel}</strong></div>
                            <div class="detail-line" dir="rtl">שיעור מספר: <strong>${displayLessonNumber}</strong></div>
                            <div class="detail-line" dir="rtl">נושא השיעור: <strong>${lessonTitle || 'לא ידוע'}</strong></div>
                            <div class="detail-line" dir="rtl">מורה: <strong>${teacherName}</strong></div>
                            <div class="detail-line" dir="rtl">תאריך: <strong>${lessonDate || new Date().toLocaleDateString('he-IL')}</strong></div>
                        </div>
                        
                        <div class="section" dir="rtl">
                            <div class="section-title" dir="rtl">ביצוע משימות:</div>
                            <div class="stats" dir="rtl">
                                בוצעו: ${completedTasksCount} מתוך ${totalTasksCount} משימות
                            </div>
                        </div>
                        
                        <div class="section" dir="rtl">
                            <div class="section-title" dir="rtl">משימות שלא בוצעו (${totalTasksCount - completedTasksCount}):</div>
                            <div class="tasks-list" dir="rtl">${incompleteTasksList}</div>
                        </div>
                        
                        <div class="section" dir="rtl">
                            <div class="section-title" dir="rtl">הערות המדריך:</div>
                            <div class="notes" dir="rtl">${notes || 'לא נוספו הערות'}</div>
                        </div>
                        
                        <div class="footer" dir="rtl">
                            מזהה דיווח: ${lessonReportId || 'לא זמין'}<br>
                            מערכת ניהול החינוך - Leaders
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
`;

    const emailResults: any[] = [];

    for (const email of adminEmails) {
      try {
        console.log(`📤 Attempting to send email to: ${email}`);

        const emailPayload = {
          sender: {
            name: BREVO_SENDER_NAME,
            email: BREVO_SENDER_EMAIL
          },
          ...(BREVO_REPLY_TO_EMAIL ? { replyTo: { email: BREVO_REPLY_TO_EMAIL, name: BREVO_SENDER_NAME } } : {}),
          to: [{ email, name: "Admin" }],
          subject,
          textContent,
          htmlContent
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
    console.log('=== INCOMPLETE TASKS NOTIFICATION END ===');

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
