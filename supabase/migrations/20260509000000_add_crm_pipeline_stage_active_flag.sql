alter table public.crm_pipeline_stages
  add column if not exists is_active boolean not null default true;

create index if not exists idx_crm_pipeline_stages_is_active
  on public.crm_pipeline_stages(is_active);

-- Temporary normalization bridge:
-- Convert legacy null-class rows to Lead only when they carry CRM lead signals.
-- Do not touch deleted rows, and do not convert rows already sitting in a DB-defined
-- won stage, since those may represent real customers that were never classified.
update public.educational_institutions as institution
set crm_class = 'Lead'
where institution.crm_class is null
  and (institution.is_deleted = false or institution.is_deleted is null)
  and not exists (
    select 1
    from public.crm_pipeline_stages as stage
    where stage.name = institution.crm_stage
      and coalesce(stage.is_won, false) = true
  )
  and (
    institution.crm_stage is not null
    or institution.crm_owner_id is not null
    or institution.crm_assigned_instructor_id is not null
    or institution.crm_potential is not null
    or institution.crm_last_contact_at is not null
    or institution.crm_next_step is not null
    or institution.crm_next_step_date is not null
    or institution.crm_notes is not null
    or institution.crm_contact_status_id is not null
    or institution.crm_risk is not null
  );
