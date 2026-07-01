alter table strings
  add column if not exists source text,
  add column if not exists confidence double precision,
  add column if not exists stroke text,
  add column if not exists recalled_memory text,
  add column if not exists updated_at timestamptz not null default now();

update strings
set
  source = case when kind = 'manual' then 'manual' else 'cognee' end,
  confidence = coalesce(confidence, case when kind = 'manual' then 1 else 0.65 end),
  stroke = coalesce(stroke, case when kind = 'manual' then 'blue_dashed' else 'red_solid' end)
where source is null
  or confidence is null
  or stroke is null;

alter table strings
  alter column source set not null,
  alter column confidence set not null,
  alter column stroke set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'strings_source_check'
      and conrelid = 'strings'::regclass
  ) then
    alter table strings
      add constraint strings_source_check check (source in ('cognee', 'manual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'strings_confidence_check'
      and conrelid = 'strings'::regclass
  ) then
    alter table strings
      add constraint strings_confidence_check check (confidence >= 0 and confidence <= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'strings_stroke_check'
      and conrelid = 'strings'::regclass
  ) then
    alter table strings
      add constraint strings_stroke_check check (stroke in ('red_solid', 'blue_dashed'));
  end if;
end $$;
