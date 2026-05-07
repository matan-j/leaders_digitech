import { createClient } from 'jsr:@supabase/supabase-js'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const GREEN_API_URL = Deno.env.get('GREEN_API_URL')!
const GREEN_API_INSTANCE_ID = Deno.env.get('GREEN_API_INSTANCE_ID')!
const GREEN_API_TOKEN = Deno.env.get('GREEN_API_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CRM_EMAIL_SENDER = {
  name: 'Leaders CRM',
  email: 'fransesguy1@gmail.com',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function logActivity(params: {
  institution_id: string
  contact_id?: string | null
  user_id?: string | null
  type: 'וואטסאפ' | 'מייל'
  summary: string
}): Promise<string | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('crm_activities').insert({
    institution_id: params.institution_id,
    contact_id: params.contact_id ?? null,
    user_id: params.user_id ?? null,
    type: params.type,
    direction: 'outbound',
    summary: params.summary.slice(0, 500),
    status: 'Completed',
    occurred_at: new Date().toISOString(),
  }).select('id').single()

  if (error) {
    console.error('[crm-ghl] activity insert error:', error.message)
    return null
  }

  return data?.id ?? null
}

async function logCommunication(params: {
  institution_id: string
  contact_id?: string | null
  activity_id?: string | null
  channel: 'whatsapp' | 'email'
  subject?: string | null
  body_text: string
  body_html?: string | null
  sender_name?: string | null
  sender_address?: string | null
  recipient_name?: string | null
  recipient_address?: string | null
  provider: 'green_api' | 'brevo'
  provider_message_id?: string | null
  provider_status?: string | null
  provider_payload?: Record<string, unknown> | null
  broadcast_id?: string | null
  template_id?: string | null
  automation_rule_id?: string | null
  created_by?: string | null
  sent_at?: string
}): Promise<string | null> {
  const supabase = getSupabase()
  const occurredAt = params.sent_at ?? new Date().toISOString()
  const { data, error } = await supabase.from('crm_communications').insert({
    institution_id: params.institution_id,
    contact_id: params.contact_id ?? null,
    activity_id: params.activity_id ?? null,
    channel: params.channel,
    direction: 'outbound',
    subject: params.subject ?? null,
    body_text: params.body_text,
    body_html: params.body_html ?? null,
    sender_name: params.sender_name ?? CRM_EMAIL_SENDER.name,
    sender_address: params.sender_address ?? null,
    recipient_name: params.recipient_name ?? null,
    recipient_address: params.recipient_address ?? null,
    provider: params.provider,
    provider_message_id: params.provider_message_id ?? null,
    provider_status: params.provider_status ?? 'sent',
    provider_payload: params.provider_payload ?? {},
    broadcast_id: params.broadcast_id ?? null,
    template_id: params.template_id ?? null,
    automation_rule_id: params.automation_rule_id ?? null,
    status: 'sent',
    sent_at: occurredAt,
    occurred_at: occurredAt,
    created_by: params.created_by ?? null,
  }).select('id').single()

  if (error) {
    console.error('[crm-ghl] communication insert error:', error.message)
    return null
  }

  return data?.id ?? null
}

async function sendEmail(payload: {
  email: string
  subject: string
  body: string
  contactName: string
  institution_id?: string
  contact_id?: string | null
  user_id?: string | null
  broadcast_id?: string | null
  template_id?: string | null
  automation_rule_id?: string | null
  skip_activity_log?: boolean
  require_communication_log?: boolean
}) {
  const htmlContent = `<div dir="rtl">${payload.body}</div>`
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: CRM_EMAIL_SENDER,
      to: [{ email: payload.email, name: payload.contactName }],
      subject: payload.subject,
      htmlContent,
      textContent: payload.body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error ${res.status}: ${err}`)
  }

  const providerData = await res.json().catch(() => null) as Record<string, unknown> | null
  const providerMessageId = typeof providerData?.messageId === 'string' ? providerData.messageId : null
  const sentAt = new Date().toISOString()

  if (payload.institution_id) {
    const activityId = payload.skip_activity_log ? null : await logActivity({
      institution_id: payload.institution_id,
      contact_id: payload.contact_id,
      user_id: payload.user_id,
      type: 'מייל',
      summary: `${payload.subject}: ${payload.body}`,
    })

    const communicationId = await logCommunication({
      institution_id: payload.institution_id,
      contact_id: payload.contact_id,
      activity_id: activityId,
      channel: 'email',
      subject: payload.subject,
      body_text: payload.body,
      body_html: htmlContent,
      sender_name: CRM_EMAIL_SENDER.name,
      sender_address: CRM_EMAIL_SENDER.email,
      recipient_name: payload.contactName,
      recipient_address: payload.email,
      provider: 'brevo',
      provider_message_id: providerMessageId,
      provider_status: providerMessageId ? 'accepted' : 'sent',
      provider_payload: providerData,
      broadcast_id: payload.broadcast_id,
      template_id: payload.template_id,
      automation_rule_id: payload.automation_rule_id,
      created_by: payload.user_id,
      sent_at: sentAt,
    })
    if (payload.require_communication_log && !communicationId) {
      throw new Error('crm_communications insert failed')
    }

    return { ok: true, messageId: providerMessageId, communication_id: communicationId }
  }

  return { ok: true, messageId: providerMessageId, communication_id: null }
}

async function sendWhatsApp(payload: {
  phone: string
  message: string
  contactName: string
  institution_id?: string
  contact_id?: string | null
  user_id?: string | null
  broadcast_id?: string | null
  template_id?: string | null
  automation_rule_id?: string | null
  skip_activity_log?: boolean
  require_communication_log?: boolean
}) {
  let phone = payload.phone.replace(/[^0-9]/g, '')
  if (phone.startsWith('0')) phone = '972' + phone.slice(1)
  if (!phone.startsWith('972')) phone = '972' + phone
  const chatId = `${phone}@c.us`

  const res = await fetch(
    `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: payload.message }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Green API error ${res.status}: ${err}`)
  }

  const providerData = await res.json()
  const providerMessageId = typeof providerData?.idMessage === 'string' ? providerData.idMessage : null
  const sentAt = new Date().toISOString()
  console.log('[crm-ghl] WhatsApp sent:', providerData)

  if (payload.institution_id) {
    const activityId = payload.skip_activity_log ? null : await logActivity({
      institution_id: payload.institution_id,
      contact_id: payload.contact_id,
      user_id: payload.user_id,
      type: 'וואטסאפ',
      summary: payload.message,
    })

    const communicationId = await logCommunication({
      institution_id: payload.institution_id,
      contact_id: payload.contact_id,
      activity_id: activityId,
      channel: 'whatsapp',
      body_text: payload.message,
      sender_name: CRM_EMAIL_SENDER.name,
      recipient_name: payload.contactName,
      recipient_address: phone,
      provider: 'green_api',
      provider_message_id: providerMessageId,
      provider_status: providerMessageId ? 'accepted' : 'sent',
      provider_payload: providerData,
      broadcast_id: payload.broadcast_id,
      template_id: payload.template_id,
      automation_rule_id: payload.automation_rule_id,
      created_by: payload.user_id,
      sent_at: sentAt,
    })
    if (payload.require_communication_log && !communicationId) {
      throw new Error('crm_communications insert failed')
    }

    return { ok: true, idMessage: providerMessageId, communication_id: communicationId }
  }

  return { ok: true, idMessage: providerMessageId, communication_id: null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json()

    let result
    if (action === 'send_email') result = await sendEmail(payload)
    else if (action === 'send_whatsapp') result = await sendWhatsApp(payload)
    else throw new Error(`Unknown action: ${action}`)

    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[crm-ghl]', error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
