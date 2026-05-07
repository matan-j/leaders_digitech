alter table public.educational_institutions
  add column if not exists has_files boolean not null default false;

update public.educational_institutions ei
set has_files = true
where exists (
  select 1
  from storage.objects o
  where o.bucket_id = 'lesson-files'
    and split_part(o.name, '/', 1) = 'crm'
    and split_part(o.name, '/', 2) = ei.id::text
    and split_part(o.name, '/', 3) <> ''
    and o.name not like '%/.emptyFolderPlaceholder'
);
