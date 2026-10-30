-- Promove um usuário já existente no Supabase Auth para administrador.
-- A operação falha de forma explícita caso o e-mail ainda não esteja cadastrado.

do $$
declare
  target_user_id uuid;
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower('userguilhermeavila05@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception 'Usuário não encontrado no Supabase Auth: userguilhermeavila05@gmail.com';
  end if;

  insert into public.profiles (
    id,
    nome,
    email,
    tipo_usuario,
    status
  )
  select
    id,
    coalesce(
      raw_user_meta_data ->> 'full_name',
      raw_user_meta_data ->> 'name',
      split_part(email, '@', 1)
    ),
    email,
    'admin',
    'ativo'
  from auth.users
  where id = target_user_id
  on conflict (id) do update
  set tipo_usuario = 'admin',
      status = 'ativo',
      email = excluded.email,
      updated_at = now();
end $$;
