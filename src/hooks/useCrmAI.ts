import { supabase } from '@/integrations/supabase/client';

export async function callCrmAI(action: string, context: object): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-ai-assist`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ action, context }),
    },
  );
  const data = await response.json() as { result?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result ?? '';
}
