create table if not exists public.crm_contact_statuses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  color text not null default '#6B7280',
  order_index integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  legacy_crm_risk text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_contact_statuses enable row level security;

drop policy if exists "crm_contact_statuses_select_policy" on public.crm_contact_statuses;
create policy "crm_contact_statuses_select_policy"
  on public.crm_contact_statuses for select to authenticated
  using (true);

insert into public.crm_contact_statuses (key, label, color, order_index, is_default, is_active, legacy_crm_risk)
values
  ('not_contacted', 'לא שוחחנו', '#DC2626', 0, true, true, 'high'),
  ('in_progress', 'בתהליך', '#D97706', 1, false, true, 'medium'),
  ('contacted', 'שוחחנו', '#16A34A', 2, false, true, 'low')
on conflict (key) do update
set
  label = excluded.label,
  color = excluded.color,
  order_index = excluded.order_index,
  is_default = excluded.is_default,
  is_active = excluded.is_active,
  legacy_crm_risk = excluded.legacy_crm_risk,
  updated_at = now();

alter table public.educational_institutions
  add column if not exists crm_contact_status_id uuid references public.crm_contact_statuses(id) on delete set null,
  add column if not exists crm_contact_status_updated_at timestamptz null;

create index if not exists idx_educational_institutions_contact_status_id
  on public.educational_institutions(crm_contact_status_id);

create index if not exists idx_educational_institutions_contact_status_updated_at
  on public.educational_institutions(crm_contact_status_updated_at);

update public.educational_institutions ei
set crm_contact_status_id = s.id
from public.crm_contact_statuses s
where ei.crm_contact_status_id is null
  and s.legacy_crm_risk = ei.crm_risk;

create or replace function public.bump_crm_stage_class_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.crm_stage is distinct from old.crm_stage then
    new.crm_stage_updated_at := now();
  end if;
  if new.crm_class is distinct from old.crm_class then
    new.crm_class_updated_at := now();
  end if;
  if new.crm_risk is distinct from old.crm_risk then
    new.crm_risk_updated_at := now();
  end if;
  if new.crm_contact_status_id is distinct from old.crm_contact_status_id then
    new.crm_contact_status_updated_at := now();
  end if;
  return new;
end;
$$;
