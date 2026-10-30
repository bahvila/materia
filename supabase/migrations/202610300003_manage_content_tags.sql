begin;

-- Rename/delete the registry entry and its content links in one transaction.
create or replace function public.manage_content_tag(p_id uuid, p_nome text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tag public.content_tags%rowtype;
  novo_nome text := btrim(p_nome);
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
