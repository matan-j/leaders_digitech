import { createClient } from 'jsr:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function invokeCrmGhl(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('crm-ghl', { body })
  if (error) throw error

  const response = data as { ok?: boolean; error?: string; data?: { communication_id?: string | null } } | null
  if (!response?.ok) {
    throw new Error(response?.error ?? 'crm-ghl send failed')
  }

  return response.data?.communication_id ?? null
}

function replaceVariables(body: string, vars: Record<string, string>): string {
  return body
    .replace(/\[שם\]/g, vars.contactName ?? '')
    .replace(/\[שם_מוסד\]/g, vars.institutionName ?? '')
    .replace(/\[שם_שולח\]/g, vars.senderName ?? 'Leaders')
    .replace(/\[תאריך\]/g, vars.date ?? new Date().toLocaleDateString('he-IL'))
    .replace(/\[תוכנית\]/g, vars.program ?? '')
    .replace(/\{\{שם\}\}/g, vars.contactName ?? '')
    .replace(/\{\{שם_מוסד\}\}/g, vars.institutionName ?? '')
    .replace(/\{\{מוסד\}\}/g, vars.institutionName ?? '')
    .replace(/\{\{שם_שולח\}\}/g, vars.senderName ?? 'Leaders')
    .replace(/\{\{תאריך\}\}/g, vars.date ?? new Date().toLocaleDateString('he-IL'))
    .replace(/\{\{תוכנית\}\}/g, vars.program ?? '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { institution_id, new_stage, old_stage } = await req.json() as {
      institution_id: string
      new_stage: string
      old_stage: string | null
    }

    if (!institution_id || !new_stage) {
      throw new Error('institution_id and new_stage are required')
    }

    // Skip if stage hasn't changed
    if (old_stage === new_stage) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Find active automation rules for this stage
    const { data: rules, error: rulesErr } = await supabase
      .from('crm_automation_rules')
      .select('id, channel, template_id, delay_minutes')
      .eq('trigger_type', 'stage_enter')
      .eq('trigger_value', new_stage)
      .eq('is_active', true)

    if (rulesErr) throw rulesErr
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ ok: true, fired: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get institution data
    const { data: inst, error: instErr } = await supabase
      .from('educational_institutions')
      .select('id, name, city')
      .eq('id', institution_id)
      .single()

    if (instErr) throw instErr

    // 3. Get primary contact, fallback to any contact
    let { data: contact } = await supabase
      .from('crm_contacts')
      .select('id, name, phone, email')
      .eq('institution_id', institution_id)
      .eq('is_primary', true)
      .maybeSingle()

    if (!contact) {
      const { data: fallback } = await supabase
        .from('crm_contacts')
        .select('id, name, phone, email')
        .eq('institution_id', institution_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      contact = fallback ?? null
    }

    const vars = {
      institutionName: inst.name ?? '',
      contactName: contact?.name ?? inst.name ?? '',
      senderName: 'Leaders',
      date: new Date().toLocaleDateString('he-IL'),
      program: '',
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single()

    let fired = 0

    for (const rule of rules) {
      if (!rule.template_id) continue

      // 4. Get template
      const { data: tmpl } = await supabase
        .from('crm_message_templates')
        .select('body, subject, channel')
        .eq('id', rule.template_id)
        .single()

      if (!tmpl) continue

      const message = replaceVariables(tmpl.body, vars)

      try {
        let communicationId: string | null = null
        if (rule.channel === 'whatsapp' && contact?.phone) {
          communicationId = await invokeCrmGhl(supabase, {
            action: 'send_whatsapp',
            payload: {
                phone: contact.phone,
                message,
                contactName: vars.contactName,
                institution_id,
                contact_id: contact.id,
                user_id: adminProfile?.id ?? null,
                template_id: rule.template_id,
                automation_rule_id: rule.id,
                skip_activity_log: true,
                require_communication_log: true,
            },
          })
        } else if (rule.channel === 'email' && contact?.email) {
          communicationId = await invokeCrmGhl(supabase, {
            action: 'send_email',
            payload: {
                email: contact.email,
                subject: tmpl.subject ? replaceVariables(tmpl.subject, vars) : `עדכון — ${inst.name}`,
                body: message,
                contactName: vars.contactName,
                institution_id,
                contact_id: contact.id,
                user_id: adminProfile?.id ?? null,
                template_id: rule.template_id,
                automation_rule_id: rule.id,
                skip_activity_log: true,
                require_communication_log: true,
            },
          })
        } else {
          // No contact info available — skip silently
          continue
        }

        // 5. Log to crm_activities
        const { data: activity } = await supabase.from('crm_activities').insert({
          institution_id,
          user_id: adminProfile?.id ?? undefined,
          type: rule.channel === 'whatsapp' ? 'וואטסאפ' : 'מייל',
          summary: `אוטומציה: כניסה לשלב "${new_stage}" — נשלחה הודעה לפי תבנית`,
          status: 'Completed',
        }).select('id').single()

        if (communicationId && activity?.id) {
          await supabase
            .from('crm_communications')
            .update({ activity_id: activity.id })
            .eq('id', communicationId)
        }

        fired++
      } catch (_sendErr) {
        // Log failure but continue processing other rules
        console.error('Failed to send automation message:', _sendErr)
      }
    }

    return new Response(JSON.stringify({ ok: true, fired }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
