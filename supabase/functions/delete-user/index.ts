import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'


const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;



interface Assignment {
  course_name: string;
  institution_name: string;
}

interface DeletePayload {
  userId: string;
  instructorName: string;
  assignments: Assignment[];
  userType?: 'instructor' | 'system_user'; // ⬅️ הוסף את זה!
  userRole?: 'admin' | 'pedagogical_manager'; // ⬅️ והוסף את זה!
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: DeletePayload = await req.json();
    if (!payload.userId || !payload.instructorName) {
        throw new Error("Missing userId or instructorName in payload.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase ADMIN client created successfully.');

    // --- Part 1: Send Notification Email ---
    console.log('📞 Fetching admin emails from get_admin_emails()');
    const { data: adminEmailsData, error: adminError } = await supabaseAdmin
      .rpc('get_admin_emails');

    if (adminError) {
      console.error('❌ Failed to get admin emails:', adminError);
      return new Response(JSON.stringify({ error: 'Failed to fetch admin emails', details: adminError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const adminEmails = adminEmailsData?.map((row: { email: string }) => row.email) || [];

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No admin emails configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`📬 Admin emails found: ${adminEmails.length}`, adminEmails);
    
    if (adminEmails.length > 0) {
      // ⬇️⬇️⬇️ כאן השינוי הגדול! ⬇️⬇️⬇️
      let subject = '';
      let htmlContent = '';
      
      if (payload.userType === 'system_user') {
        // 🔹 Email for System User deletion
        const roleText = payload.userRole === 'admin' ? 'מנהל מערכת' : 'מנהל פדגוגי';
        subject = `התראה: משתמש מערכת (${roleText}) הוסר - ${payload.instructorName}`;
        htmlContent = `
          <div dir="rtl" style="font-family: Arial, sans-serif;">
            <h2 style="color: #dc2626;">🛡️ משתמש מערכת הוסר מהמערכת</h2>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>שם:</strong> ${payload.instructorName}</p>
              <p><strong>תפקיד:</strong> ${roleText}</p>
              <p><strong>זמן המחיקה:</strong> ${new Date().toLocaleString('he-IL', { 
                timeZone: 'Asia/Jerusalem',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            <p style="color: #666;">פעולה זו בוצעה על ידי מנהל מערכת.</p>
          </div>
        `;
      } else {
        // 🔹 Email for Instructor deletion (existing logic)
        subject = `התראה: המדריך ${payload.instructorName} הוסר מהמערכת`;
        const assignmentsHtml = payload.assignments.length > 0
          ? `<ul>${payload.assignments.map(a => `<li><b>${a.course_name}</b> במוסד ${a.institution_name}</li>`).join('')}</ul>`
          : "<p>לא היו למדריך זה הקצאות פעילות.</p>";
        
        htmlContent = `
          <div dir="rtl" style="font-family: Arial, sans-serif;">
            <h2 style="color: #dc2626;">👨‍🏫 מדריך הוסר מהמערכת</h2>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p>המדריך <strong>${payload.instructorName}</strong> הוסר מהמערכת.</p>
              <p><strong>זמן המחיקה:</strong> ${new Date().toLocaleString('he-IL', { 
                timeZone: 'Asia/Jerusalem',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            <h3>הקצאות משויכות:</h3>
            ${assignmentsHtml}
          </div>
        `;
      }
      // ⬆️⬆️⬆️ סוף השינוי ⬆️⬆️⬆️
      
      // 🔥 לולאה על כל האדמינים
      for (const adminEmail of adminEmails) {
        console.log(`📮 Sending email to: ${adminEmail}`);
        
        const emailPayload = {
          sender: { name: "Leaders Admin System", email: "fransesguy1@gmail.com" },
          to: [{ email: adminEmail, name: "Admin" }],
          subject: subject,
          htmlContent: htmlContent
        };
        
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        });
        
        const emailResult = await emailResponse.text();
        console.log(`📧 Brevo Response for ${adminEmail}:`, emailResponse.status, emailResult);
        
        if (!emailResponse.ok) {
          console.error(`❌ Failed to send to ${adminEmail}: ${emailResult}`);
        }
      }
      
      console.log('✅ All notification emails sent.');
    }

    // --- Part 2: Securely Delete the User ---
    console.log(`🔥 Deleting user with ID: ${payload.userId}`);
    
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(payload.userId);
    if (authError && authError.message !== 'User not found') {
        throw authError;
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', payload.userId);
    if (profileError) {
        throw profileError;
    }

    console.log('✅ User successfully deleted from auth and profiles.');

    return new Response(JSON.stringify({ message: "Process complete." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.log(`💥 CRITICAL ERROR: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});