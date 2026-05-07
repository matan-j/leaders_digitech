drop policy if exists "crm_contact_statuses_insert_policy" on public.crm_contact_statuses;
create policy "crm_contact_statuses_insert_policy"
  on public.crm_contact_statuses for insert to authenticated
  with check (public.get_current_user_role() = 'admin');

drop policy if exists "crm_contact_statuses_update_policy" on public.crm_contact_statuses;
create policy "crm_contact_statuses_update_policy"
  on public.crm_contact_statuses for update to authenticated
  using (public.get_current_user_role() = 'admin')
  with check (public.get_current_user_role() = 'admin');
