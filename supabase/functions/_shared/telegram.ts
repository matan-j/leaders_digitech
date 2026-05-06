// supabase/functions/_shared/telegram.ts
// Lightweight Telegram Bot API client for Supabase Edge Functions (Deno).

export interface TelegramSendResult {
  ok: boolean;
  status: number;
  durationMs: number;
  description?: string;
}

export async function sendTelegramMessage(
  text: string,
  options?: { chatId?: string; parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'; disableNotification?: boolean }
): Promise<TelegramSendResult> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = options?.chatId ?? Deno.env.get('TELEGRAM_CEO_CHAT_ID');

  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN missing');
    return { ok: false, status: 0, durationMs: 0, description: 'token missing' };
  }
  if (!chatId) {
    console.error('[telegram] chat id missing');
    return { ok: false, status: 0, durationMs: 0, description: 'chat id missing' };
  }

  const start = Date.now();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode ?? 'HTML',
        disable_web_page_preview: true,
        disable_notification: options?.disableNotification ?? false,
      }),
    });
    const ms = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
      console.error('[telegram] send failed', { status: res.status, body });
      return { ok: false, status: res.status, durationMs: ms, description: body?.description ?? 'send failed' };
    }
    console.log('[telegram] sent', { status: res.status, ms });
    return { ok: true, status: res.status, durationMs: ms };
  } catch (err) {
    const ms = Date.now() - start;
    console.error('[telegram] fetch error', err);
    return { ok: false, status: 0, durationMs: ms, description: String(err) };
  }
}

// Telegram HTML mode allows: <b> <i> <u> <s> <code> <pre> <a>
// We must escape <, >, & in user-provided text.
export function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
