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
    // Find active no_contact rules
    const { data: rules, error: rulesErr } = await supabase
      .from('crm_automation_rules')
      .select('id, channel, template_id, trigger_value, delay_minutes')
      .eq('trigger_type', 'no_contact')
      .eq('is_active', true)

    if (rulesErr) throw rulesErr
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ ok: true, fired: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let fired = 0

    for (const rule of rules) {
      const days = parseInt(rule.trigger_value ?? '7', 10)
      if (isNaN(days) || days <= 0) continue

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      const cutoffIso = cutoff.toISOString()

      // Find Lead institutions with no contact since cutoff
      const { data: institutions } = await supabase
        .from('educational_institutions')
        .select('id, name, city, crm_last_contact_at')
        .eq('crm_class', 'Lead')
        .or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${cutoffIso}`)

      if (!institutions || institutions.length === 0) continue

      if (!rule.template_id) continue

      const { data: tmpl } = await supabase
        .from('crm_message_templates')
        .select('body, subject, channel')
        .eq('id', rule.template_id)
        .single()

      if (!tmpl) continue

      // Get admin user id for logging
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()

      for (const inst of institutions) {
        const { data: contact } = await supabase
          .from('crm_contacts')
          .select('id, name, phone, email')
          .eq('institution_id', inst.id)
          .eq('is_primary', true)
          .maybeSingle()

        const vars = {
          institutionName: inst.name ?? '',
          contactName: contact?.name ?? inst.name ?? '',
          senderName: 'Leaders',
          date: new Date().toLocaleDateString('he-IL'),
          program: '',
        }

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
                  institution_id: inst.id,
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
                  subject: tmpl.subject ? replaceVariables(tmpl.subject, vars) : `תזכורת — ${inst.name}`,
                  body: message,
                  contactName: vars.contactName,
                  institution_id: inst.id,
                  contact_id: contact.id,
                  user_id: adminProfile?.id ?? null,
                  template_id: rule.template_id,
                  automation_rule_id: rule.id,
                  skip_activity_log: true,
                  require_communication_log: true,
              },
            })
          } else {
            continue
          }

          if (adminProfile?.id) {
            const { data: activity } = await supabase.from('crm_activities').insert({
              institution_id: inst.id,
              user_id: adminProfile.id,
              type: rule.channel === 'whatsapp' ? 'וואטסאפ' : 'מייל',
              summary: `אוטומציה: ללא קשר ${days} ימים — נשלחה הודעה אוטומטית`,
              status: 'Completed',
            }).select('id').single()

            if (communicationId && activity?.id) {
              await supabase
                .from('crm_communications')
                .update({ activity_id: activity.id })
                .eq('id', communicationId)
            }
          }

          fired++
        } catch (_sendErr) {
          console.error('Cron automation send failed:', _sendErr)
        }
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
