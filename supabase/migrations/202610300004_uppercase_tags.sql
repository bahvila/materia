begin;

create or replace function public.normalize_tag_names(values_to_normalize text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(nome order by primeira_posicao), '{}'::text[])
  from (
    select upper(btrim(valor)) as nome, min(posicao) as primeira_posicao
    from unnest(coalesce(values_to_normalize, '{}'::text[])) with ordinality as entrada(valor, posicao)
    where valor is not null and btrim(valor) <> ''
    group by upper(btrim(valor))
  ) normalizadas;
$$;

create or replace function public.normalize_registry_tag()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nome := upper(btrim(new.nome));
  return new;
end;
$$;
create trigger content_tags_uppercase before insert or update of nome
on public.content_tags for each row execute function public.normalize_registry_tag();

create or replace function public.normalize_content_tag_array()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tags := public.normalize_tag_names(new.tags);
  return new;
end;
$$;
create trigger apostilas_tags_uppercase before insert or update of tags
on public.apostilas for each row execute function public.normalize_content_tag_array();
create trigger simulados_tags_uppercase before insert or update of tags
on public.simulados for each row execute function public.normalize_content_tag_array();

update public.content_tags set nome = upper(btrim(nome));
update public.apostilas set tags = public.normalize_tag_names(tags)
where tags is distinct from public.normalize_tag_names(tags);
update public.simulados set tags = public.normalize_tag_names(tags)
where tags is distinct from public.normalize_tag_names(tags);

alter table public.content_tags add constraint content_tags_uppercase_check check (nome = upper(nome));
alter table public.apostilas add constraint apostilas_tags_uppercase_check check (tags = public.normalize_tag_names(tags));
alter table public.simulados add constraint simulados_tags_uppercase_check check (tags = public.normalize_tag_names(tags));

-- Rename/delete the registry entry and its content links in one transaction.
create or replace function public.manage_content_tag(p_id uuid, p_nome text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tag public.content_tags%rowtype;
  novo_nome text := upper(btrim(p_nome));
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.' using errcode = '42501';
  end if;
  select * into tag from public.content_tags where id = p_id for update;
  if not found then
    raise exception 'Tag não encontrada.' using errcode = 'P0002';
  end if;
  if p_nome is not null and (novo_nome = '' or char_length(novo_nome) > 80) then
    raise exception 'Informe um nome com até 80 caracteres.' using errcode = '22023';
  end if;

  if p_nome is null then
    delete from public.content_tags where id = p_id;
  else
    update public.content_tags set nome = novo_nome where id = p_id;
  end if;

  if tag.tipo = 'apostila' then
    update public.apostilas
    set tags = case when p_nome is null then array_remove(tags, tag.nome)
      else array(select distinct unnest(array_replace(tags, tag.nome, novo_nome))) end,
      updated_at = now()
    where tag.nome = any(tags);
  else
    update public.simulados
    set tags = case when p_nome is null then array_remove(tags, tag.nome)
      else array(select distinct unnest(array_replace(tags, tag.nome, novo_nome))) end,
      updated_at = now()
    where tag.nome = any(tags);
  end if;
end;
$$;

revoke all on function public.manage_content_tag(uuid, text) from public, anon;
grant execute on function public.manage_content_tag(uuid, text) to authenticated;


commit;
