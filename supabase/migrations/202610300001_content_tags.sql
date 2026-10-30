begin;

alter table public.simulados add column if not exists tags text[] not null default '{}';
create index if not exists simulados_tags_idx on public.simulados using gin(tags);

create table public.content_tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (nome = btrim(nome) and char_length(nome) between 1 and 80),
  tipo text not null check (tipo in ('apostila', 'simulado')),
  created_at timestamptz not null default now()
);
create unique index content_tags_tipo_nome_idx on public.content_tags (tipo, lower(nome));
alter table public.content_tags enable row level security;
grant select on public.content_tags to anon, authenticated;
grant insert on public.content_tags to authenticated;
create policy content_tags_read on public.content_tags for select to anon, authenticated using (true);
create policy content_tags_create on public.content_tags for insert to authenticated with check (public.is_admin());

-- Preserve names already attached to existing content.
insert into public.content_tags (tipo, nome)
select distinct 'apostila', btrim(tag) from public.apostilas cross join lateral unnest(tags) as tag
where char_length(btrim(tag)) between 1 and 80
on conflict do nothing;
insert into public.content_tags (tipo, nome)
select distinct 'simulado', btrim(tag) from public.simulados cross join lateral unnest(tags) as tag
where char_length(btrim(tag)) between 1 and 80
on conflict do nothing;

commit;
