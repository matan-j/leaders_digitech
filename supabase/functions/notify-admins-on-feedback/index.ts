// supabase/functions/notify-admins-on-feedback/index.ts
// EmailJS version - NO RESTRICTIONS, sends to ANY email!

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
export const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
export const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL')
export const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'Leaders Digitech'
export const BREVO_REPLY_TO_EMAIL = Deno.env.get('BREVO_REPLY_TO_EMAIL')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
  throw new Error('Missing required Edge Function secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, and BREVO_SENDER_EMAIL.')
}


interface FeedbackPayload {
  courseName: string;
  lessonTitle: string;
  lessonNumber: number;
  participantsCount: number;
  notes: string;
  feedback: string;
  marketingConsent: boolean;
  instructorName: string;
}

Deno.serve(async (req) => {
  console.log(`=== ULTRA DEBUG START ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Request method: ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    // Parse request body
    const payload: FeedbackPayload = await req.json();
    console.log('✅ Request payload parsed successfully');
    console.log(`Course: ${payload.courseName}`);
    console.log(`Lesson: ${payload.lessonTitle}`);
    console.log(`Instructor: ${payload.instructorName}`);
    console.log(`Feedback: ${payload.feedback}`);

    // Create Supabase client
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client created');

    // Call the database function to get admin emails
    console.log('👥 Calling get_admin_emails() database function...');
    const { data: adminEmailsData, error: adminError } = await supabaseAdmin
      .rpc('get_admin_emails');

    if (adminError) {
      console.log(`❌ Error calling get_admin_emails function: ${adminError.message}`);
      console.log(`Admin error details:`, adminError);
      return new Response(JSON.stringify({ error: 'Admin email function failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`📧 Admin emails function result:`);
    console.log(`- Raw data from function:`, adminEmailsData);

    // Extract emails from the function result
    const adminEmails = adminEmailsData?.map((row: { email: string }) => row.email) || [];
    
    console.log(`📬 Admin emails found: ${adminEmails.length}`);
    console.log(`Admin email addresses:`, adminEmails);

    if (adminEmails.length === 0) {
      console.log("⚠️ NO ADMIN EMAILS FOUND!");
      return new Response(JSON.stringify({ 
        message: "No admin emails found",
        adminEmailsData: adminEmailsData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Prepare email content
    const subject = `משוב שלילי על שיעור: ${payload.lessonTitle} - ${payload.courseName}`;
    const textContent = `
משוב שלילי התקבל על שיעור

המדריך ${payload.instructorName} דיווח שהשיעור הבא לא התנהל כשורה.

פרטי הדיווח:
- קורס: ${payload.courseName}
- כותרת שיעור: ${payload.lessonTitle}  
- מספר שיעור: ${payload.lessonNumber}
- מספר משתתפים: ${payload.participantsCount}
- הערות כלליות: ${payload.notes || 'אין'}
- משוב (סיבת הבעיה): ${payload.feedback}
- הסכמה לשיווק: ${payload.marketingConsent ? 'כן' : 'לא'}

תאריך הדיווח: ${new Date().toLocaleString('he-IL')}
    `;

    console.log('📨 Email content prepared');
    console.log(`Subject: ${subject}`);
    console.log(`Recipients: ${adminEmails.join(', ')}`);
    
    // SEND TO ALL ADMIN EMAILS USING BREVO (formerly Sendinblue) - NO RESTRICTIONS!
    console.log('📤 SENDING EMAILS TO ALL ADMINS - NO DOMAIN REQUIRED!');
    
    const emailResults: any = [];
    
    // Brevo API key - you'll need to get this from brevo.com (free account)
    for (const email of adminEmails) {
      try {
        console.log(`📧 Sending email to: ${email}`);
        
        const emailPayload = {
          sender: {
            name: BREVO_SENDER_NAME,
            email: BREVO_SENDER_EMAIL
          },
          ...(BREVO_REPLY_TO_EMAIL ? { replyTo: { email: BREVO_REPLY_TO_EMAIL, name: BREVO_SENDER_NAME } } : {}),
          to: [
            {
              email: email,
              name: "Admin"
            }
          ],
          subject: subject,
          textContent: textContent
        };
        
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Email sent successfully to ${email}. ID: ${result.messageId}`);
          emailResults.push({
            email,
            status: 'sent',
            messageId: result.messageId,
            message: 'Email sent successfully'
          });
        } else {
          const error = await response.json();
          console.log(`❌ Failed to send email to ${email}:`, error);
          emailResults.push({
            email,
            status: 'failed',
            error: error.message || 'Unknown error',
            message: `Failed to send: ${error.message || 'Unknown error'}`
          });
        }
      } catch (emailError: any) {
        console.log(`💥 Error sending email to ${email}:`, emailError);
        emailResults.push({
          email,
          status: 'failed',
          error: emailError?.message || 'Unknown error',
          message: `Exception: ${emailError?.message || 'Unknown error'}`
        });
      }
    }

    console.log('✅ Email sending completed');
    console.log(`Email results:`, emailResults);
    console.log(`=== ULTRA DEBUG END ===`);
    
    const successCount = emailResults.filter((r: any) => r.status === 'sent').length;
    const failureCount = emailResults.filter((r: any) => r.status === 'failed').length;
    
    return new Response(JSON.stringify({ 
      message: `🚀 Email sending completed. ${successCount} sent, ${failureCount} failed.`,
      adminEmailsFound: adminEmails.length,
      emailResults: emailResults,
      summary: {
        total: adminEmails.length,
        sent: successCount,
        failed: failureCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.log(`💥 CRITICAL ERROR: ${error?.message || 'Unknown error'}`);
    console.log(`Error details:`, error);
    console.log(`Error stack:`, error?.stack);
    
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error occurred'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
