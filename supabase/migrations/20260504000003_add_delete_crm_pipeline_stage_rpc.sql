begin;

create or replace function public.delete_crm_pipeline_stage(
  p_stage_id uuid
)
returns table (
  stage_id uuid,
  stage_name text,
  institutions_count integer,
  opportunities_count integer,
  message_templates_count integer,
  automation_rules_count integer,
  deleted_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage_name text;
begin
  if public.get_current_user_role() not in ('admin', 'pedagogical_manager') then
    raise exception 'Not allowed to delete CRM pipeline stages'
      using errcode = '42501';
  end if;

  select name
  into v_stage_name
  from public.crm_pipeline_stages
  where id = p_stage_id
  for update;

  if not found then
    raise exception 'CRM pipeline stage % does not exist', p_stage_id
      using errcode = 'P0002';
  end if;

  select count(*) into institutions_count
  from public.educational_institutions
  where crm_stage = v_stage_name;

  select count(*) into opportunities_count
  from public.crm_opportunities
  where stage = v_stage_name;

  select count(*) into message_templates_count
  from public.crm_message_templates
  where stage = v_stage_name;

  select count(*) into automation_rules_count
  from public.crm_automation_rules
  where trigger_type = 'stage_enter'
    and trigger_value = v_stage_name;

  if institutions_count > 0
    or opportunities_count > 0
    or message_templates_count > 0
    or automation_rules_count > 0
  then
    raise exception 'Cannot delete CRM pipeline stage "%" because it is still used. institutions=%, opportunities=%, message_templates=%, automation_rules=%',
      v_stage_name,
      institutions_count,
      opportunities_count,
      message_templates_count,
      automation_rules_count
      using errcode = '23503';
  end if;

  delete from public.crm_pipeline_stages
  where id = p_stage_id;

  get diagnostics deleted_count = row_count;

  stage_id := p_stage_id;
  stage_name := v_stage_name;

  return next;
end;
$$;

revoke all on function public.delete_crm_pipeline_stage(uuid) from public;
grant execute on function public.delete_crm_pipeline_stage(uuid) to authenticated;

commit;
