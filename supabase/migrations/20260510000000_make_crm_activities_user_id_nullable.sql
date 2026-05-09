-- Allow system-generated CRM activity logs, such as inbound webhooks, to be
-- recorded without attributing them to a human user.
ALTER TABLE public.crm_activities
  ALTER COLUMN user_id DROP NOT NULL;
