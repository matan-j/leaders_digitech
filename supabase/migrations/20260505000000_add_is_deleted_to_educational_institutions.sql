alter table public.educational_institutions
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_educational_institutions_is_deleted
  on public.educational_institutions (is_deleted);
