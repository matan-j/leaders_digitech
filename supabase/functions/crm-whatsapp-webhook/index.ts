import { createClient } from 'jsr:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GREEN_API_WEBHOOK_SECRET = Deno.env.get('GREEN_API_WEBHOOK_SECRET')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

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
  rawPhone: string,
): Promise<MatchResult | null> {
  const normalized = normalizePhone(rawPhone)
  const variants = israeliVariants(normalized)

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

  const { data: insts, error: iErr } = await supabase
    .from('educational_institutions')
    .select('id, phone')
    .not('phone', 'is', null)

  if (iErr) {
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
  messagePrefix: string,
  providerMessageId: string | null,
): Promise<boolean> {
  if (providerMessageId) {
    const [{ data: matched }, { data: unmatched }] = await Promise.all([
      supabase
        .from('crm_communications')
        .select('id')
        .eq('provider', 'green_api')
        .eq('provider_message_id', providerMessageId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('crm_unmatched_communications')
        .select('id')
        .eq('provider', 'green_api')
        .eq('provider_message_id', providerMessageId)
        .limit(1)
        .maybeSingle(),
    ])
    return matched !== null || unmatched !== null
  }

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

function getProviderMessageId(body: Record<string, unknown>): string | null {
  const direct = body.idMessage
  if (typeof direct === 'string') return direct

  const messageData = body.messageData
  if (messageData && typeof messageData === 'object' && 'idMessage' in messageData) {
    const nested = (messageData as Record<string, unknown>).idMessage
    if (typeof nested === 'string') return nested
  }

  return null
}

async function logUnmatchedInboundCommunication(params: {
  supabase: ReturnType<typeof createClient>
  textMessage: string
  rawPhone: string
  occurredAt: string
  providerMessageId: string | null
  providerPayload: Record<string, unknown>
}) {
  const { error } = await params.supabase.from('crm_unmatched_communications').insert({
    channel: 'whatsapp',
    direction: 'inbound',
    body_text: params.textMessage,
    sender_address: params.rawPhone,
    recipient_name: 'Leaders CRM',
    provider: 'green_api',
    provider_message_id: params.providerMessageId,
    provider_status: 'received',
    provider_payload: params.providerPayload,
    status: 'unmatched',
    occurred_at: params.occurredAt,
  })

  if (error) {
    console.error('[crm-whatsapp-webhook] unmatched communication insert error:', error.message)
  }
}

async function logInboundCommunication(params: {
  supabase: ReturnType<typeof createClient>
  institution_id: string
  contact_id: string | null
  activity_id: string | null
  textMessage: string
  rawPhone: string
  occurredAt: string
  providerMessageId: string | null
  providerPayload: Record<string, unknown>
}) {
  const { error } = await params.supabase.from('crm_communications').insert({
    institution_id: params.institution_id,
    contact_id: params.contact_id,
    activity_id: params.activity_id,
    channel: 'whatsapp',
    direction: 'inbound',
    body_text: params.textMessage,
    sender_address: params.rawPhone,
    recipient_name: 'Leaders CRM',
    provider: 'green_api',
    provider_message_id: params.providerMessageId,
    provider_status: 'received',
    provider_payload: params.providerPayload,
    status: 'received',
    received_at: params.occurredAt,
    occurred_at: params.occurredAt,
  })

  if (error) {
    console.error('[crm-whatsapp-webhook] communication insert error:', error.message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ok200 = (reason?: string) => {
    if (reason) console.log('[crm-whatsapp-webhook]', reason)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
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

    const body = await req.json() as Record<string, unknown>

    if (body.typeWebhook !== 'incomingMessageReceived') {
      return ok200(`Ignored webhook type: ${body.typeWebhook}`)
    }

    const messageData = body.messageData as Record<string, unknown> | undefined
    const messageType = messageData?.typeMessage
    if (messageType !== 'textMessage') {
      return ok200(`Ignored message type: ${messageType}`)
    }

    const textMessageData = messageData?.textMessageData as Record<string, unknown> | undefined
    const textMessage = typeof textMessageData?.textMessage === 'string' ? textMessageData.textMessage : ''
    if (!textMessage) {
      return ok200('Empty textMessage body')
    }

    const senderData = body.senderData as Record<string, unknown> | undefined
    const chatId = typeof senderData?.chatId === 'string' ? senderData.chatId : ''
    const rawPhone = chatId.replace('@c.us', '')
    if (!rawPhone) {
      return ok200('No chatId in senderData')
    }

    const occurredAt = typeof body.timestamp === 'number'
      ? new Date(body.timestamp * 1000).toISOString()
      : new Date().toISOString()

    const providerMessageId = getProviderMessageId(body)
    const messagePrefix = textMessage.slice(0, 100)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const match = await findInstitution(supabase, rawPhone)
    const alreadyLogged = await isDuplicate(
      supabase,
      match?.institution_id ?? '',
      occurredAt,
      messagePrefix,
      providerMessageId,
    )
    if (alreadyLogged) {
      return ok200(`Duplicate message skipped for provider message ${providerMessageId ?? messagePrefix}`)
    }

    if (!match) {
      await logUnmatchedInboundCommunication({
        supabase,
        textMessage,
        rawPhone,
        occurredAt,
        providerMessageId,
        providerPayload: body,
      })
      console.log(`[crm-whatsapp-webhook] Stored unmatched inbound message for phone: ${rawPhone}`)
      return ok200()
    }

    const summary = textMessage.slice(0, 1000)
    const { data: activity, error: insertErr } = await supabase.from('crm_activities').insert({
      institution_id: match.institution_id,
      contact_id: match.contact_id,
      user_id: null,
      type: 'וואטסאפ',
      direction: 'inbound',
      summary,
      status: 'Completed',
      occurred_at: occurredAt,
    }).select('id').single()

    if (insertErr) {
      console.error('[crm-whatsapp-webhook] Insert error:', insertErr.message)
      return ok200()
    }

    await logInboundCommunication({
      supabase,
      institution_id: match.institution_id,
      contact_id: match.contact_id,
      activity_id: activity?.id ?? null,
      textMessage,
      rawPhone,
      occurredAt,
      providerMessageId,
      providerPayload: body,
    })

    console.log(
      `[crm-whatsapp-webhook] Logged inbound message for institution ${match.institution_id}`,
      `contact=${match.contact_id ?? 'none'}`,
      `phone=${rawPhone}`,
    )

    return ok200()
  } catch (err) {
    console.error('[crm-whatsapp-webhook] Unhandled error:', err)
    return ok200()
  }
})
