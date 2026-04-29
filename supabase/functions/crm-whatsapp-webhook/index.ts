import { createClient } from 'jsr:@supabase/supabase-js'

const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GREEN_API_WEBHOOK_SECRET   = Deno.env.get('GREEN_API_WEBHOOK_SECRET')   // optional for initial testing

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Normalize a phone string to digits only, no leading +
// e.g. "+972-50-123-4567" → "972501234567"
//      "050 123 4567"     → "0501234567"  (will still be compared against stored values)
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

// Green API always sends 972XXXXXXXXX; convert to 0XXXXXXXXX as well
// so we can match against contacts stored as "05X..."
function israeliVariants(phone: string): string[] {
  const variants = [phone]
  if (phone.startsWith('972')) {
    variants.push('0' + phone.slice(3))
  } else if (phone.startsWith('0')) {
    variants.push('972' + phone.slice(1))
  }
  return variants
}

interface MatchResult {
  institution_id: string
  contact_id: string | null
}

async function findInstitution(
  supabase: ReturnType<typeof createClient>,
  rawPhone: string
): Promise<MatchResult | null> {
  const normalized = normalizePhone(rawPhone)
  const variants   = israeliVariants(normalized)

  // ── Pass 1: crm_contacts ──────────────────────────────────────
  // Fetch all contacts and normalize server-side to avoid needing
  // a DB function for regex. Contacts table is small (<10k rows).
  const { data: contacts, error: cErr } = await supabase
    .from('crm_contacts')
    .select('id, institution_id, phone')
    .not('phone', 'is', null)

  if (cErr) {
    console.error('[crm-whatsapp-webhook] crm_contacts query error:', cErr.message)
  } else if (contacts) {
    for (const c of contacts) {
      const stored = normalizePhone(c.phone as string)
      if (variants.includes(stored)) {
        console.log(`[crm-whatsapp-webhook] Matched via crm_contacts id=${c.id}`)
        return { institution_id: c.institution_id as string, contact_id: c.id as string }
      }
    }
  }

  // ── Pass 2: educational_institutions.phone ────────────────────
  // NOTE: educational_institutions currently has no `phone` column.
  // This query will return an empty result set until a phone column
  // is added to the table (migration required).
  const { data: insts, error: iErr } = await supabase
    .from('educational_institutions')
    .select('id, phone')
    .not('phone', 'is', null)

  if (iErr) {
    // Column likely doesn't exist yet — log and skip silently
    console.warn('[crm-whatsapp-webhook] educational_institutions.phone not available:', iErr.message)
  } else if (insts) {
    for (const inst of insts) {
      const stored = normalizePhone((inst as Record<string, unknown>).phone as string)
      if (variants.includes(stored)) {
        console.log(`[crm-whatsapp-webhook] Matched via educational_institutions id=${inst.id}`)
        return { institution_id: inst.id as string, contact_id: null }
      }
    }
  }

  return null
}

async function isDuplicate(
  supabase: ReturnType<typeof createClient>,
  institution_id: string,
  occurredAt: string,
  messagePrefix: string
): Promise<boolean> {
  const { data } = await supabase
    .from('crm_activities')
    .select('id')
    .eq('institution_id', institution_id)
    .eq('occurred_at', occurredAt)
    .like('summary', messagePrefix + '%')
    .limit(1)
    .maybeSingle()

  return data !== null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Always return 200 to Green API — even on errors — to prevent infinite retries
  const ok200 = (reason?: string) => {
    if (reason) console.log('[crm-whatsapp-webhook]', reason)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── Secret check ────────────────────────────────────────────
    if (GREEN_API_WEBHOOK_SECRET) {
      const incomingSecret = req.headers.get('x-green-api-secret')
      if (incomingSecret !== GREEN_API_WEBHOOK_SECRET) {
        console.warn('[crm-whatsapp-webhook] Invalid secret, returning 403')
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const body = await req.json()

    // ── Filter webhook type ─────────────────────────────────────
    if (body.typeWebhook !== 'incomingMessageReceived') {
      return ok200(`Ignored webhook type: ${body.typeWebhook}`)
    }

    // ── Filter message type ─────────────────────────────────────
    const messageType = body.messageData?.typeMessage
    if (messageType !== 'textMessage') {
      return ok200(`Ignored message type: ${messageType}`)
    }

    const textMessage: string = body.messageData?.textMessageData?.textMessage ?? ''
    if (!textMessage) {
      return ok200('Empty textMessage body')
    }

    // ── Extract sender phone ────────────────────────────────────
    const chatId: string = body.senderData?.chatId ?? ''
    const rawPhone = chatId.replace('@c.us', '')
    if (!rawPhone) {
      return ok200('No chatId in senderData')
    }

    // ── Convert Green API timestamp (Unix seconds) to ISO string ─
    const occurredAt = body.timestamp
      ? new Date((body.timestamp as number) * 1000).toISOString()
      : new Date().toISOString()

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ── Match phone to institution ──────────────────────────────
    const match = await findInstitution(supabase, rawPhone)
    if (!match) {
      console.log(`[crm-whatsapp-webhook] No institution found for phone: ${rawPhone}`)
      return ok200()
    }

    const summary       = textMessage.slice(0, 1000)
    const messagePrefix = textMessage.slice(0, 100)

    // ── Idempotency check ───────────────────────────────────────
    const alreadyLogged = await isDuplicate(
      supabase,
      match.institution_id,
      occurredAt,
      messagePrefix
    )
    if (alreadyLogged) {
      return ok200(`Duplicate message skipped for institution ${match.institution_id}`)
    }

    // ── Insert inbound activity ─────────────────────────────────
    const { error: insertErr } = await supabase.from('crm_activities').insert({
      institution_id: match.institution_id,
      contact_id:     match.contact_id,
      user_id:        null,
      type:           'וואטסאפ',
      direction:      'inbound',
      summary,
      status:         'Completed',
      occurred_at:    occurredAt,
    })

    if (insertErr) {
      console.error('[crm-whatsapp-webhook] Insert error:', insertErr.message)
      // Still return 200 — don't let Green API retry on a data error
      return ok200()
    }

    console.log(
      `[crm-whatsapp-webhook] Logged inbound message for institution ${match.institution_id}`,
      `contact=${match.contact_id ?? 'none'}`,
      `phone=${rawPhone}`
    )

    return ok200()
  } catch (err) {
    console.error('[crm-whatsapp-webhook] Unhandled error:', err)
    // Must return 200 so Green API does not retry
    return ok200()
  }
})
