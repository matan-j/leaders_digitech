begin;

-- Remove legacy fixed-name constraints if they still exist.
alter table public.educational_institutions
  drop constraint if exists educational_institutions_crm_stage_check;

alter table public.crm_opportunities
  drop constraint if exists crm_opportunities_stage_check;

alter table public.crm_message_templates
  drop constraint if exists crm_message_templates_stage_check;

create or replace function public.rename_crm_pipeline_stage(
  p_stage_id uuid,
  p_new_name text
)
returns table (
  stage_id uuid,
  old_name text,
  new_name text,
  pipeline_stages_updated integer,
  institutions_updated integer,
  opportunities_updated integer,
  automation_rules_updated integer,
  message_templates_updated integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_name text;
  v_new_name text;
begin
  if public.get_current_user_role() not in ('admin', 'pedagogical_manager') then
    raise exception 'Not allowed to rename CRM pipeline stages'
      using errcode = '42501';
  end if;

  v_new_name := nullif(trim(p_new_name), '');

  if v_new_name is null then
    raise exception 'Stage name cannot be empty'
      using errcode = '22023';
  end if;

  select name
  into v_old_name
  from public.crm_pipeline_stages
  where id = p_stage_id
  for update;

  if not found then
    raise exception 'CRM pipeline stage % does not exist', p_stage_id
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.crm_pipeline_stages
    where id <> p_stage_id
      and lower(trim(name)) = lower(v_new_name)
  ) then
    raise exception 'CRM pipeline stage name "%" already exists', v_new_name
      using errcode = '23505';
  end if;

  if v_old_name = v_new_name then
    stage_id := p_stage_id;
    old_name := v_old_name;
    new_name := v_new_name;
    pipeline_stages_updated := 0;
    institutions_updated := 0;
    opportunities_updated := 0;
    automation_rules_updated := 0;
    message_templates_updated := 0;
    return next;
    return;
  end if;

  update public.crm_pipeline_stages
  set name = v_new_name
  where id = p_stage_id;
  get diagnostics pipeline_stages_updated = row_count;

  update public.educational_institutions
  set crm_stage = v_new_name
  where crm_stage = v_old_name;
  get diagnostics institutions_updated = row_count;

  update public.crm_opportunities
  set stage = v_new_name
  where stage = v_old_name;
  get diagnostics opportunities_updated = row_count;

  update public.crm_automation_rules
  set trigger_value = v_new_name
  where trigger_type = 'stage_enter'
    and trigger_value = v_old_name;
  get diagnostics automation_rules_updated = row_count;

  update public.crm_message_templates
  set stage = v_new_name
  where stage = v_old_name;
  get diagnostics message_templates_updated = row_count;

  stage_id := p_stage_id;
  old_name := v_old_name;
  new_name := v_new_name;

  return next;
end;
$$;

revoke all on function public.rename_crm_pipeline_stage(uuid, text) from public;
grant execute on function public.rename_crm_pipeline_stage(uuid, text) to authenticated;

commit;
