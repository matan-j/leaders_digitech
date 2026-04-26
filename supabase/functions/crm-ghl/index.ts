const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const GREEN_API_URL = Deno.env.get('GREEN_API_URL')!
const GREEN_API_INSTANCE_ID = Deno.env.get('GREEN_API_INSTANCE_ID')!
const GREEN_API_TOKEN = Deno.env.get('GREEN_API_TOKEN')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmail(payload: { email: string; subject: string; body: string; contactName: string }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Leaders CRM', email: 'fransesguy1@gmail.com' },
      to: [{ email: payload.email, name: payload.contactName }],
      subject: payload.subject,
      htmlContent: `<div dir="rtl">${payload.body}</div>`,
      textContent: payload.body,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error ${res.status}: ${err}`)
  }
  return { ok: true }
}

async function sendWhatsApp(payload: { phone: string; message: string; contactName: string }) {
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
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Green API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  console.log('[crm-ghl] WhatsApp sent:', data)
  return { ok: true, idMessage: data.idMessage }
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
