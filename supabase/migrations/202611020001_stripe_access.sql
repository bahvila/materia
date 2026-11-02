begin;

alter table public.simulados add column if not exists preco_centavos integer not null default 0 check (preco_centavos >= 0);
alter table public.apostilas add column if not exists preview_pdf_path text;
alter table public.apostilas add constraint apostilas_private_pdf_path check (pdf_path is null or pdf_path !~* '^https?://') not valid;
alter table public.apostilas add constraint apostilas_separate_preview check (preview_pdf_path is null or preview_pdf_path = '' or preview_pdf_path is distinct from pdf_path) not valid;
update storage.buckets set public = false where id = 'apostila-pdfs';

insert into public.plans(nome, slug, preco_centavos, moeda, intervalo, recursos)
values ('Matéria Premium', 'materia-premium', 2499, 'BRL', 'month', '{"todas_apostilas":true,"todos_simulados":true}')
on conflict (slug) do nothing;

create table public.stripe_checkout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  tipo text not null check (tipo in ('apostila','simulado','premium')),
  apostila_id uuid references public.apostilas(id),
  simulado_id uuid references public.simulados(id),
  plan_id uuid references public.plans(id),
  total_centavos integer not null check (total_centavos > 0),
  currency text not null default 'brl',
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  checkout_session_id text unique, payment_intent_id text unique,
  created_at timestamptz not null default now(), paid_at timestamptz
);
alter table public.stripe_checkout_orders enable row level security;
create policy stripe_orders_own_read on public.stripe_checkout_orders for select to authenticated using(user_id = auth.uid());
revoke all on public.stripe_checkout_orders from anon, authenticated;
grant select on public.stripe_checkout_orders to authenticated;

create table public.user_simulados (
  user_id uuid not null references public.profiles(id) on delete cascade,
  simulado_id uuid not null references public.simulados(id) on delete cascade,
  checkout_order_id uuid references public.stripe_checkout_orders(id),
  granted_at timestamptz not null default now(), revoked_at timestamptz,
  primary key(user_id, simulado_id)
);
alter table public.user_simulados enable row level security;
create policy user_simulados_own_read on public.user_simulados for select to authenticated using(user_id = auth.uid());
revoke all on public.user_simulados from anon, authenticated;
grant select on public.user_simulados to authenticated;
grant all on public.stripe_checkout_orders, public.user_simulados to service_role;

create or replace function public.has_premium_access() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.subscriptions s join public.plans p on p.id = s.plan_id
 where s.user_id = auth.uid() and p.slug = 'materia-premium' and s.status in ('active','trialing')
 and s.current_period_end > now());
$$;
create or replace function public.can_access_apostila(content_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.is_admin() or public.has_premium_access() or exists(select 1 from public.user_apostilas
 where user_id = auth.uid() and apostila_id = content_id and revoked_at is null and (expires_at is null or expires_at > now()));
$$;
create or replace function public.can_access_simulado(content_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.is_admin() or public.has_premium_access() or exists(select 1 from public.user_simulados
 where user_id = auth.uid() and simulado_id = content_id and revoked_at is null);
$$;

-- Column privileges keep full PDF locations and questions out of public catalogs.
revoke select on public.apostilas, public.simulados from anon, authenticated;
grant select(id,titulo,slug,subtitulo,descricao,capa_path,preco_centavos,moeda,ano,categoria,tags,total_paginas,paginas_gratis,status,destaque,created_by,created_at,updated_at,published_at) on public.apostilas to anon, authenticated;
grant select(id,titulo,slug,descricao,imagem_path,categoria,tags,nivel,duracao_minutos,quantidade_questoes,is_premium,status,configuracao,preco_centavos,created_by,created_at,updated_at,published_at) on public.simulados to anon, authenticated;

create or replace function public.get_apostila_pdf(content_id uuid, preview boolean default false) returns text
language plpgsql stable security definer set search_path = '' as $$
declare item public.apostilas;
begin
 select * into item from public.apostilas where id = content_id;
 if item.id is null or (item.status <> 'publicado' and not public.is_admin()) then raise exception 'Conteúdo indisponível'; end if;
 if preview then return item.preview_pdf_path; end if;
 if not public.can_access_apostila(content_id) then raise exception 'Adquira esta apostila ou assine o Premium' using errcode = '42501'; end if;
 return item.pdf_path;
end; $$;

create or replace function public.get_simulado_questions(identifier text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare item public.simulados;
begin
 select * into item from public.simulados where id::text = identifier or slug = identifier limit 1;
 if item.id is null or (item.status <> 'publicado' and not public.is_admin()) then raise exception 'Simulado indisponível'; end if;
 if not public.can_access_simulado(item.id) then raise exception 'Adquira este simulado ou assine o Premium' using errcode = '42501'; end if;
 return item.questoes;
end; $$;

drop policy if exists storage_owned_pdf_read on storage.objects;
create or replace function public.can_read_apostila_file(file_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.apostilas a where a.status = 'publicado'
 and (a.preview_pdf_path = file_path or (a.pdf_path = file_path and public.can_access_apostila(a.id))));
$$;
revoke all on function public.can_read_apostila_file(text) from public;
grant execute on function public.can_read_apostila_file(text) to authenticated;
create policy storage_owned_pdf_read on storage.objects for select to authenticated using (
 bucket_id = 'apostila-pdfs' and public.can_read_apostila_file(name)
);

-- Only the signed webhook's service-role client may finalize a payment.
create or replace function public.fulfill_stripe_order(order_uuid uuid, session_id text, intent_id text, amount integer, currency_code text, refund boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.stripe_checkout_orders;
begin
 select * into item from public.stripe_checkout_orders where id = order_uuid for update;
 if item.id is null or item.checkout_session_id is distinct from session_id or item.total_centavos <> amount or item.currency <> currency_code then
   raise exception 'Pagamento não corresponde ao pedido';
 end if;
 if refund then
   update public.stripe_checkout_orders set status = 'refunded', payment_intent_id = intent_id where id = item.id;
   update public.user_simulados set revoked_at = now() where checkout_order_id = item.id;
   update public.user_apostilas set revoked_at = now() where metadata->>'stripe_order_id' = item.id::text;
   return;
 end if;
 if item.status <> 'pending' then return; end if;
 update public.stripe_checkout_orders set status = 'paid', payment_intent_id = intent_id, paid_at = now() where id = item.id;
 if item.tipo = 'apostila' then
   insert into public.user_apostilas(user_id,apostila_id,origem,metadata) values(item.user_id,item.apostila_id,'stripe',jsonb_build_object('stripe_order_id',item.id))
   on conflict(user_id,apostila_id) do update set revoked_at = null, expires_at = null, origem = 'stripe', metadata = excluded.metadata;
 elsif item.tipo = 'simulado' then
   insert into public.user_simulados(user_id,simulado_id,checkout_order_id) values(item.user_id,item.simulado_id,item.id)
   on conflict(user_id,simulado_id) do update set revoked_at = null, checkout_order_id = excluded.checkout_order_id;
 end if;
end; $$;
revoke all on function public.fulfill_stripe_order(uuid,text,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.fulfill_stripe_order(uuid,text,text,integer,text,boolean) to service_role;
revoke all on function public.has_premium_access(), public.can_access_apostila(uuid), public.can_access_simulado(uuid), public.get_apostila_pdf(uuid,boolean), public.get_simulado_questions(text) from public;
grant execute on function public.has_premium_access(), public.can_access_apostila(uuid), public.can_access_simulado(uuid), public.get_apostila_pdf(uuid,boolean), public.get_simulado_questions(text) to authenticated;

commit;
