import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ActionContext = Record<string, unknown>

const PROMPTS: Record<string, (ctx: ActionContext) => string> = {
  daily_summary: (ctx) => `אתה יועץ מכירות בכיר. נתח את הפייפליין הבא ותן סיכום בעברית ב-4 קטגוריות בדיוק:
פייפליין: ${JSON.stringify(ctx)}
החזר JSON בלבד: {"closing_soon": "...", "stuck": "...", "renewal": "...", "recommendation": "..."}`,

  institution_analysis: (ctx) => `נתח את המוסד הבא ותן ניתוח מכירות בעברית:
${JSON.stringify(ctx)}
החזר JSON: {"score": 0-100, "close_probability": "0-100%", "next_step": "...", "risks": ["..."], "opportunities": ["..."]}`,

  generate_template: (ctx) => `כתוב הודעת ${ctx['channel'] === 'whatsapp' ? 'וואטסאפ' : 'מייל'} בעברית לשלב "${ctx['stage']}" במכירה של תוכניות חינוך דיגיטלי לבתי ספר.
השתמש במשתנים: [שם], [שם_מוסד], [שם_שולח], [תאריך], [תוכנית]
החזר רק את טקסט ההודעה, ללא הסברים.`,

  next_step: (ctx) => `בהתאם למידע הבא על הליד, המלץ על 2-3 צעדים הבאים קונקרטיים בעברית:
${JSON.stringify(ctx)}
החזר JSON: {"steps": ["צעד 1", "צעד 2", "צעד 3"]}`,

  risk_analysis: (ctx) => `נתח סיכונים בסגירת העסקה עם המוסד הבא:
${JSON.stringify(ctx)}
החזר JSON: {"risks": [{"title": "...", "severity": "high/medium/low", "mitigation": "..."}]}`,

  draft_email: (ctx) => `כתוב מייל follow-up מקצועי בעברית ל${ctx['contact_name']} מ${ctx['institution_name']} בשלב ${ctx['stage']}.
החזר JSON: {"subject": "...", "body": "..."}`,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
    const { action, context } = await req.json() as { action: string; context: ActionContext }

    const promptFn = PROMPTS[action]
    if (!promptFn) throw new Error(`Unknown action: ${action}`)
    const prompt = promptFn(context)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json() as { content: { text: string }[] }
    const result = data.content[0].text

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
