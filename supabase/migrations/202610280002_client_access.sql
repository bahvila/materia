-- Acesso seguro do cliente Supabase para a aplicação Matéria.
-- Regras de negócio continuam no JavaScript; estas policies são apenas autorização.

begin;

alter table public.profiles add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and tipo_usuario in ('admin', 'super_admin')
      and status = 'ativo'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Perfis
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check (id = auth.uid() and tipo_usuario = 'aluno');
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check ((id = auth.uid() and tipo_usuario = 'aluno') or public.is_admin());

-- Catálogo público
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans for select to anon, authenticated using (ativo = true);
drop policy if exists apostilas_public_read on public.apostilas;
create policy apostilas_public_read on public.apostilas for select to anon, authenticated using (status = 'publicado');
drop policy if exists simulados_public_read on public.simulados;
create policy simulados_public_read on public.simulados for select to anon, authenticated using (status = 'publicado');

-- Dados do próprio usuário
drop policy if exists subscriptions_own_read on public.subscriptions;
create policy subscriptions_own_read on public.subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists payment_customers_own_read on public.payment_customers;
create policy payment_customers_own_read on public.payment_customers for select to authenticated using (user_id = auth.uid());
drop policy if exists orders_own_read on public.orders;
create policy orders_own_read on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items for select to authenticated
using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));
drop policy if exists payments_own_read on public.payments;
create policy payments_own_read on public.payments for select to authenticated using (user_id = auth.uid());
drop policy if exists user_apostilas_own_read on public.user_apostilas;
create policy user_apostilas_own_read on public.user_apostilas for select to authenticated using (user_id = auth.uid());
drop policy if exists reading_progress_own_all on public.reading_progress;
create policy reading_progress_own_all on public.reading_progress for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists attempts_own_all on public.attempts;
create policy attempts_own_all on public.attempts for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Administração de conteúdo. Para ativar, altere profiles.tipo_usuario para admin.
drop policy if exists plans_admin_all on public.plans;
create policy plans_admin_all on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists apostilas_admin_all on public.apostilas;
create policy apostilas_admin_all on public.apostilas for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists simulados_admin_all on public.simulados;
create policy simulados_admin_all on public.simulados for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage
drop policy if exists storage_public_assets_read on storage.objects;
create policy storage_public_assets_read on storage.objects for select to anon, authenticated
using (bucket_id in ('apostila-capas', 'avatars'));
drop policy if exists storage_admin_all on storage.objects;
create policy storage_admin_all on storage.objects for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists storage_owned_pdf_read on storage.objects;
create policy storage_owned_pdf_read on storage.objects for select to authenticated
using (
  bucket_id = 'apostila-pdfs'
  and exists (
    select 1
    from public.apostilas a
    where a.pdf_path = name
      and (
        public.is_admin()
        or exists (
          select 1 from public.user_apostilas ua
          where ua.user_id = auth.uid()
            and ua.apostila_id = a.id
            and ua.revoked_at is null
            and (ua.expires_at is null or ua.expires_at > now())
        )
        or exists (
          select 1 from public.subscriptions s
          where s.user_id = auth.uid()
            and s.status = 'active'
            and (s.current_period_end is null or s.current_period_end > now())
        )
      )
  )
);

commit;

