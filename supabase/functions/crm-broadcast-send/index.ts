import { createClient } from 'jsr:@supabase/supabase-js'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Institution {
  id: string
  name: string
  crm_interests: string[] | null
}

interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface LogEntry {
  broadcast_id: string
  institution_id: string
  contact_id: string | null
  phone: string | null
  email: string | null
  status: 'sent' | 'failed' | 'skipped'
  error_message: string | null
}

// ── Variable replacement ───────────────────────────────────────────────────────

function replaceVars(
  body: string,
  institution: Institution,
  contact: Contact | null
): string {
  const contactName = contact?.name?.split(' ')[0] ?? institution.name
  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
  const program = institution.crm_interests?.[0] ?? ''

  return body
    .replace(/\[שם\]/g, contactName)
    .replace(/\[שם_מוסד\]/g, institution.name)
    .replace(/\[שם_שולח\]/g, 'צוות דיגי-טק')
    .replace(/\[תאריך\]/g, dateStr)
    .replace(/\[תוכנית\]/g, program)
}

// ── Resolve recipients ─────────────────────────────────────────────────────────

async function resolveRecipients(
  supabase: ReturnType<typeof createClient>,
  audienceType: string,
  audienceFilter: Record<string, unknown>
): Promise<Institution[]> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  if (audienceType === 'manual') {
    const listId = audienceFilter?.list_id as string | undefined
    if (!listId) return []
    const { data: members, error: mErr } = await supabase
      .from('crm_list_members')
      .select('institution_id')
      .eq('list_id', listId)
    if (mErr) throw mErr
    const ids = (members ?? []).map((m: { institution_id: string }) => m.institution_id)
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('educational_institutions')
      .select('id, name, crm_interests')
      .in('id', ids)
    if (error) throw error
    return (data ?? []) as Institution[]
  }

  let query = supabase.from('educational_institutions').select('id, name, crm_interests')

  switch (audienceType) {
    case 'new_leads':
      query = query.eq('crm_class', 'Lead').gte('created_at', monthStart.toISOString())
      break
    case 'no_reply':
      query = query
        .eq('crm_stage', 'מעוניין')
        .or(`crm_last_contact_at.is.null,crm_last_contact_at.lt.${sevenDaysAgo}`)
      break
    case 'renewal':
      query = query.eq('crm_class', 'Customer')
      break
    case 'all_active':
      query = query.in('crm_class', ['Lead', 'Customer'])
      break
    default:
      return []
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Institution[]
}

// ── Get primary contact for institution ────────────────────────────────────────

async function getPrimaryContact(
  supabase: ReturnType<typeof createClient>,
  institutionId: string
): Promise<Contact | null> {
  const { data: primary } = await supabase
    .from('crm_contacts')
    .select('id, name, phone, email')
    .eq('institution_id', institutionId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle()
  if (primary) return primary as Contact

  const { data: fallback } = await supabase
    .from('crm_contacts')
    .select('id, name, phone, email')
    .eq('institution_id', institutionId)
    .limit(1)
    .maybeSingle()
  return (fallback ?? null) as Contact | null
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { broadcast_id, user_id } = await req.json() as {
      broadcast_id: string
      user_id?: string
    }

    if (!broadcast_id) {
      return new Response(JSON.stringify({ ok: false, error: 'broadcast_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch broadcast row
    const { data: broadcast, error: bErr } = await supabase
      .from('crm_broadcasts')
      .select('id, channel, template_id, audience_type, audience_filter')
      .eq('id', broadcast_id)
      .single()
    if (bErr) throw new Error(`Broadcast fetch: ${bErr.message}`)

    // 2. Fetch template
    const { data: template, error: tErr } = await supabase
      .from('crm_message_templates')
      .select('body, subject, channel')
      .eq('id', broadcast.template_id)
      .single()
    if (tErr) throw new Error(`Template fetch: ${tErr.message}`)

    // 3. Resolve recipients
    const recipients = await resolveRecipients(
      supabase,
      broadcast.audience_type,
      (broadcast.audience_filter ?? {}) as Record<string, unknown>
    )
    console.log(`[crm-broadcast-send] ${recipients.length} recipients for broadcast ${broadcast_id}`)

    // 4. Send to each recipient
    const logs: LogEntry[] = []
    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const institution of recipients) {
      const contact = await getPrimaryContact(supabase, institution.id)

      if (!contact) {
        logs.push({
          broadcast_id, institution_id: institution.id, contact_id: null,
          phone: null, email: null, status: 'skipped', error_message: 'no contact found',
        })
        skippedCount++
        continue
      }

      const message = replaceVars(template.body, institution, contact)
      let entry: LogEntry

      try {
        if (broadcast.channel === 'whatsapp') {
          const phone = contact.phone
          if (!phone) {
            logs.push({
              broadcast_id, institution_id: institution.id, contact_id: contact.id,
              phone: null, email: null, status: 'skipped', error_message: 'no phone',
            })
            skippedCount++
            continue
          }
          const { error: sendErr } = await supabase.functions.invoke('crm-ghl', {
            body: {
              action: 'send_whatsapp',
              payload: {
                phone,
                message,
                contactName: contact.name,
                institution_id: institution.id,
                contact_id: contact.id,
                user_id: user_id ?? null,
              },
            },
          })
          if (sendErr) throw sendErr
          entry = {
            broadcast_id, institution_id: institution.id, contact_id: contact.id,
            phone, email: null, status: 'sent', error_message: null,
          }
          sentCount++
        } else {
          // email
          const email = contact.email
          if (!email) {
            logs.push({
              broadcast_id, institution_id: institution.id, contact_id: contact.id,
              phone: null, email: null, status: 'skipped', error_message: 'no email',
            })
            skippedCount++
            continue
          }
          const subject = template.subject
            ? replaceVars(template.subject, institution, contact)
            : `עדכון מצוות דיגי-טק — ${institution.name}`
          const { error: sendErr } = await supabase.functions.invoke('crm-ghl', {
            body: {
              action: 'send_email',
              payload: {
                email,
                subject,
                body: message,
                contactName: contact.name,
                institution_id: institution.id,
                contact_id: contact.id,
                user_id: user_id ?? null,
              },
            },
          })
          if (sendErr) throw sendErr
          entry = {
            broadcast_id, institution_id: institution.id, contact_id: contact.id,
            phone: null, email, status: 'sent', error_message: null,
          }
          sentCount++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[crm-broadcast-send] Failed for institution ${institution.id}:`, msg)
        entry = {
          broadcast_id, institution_id: institution.id, contact_id: contact.id,
          phone: broadcast.channel === 'whatsapp' ? contact.phone : null,
          email: broadcast.channel === 'email' ? contact.email : null,
          status: 'failed', error_message: msg,
        }
        failedCount++
      }

      logs.push(entry)

      // Rate-limit guard for Green API
      await new Promise(r => setTimeout(r, 100))
    }

    // 5. Batch insert logs
    if (logs.length > 0) {
      const { error: logErr } = await supabase.from('crm_broadcast_log').insert(logs)
      if (logErr) console.error('[crm-broadcast-send] Log insert error:', logErr.message)
    }

    // 6. Update broadcast status
    const { error: updateErr } = await supabase
      .from('crm_broadcasts')
      .update({
        status: failedCount === recipients.length ? 'failed' : 'sent',
        sent_at: new Date().toISOString(),
        recipient_count: sentCount,
      })
      .eq('id', broadcast_id)
    if (updateErr) console.error('[crm-broadcast-send] Status update error:', updateErr.message)

    return new Response(JSON.stringify({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[crm-broadcast-send] Fatal error:', message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
